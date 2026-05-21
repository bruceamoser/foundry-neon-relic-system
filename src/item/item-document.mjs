/**
 * Extended Item document class for Neon Relic.
 * @extends Item
 */
export class NeonRelicItem extends Item {
  /** Resource die step chain: d12 → d10 → d8 → d6 → d4 → depleted. */
  static RESOURCE_DIE_CHAIN = ['d12', 'd10', 'd8', 'd6', 'd4', 'depleted'];

  /** Artifact die step chain: d20 → d12 → d10 → d8 → d6 → d4 → fractured. */
  static ARTIFACT_DIE_CHAIN = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', 'fractured'];

  /* ------------------------------------------ */
  /*  Gear Degradation (Weapons + Tools)        */
  /* ------------------------------------------ */

  /**
   * Degrade gear bonus by 1. At 0 → mark Broken.
   * Triggered when Gear Die shows 1 on initial roll (NOT on pushes).
   * @returns {Promise<NeonRelicItem>}
   */
  async degradeGear() {
    if (!['weapon', 'gear'].includes(this.type)) return this;
    const current = this.system.gearBonus.value;
    if (current <= 0) return this;
    const newVal = current - 1;
    const updates = { 'system.gearBonus.value': newVal };
    if (newVal === 0) updates['system.isBroken'] = true;
    await this.update(updates);
    return this;
  }

  /* ------------------------------------------ */
  /*  Armor Degradation                         */
  /* ------------------------------------------ */

  /**
   * Degrade armor rating by 1. At 0 → mark Broken.
   * Distinct from gear degradation — triggered on pushes and stunts, NOT rolling 1s.
   * @returns {Promise<NeonRelicItem>}
   */
  async degradeArmor() {
    if (this.type !== 'armor') return this;
    const current = this.system.ar.value;
    if (current <= 0) return this;
    const newVal = current - 1;
    const updates = { 'system.ar.value': newVal };
    if (newVal === 0) updates['system.isBroken'] = true;
    await this.update(updates);
    return this;
  }

  /* ------------------------------------------ */
  /*  Resource Die                              */
  /* ------------------------------------------ */

  /**
   * Step down the resource die (consumables). On roll of 1-2, move to next smaller die.
   * @returns {Promise<{stepped: boolean, oldDie: string, newDie: string}>}
   */
  async stepDown() {
    if (this.type !== 'consumable') return { stepped: false, oldDie: '', newDie: '' };
    const chain = NeonRelicItem.RESOURCE_DIE_CHAIN;
    const current = this.system.currentDie;
    const idx = chain.indexOf(current);
    if (idx === -1 || current === 'depleted') return { stepped: false, oldDie: current, newDie: current };
    const newDie = chain[idx + 1] ?? 'depleted';
    await this.update({ 'system.currentDie': newDie });
    return { stepped: true, oldDie: current, newDie };
  }

  /* ------------------------------------------ */
  /*  Ammo Die (Weapon-attached)                */
  /* ------------------------------------------ */

  /**
   * Step down the ammo die on a weapon. Same mechanic as resource die (1-2 = step down).
   * Full Auto trait: caller should invoke this twice per turn.
   * @returns {Promise<{stepped: boolean, oldDie: string, newDie: string}>}
   */
  async stepDownAmmo() {
    if (this.type !== 'weapon') return { stepped: false, oldDie: '', newDie: '' };
    const chain = NeonRelicItem.RESOURCE_DIE_CHAIN;
    const current = this.system.ammoDie?.current;
    if (!current || current === 'depleted') return { stepped: false, oldDie: current ?? '', newDie: current ?? '' };
    const idx = chain.indexOf(current);
    if (idx === -1) return { stepped: false, oldDie: current, newDie: current };
    const newDie = chain[idx + 1] ?? 'depleted';
    await this.update({ 'system.ammoDie.current': newDie });
    return { stepped: true, oldDie: current, newDie };
  }

