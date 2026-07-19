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

  /**
   * Repair a broken gear/weapon — restore gear bonus to max, clear Broken flag.
   * @returns {Promise<NeonRelicItem>}
   */
  async repair() {
    if (!['weapon', 'gear'].includes(this.type)) return this;
    const max = this.system.gearBonus.max;
    const updates = {
      'system.gearBonus.value': max,
      'system.isBroken': false,
    };
    await this.update(updates);
    ui.notifications.info(game.i18n.format('NEONRELIC.Gear.Repaired', { name: this.name }));
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

  /**
   * Use a consumable — rolls the resource die and steps down on a 1.
   * Returns the roll result for chat display.
   * @returns {Promise<{rolled: number, die: string, stepped: boolean, newDie: string|null, depleted: boolean}>}
   */
  async useConsumable() {
    if (this.type !== 'consumable') return { rolled: 0, die: '', stepped: false, newDie: null, depleted: false };
    const current = this.system.currentDie;
    if (!current || current === 'depleted') return { rolled: 0, die: 'depleted', stepped: false, newDie: null, depleted: true };
    const dieSize = parseInt(current.replace('d', ''), 10) || 8;
    const roll = await new Roll(`1d${dieSize}`).evaluate();
    const rollValue = roll.total;
    const stepped = rollValue === 1;
    let newDie = current;
    if (stepped) {
      const result = await this.stepDown();
      newDie = result.newDie;
    }
    return {
      rolled: rollValue,
      die: current,
      stepped,
      newDie,
      depleted: newDie === 'depleted',
    };
  }

  /**
   * Replenish a consumable — step the resource die UP one size (max d12).
   * @returns {Promise<{stepped: boolean, oldDie: string, newDie: string}>}
   */
  async replenish() {
    if (this.type !== 'consumable') return { stepped: false, oldDie: '', newDie: '' };
    const chain = NeonRelicItem.RESOURCE_DIE_CHAIN;
    const current = this.system.currentDie;
    const idx = chain.indexOf(current);
    if (idx <= 0 || current === 'd12') return { stepped: false, oldDie: current, newDie: current };
    const newDie = chain[idx - 1] ?? 'd12';
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
   * Use a talent — enforce frequency limits, apply corruption cost, track usage.
   *
   * Frequency rules:
   *   at-will       — always usable, costs corruption each activation
   *   per-session   — limited uses per session (tracked on item)
   *   per-case-file — limited uses per case file (tracked on actor)
   *
   * @returns {Promise<{used: boolean, corruptionCost: number, frequency: string}>}
   */
  async useTalent() {
    if (this.type !== 'talent') return { used: false, corruptionCost: 0, frequency: null };

    const freq = this.system.frequency || 'at-will';

    // ── Per-session check ──────────────────────────────────────────
    if (freq === 'per-session') {
      const uses = this.system.usesPerSession;
      if (uses.max > 0 && uses.value <= 0) {
        ui.notifications.warn(game.i18n.localize('NEONRELIC.Talent.AlreadyUsed'));
        return { used: false, corruptionCost: 0, frequency: freq };
      }
    }

    // ── Per-case-file check ────────────────────────────────────────
    if (freq === 'per-case-file') {
      const caseUses = this.system.usesPerCaseFile;
      const talentKey = this.id || this.name;
      if (caseUses.max > 0 && caseUses.value <= 0) {
        ui.notifications.warn(game.i18n.localize('NEONRELIC.Talent.AlreadyUsedCaseFile'));
        return { used: false, corruptionCost: 0, frequency: freq };
      }
      // Track on actor for cross-item lookup
      if (this.actor && caseUses.max > 0) {
        await this.actor.update({
          'system.caseFileTalentsUsed': [...this.actor.system.caseFileTalentsUsed, talentKey],
        });
      }
    }

    // ── Decrement uses ─────────────────────────────────────────────
    if (freq === 'per-session') {
      const uses = this.system.usesPerSession;
      if (uses.max > 0 && uses.value > 0) {
        await this.update({ 'system.usesPerSession.value': uses.value - 1 });
      }
    }

    if (freq === 'per-case-file') {
      const caseUses = this.system.usesPerCaseFile;
      if (caseUses.max > 0 && caseUses.value > 0) {
        await this.update({ 'system.usesPerCaseFile.value': caseUses.value - 1 });
      }
    }

    // ── Apply corruption cost (0, 1, or 2) ─────────────────────────
    const cost = this.system.corruptionCost ?? 0;
    if (cost > 0 && this.actor) {
      await this.actor.gainCorruption(cost, this.name);
    }

    // ── Send talent use to chat ────────────────────────────────────
    const parts = [`<strong>${this.name}</strong>`];
    if (this.system.description) parts.push(this.system.description);
    if (cost > 0) parts.push(`<em>${game.i18n.format('NEONRELIC.Talent.CorruptionCostChat', { cost })}</em>`);

    // Show remaining uses based on frequency
    if (freq === 'per-session') {
      const max = this.system.usesPerSession?.max ?? 0;
      const left = this.system.usesPerSession?.value ?? 0;
      if (max > 0) parts.push(`<em>${game.i18n.format('NEONRELIC.Talent.UsesRemaining', { value: left, max })}</em>`);
    } else if (freq === 'per-case-file') {
      const max = this.system.usesPerCaseFile?.max ?? 0;
      const left = this.system.usesPerCaseFile?.value ?? 0;
      if (max > 0)
        parts.push(`<em>${game.i18n.format('NEONRELIC.Talent.UsesRemainingCaseFile', { value: left, max })}</em>`);
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="nr-talent-chat">${parts.join('<br>')}</div>`,
    });

    return { used: true, corruptionCost: cost, frequency: freq };
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