  /**
   * Reload the weapon — reset ammo die to starting value.
   * @returns {Promise<NeonRelicItem>}
   */
  async reload() {
    if (this.type !== 'weapon') return this;
    const starting = this.system.ammoDie?.starting;
    if (starting) await this.update({ 'system.ammoDie.current': starting });
    return this;
  }

  /* ------------------------------------------ */
  /*  Artifact Die                              */
  /* ------------------------------------------ */

  /**
   * Step down the artifact die. Steps on 1 ONLY (not 1-2 like resource dice).
   * d20 → d12 → d10 → d8 → d6 → d4 → fractured.
   * @returns {Promise<{stepped: boolean, oldDie: string, newDie: string, fractured: boolean}>}
   */
  async stepDownArtifactDie() {
    if (this.type !== 'artifact') return { stepped: false, oldDie: '', newDie: '', fractured: false };
    const chain = NeonRelicItem.ARTIFACT_DIE_CHAIN;
    const current = this.system.artifactDie.current;
    if (current === 'fractured') return { stepped: false, oldDie: current, newDie: current, fractured: true };
    const idx = chain.indexOf(current);
    if (idx === -1) return { stepped: false, oldDie: current, newDie: current, fractured: false };
    const newDie = chain[idx + 1] ?? 'fractured';
    await this.update({ 'system.artifactDie.current': newDie });
    return { stepped: true, oldDie: current, newDie, fractured: newDie === 'fractured' };
  }

  /* ------------------------------------------ */
  /*  Talent                                    */
  /* ------------------------------------------ */

  /**
   * Use a talent — decrement uses, apply corruption cost, enforce once-per-session.
   * @returns {Promise<{used: boolean, corruptionCost: number}>}
   */
  async useTalent() {
    if (this.type !== 'talent') return { used: false, corruptionCost: 0 };
    const uses = this.system.usesPerSession;

    // Check once-per-session constraint
    if (this.system.isOncePerSession && uses.value <= 0) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Talent.AlreadyUsed'));
      return { used: false, corruptionCost: 0 };
    }

    // Decrement uses
    if (uses.max > 0 && uses.value > 0) {
      await this.update({ 'system.usesPerSession.value': uses.value - 1 });
    }

    // Apply corruption cost to owning actor
    const cost = this.system.corruptionCost ?? 0;
    if (cost > 0 && this.actor) {
      await this.actor.gainCorruption(cost, this.name);
    }

    // Send talent use to chat
    const parts = [`<strong>${this.name}</strong>`];
    if (this.system.description) parts.push(this.system.description);
    if (cost > 0) parts.push(`<em>${game.i18n.format('NEONRELIC.Talent.CorruptionCostChat', { cost })}</em>`);
    const usesMax = this.system.usesPerSession?.max ?? 0;
    const usesLeft = this.system.usesPerSession?.value ?? 0;
    if (usesMax > 0)
      parts.push(`<em>${game.i18n.format('NEONRELIC.Talent.UsesRemaining', { value: usesLeft, max: usesMax })}</em>`);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="nr-talent-chat">${parts.join('<br>')}</div>`,
    });

    return { used: true, corruptionCost: cost };
  }

  /* ------------------------------------------ */
  /*  Critical Injury                           */
  /* ------------------------------------------ */

  /**
   * Apply insight from a critical injury (anti-farming: checks d66 uniqueness on actor).
   * @returns {Promise<boolean>} Whether the insight was applied.
   */
  async applyInsight() {
    if (this.type !== 'criticalInjury') return false;
    if (!this.system.insight || !this.actor) return false;
    // Anti-farming: check if this d66 result was already applied
    const existing = this.actor.items.filter(
      i =>
        i.type === 'criticalInjury' &&
        i.id !== this.id &&
        i.system.d66Roll === this.system.d66Roll &&
        i.system.isHealed,
    );
    if (existing.length > 0) return false;
    return true;
  }
}
