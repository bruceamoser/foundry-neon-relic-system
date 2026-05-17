/**
 * Extended Actor document class for Neon Relic.
 * @extends Actor
 */
export class NeonRelicActor extends Actor {
  /* ------------------------------------------ */
  /*  Data Preparation                          */
  /* ------------------------------------------ */

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  getRollData() {
    const data = super.getRollData();
    if (this.type === 'agent' || this.type === 'npc') {
      const attrs = this.system.attributes;
      for (const [key, attr] of Object.entries(attrs)) {
        data[key] = typeof attr === 'object' ? attr.value : attr;
      }
    }
    if (this.type === 'agent') {
      for (const [key, val] of Object.entries(this.system.skills)) {
        data[key] = val;
      }
    }
    return data;
  }

  /* ------------------------------------------ */
  /*  Corruption                                */
  /* ------------------------------------------ */

  /**
   * Gain corruption from a source.
   * @param {number} amount - Amount of corruption to gain.
   * @param {string} [source] - Description of the source.
   * @returns {Promise<NeonRelicActor>}
   */
  async gainCorruption(amount, source = '') {
    if (this.type !== 'agent') return this;
    const current = this.system.corruption.value;
    const threshold = this.system.corruption.threshold;
    const newVal = current + amount;
    await this.update({ 'system.corruption.value': newVal });

    // Warn if at or above threshold
    if (newVal >= threshold) {
      ui.notifications.warn(game.i18n.format('NEONRELIC.Corruption.ThresholdReached', { name: this.name }));
    }
    return this;
  }

  /**
   * Heal corruption, respecting the session cap of 5.
   * @param {number} amount - Amount to heal.
   * @param {string} [method] - Healing method identifier.
   * @returns {Promise<NeonRelicActor>}
   */
  async healCorruption(amount, method = '') {
    if (this.type !== 'agent') return this;
    const sys = this.system.corruption;
    const healed = sys.sessionHealing;
    const maxSessionHealing = 5;
    const available = Math.max(0, maxSessionHealing - healed);
    const actual = Math.min(amount, available, sys.value);
    if (actual <= 0) return this;

    await this.update({
      'system.corruption.value': sys.value - actual,
      'system.corruption.sessionHealing': healed + actual,
    });
    return this;
  }

  /* ------------------------------------------ */
  /*  Damage                                    */
  /* ------------------------------------------ */

  /**
   * Apply damage to the correct attribute based on damage type.
   * Physical→STR, Exhaustion→AGI, Horror→WIT, Trauma→EMP.
   * @param {number} amount - Damage amount.
   * @param {string} type - Damage type key (physical, exhaustion, horror, trauma).
   * @returns {Promise<NeonRelicActor>}
   */
  async applyDamage(amount, type = 'physical') {
    if (this.type !== 'agent') return this;
    const mapping = { physical: 'str', exhaustion: 'agi', horror: 'wit', trauma: 'emp' };
    const attr = mapping[type] ?? 'str';
    const current = this.system.attributes[attr].value;
    const newVal = Math.max(0, current - amount);
    await this.update({ [`system.attributes.${attr}.value`]: newVal });

    // Check if broken
    if (newVal === 0) {
      await this.update({
        'system.conditions.isBroken': true,
        'system.conditions.brokenAttribute': attr,
      });
    }
    return this;
  }

  /**
   * Check if the actor is in a dying state (Broken + lethal critical injury).
   * @returns {boolean}
   */
  getDyingState() {
    if (this.type !== 'agent') return false;
    if (!this.system.conditions.isBroken) return false;
    return this.items.some(i => i.type === 'criticalInjury' && i.system.isLethal && !i.system.isHealed);
  }

  /* ------------------------------------------ */
  /*  Stabilization & Recovery                  */
  /* ------------------------------------------ */

  /**
   * Attempt to stabilize a dying actor.
   * Heal (EMP) Difficulty 2, −2 dice without First Aid Kit.
   * @param {NeonRelicActor} healer - The actor attempting stabilization.
   * @param {boolean} [hasKit=false] - Whether the healer has a First Aid Kit.
   * @returns {Promise<{success: boolean, dice: number}>}
   */
  async stabilize(healer, hasKit = false) {
    const empathy = healer.system.attributes?.emp?.value ?? 0;
    const healSkill = healer.system.skills?.heal ?? 0;
    let dice = empathy + healSkill;
    if (!hasKit) dice = Math.max(0, dice - 2);
    // Actual roll handled by roll handler — this returns the pool info
    return { success: false, dice };
  }

  /**
   * Short rest — recover +1 per attribute per shift.
   * @returns {Promise<NeonRelicActor>}
   */
  async shortRest() {
    if (this.type !== 'agent') return this;
    const updates = {};
    for (const attr of ['str', 'agi', 'wit', 'emp']) {
      const current = this.system.attributes[attr].value;
      const max = this.system.attributes[attr].max;
      if (current < max) {
        updates[`system.attributes.${attr}.value`] = Math.min(current + 1, max);
      }
    }
    if (Object.keys(updates).length > 0) await this.update(updates);
    return this;
  }

  /**
   * Full rest — heal Empathy score of Corruption (between cases only).
   * @returns {Promise<NeonRelicActor>}
   */
  async fullRest() {
    if (this.type !== 'agent') return this;
    const empMax = this.system.attributes.emp.max;
    const current = this.system.corruption.value;
    const newVal = Math.max(0, current - empMax);
    await this.update({ 'system.corruption.value': newVal });
    return this;
  }

  /* ------------------------------------------ */
  /*  Session Reset                             */
  /* ------------------------------------------ */

  /**
   * Reset all per-session tracking fields for a new session.
   * @returns {Promise<NeonRelicActor>}
   */
  async resetSession() {
    if (this.type !== 'agent') return this;
    const updates = {
      'system.corruption.sessionHealing': 0,
      'system.corruption.healingTagUsed': 0,
      'system.conditions.isBroken': false,
      'system.conditions.isDying': false,
      'system.conditions.brokenAttribute': '',
      'system.actions.slow': true,
      'system.actions.fast': true,
      'system.divisionItem.usedThisSession': false,
      'system.sessionTracking.anchorUsed': false,
      'system.sessionTracking.safeSceneUsed': false,
      'system.sessionTracking.conditionedMindUsed': false,
      'system.sessionTracking.bracerAbsorbed': false,
    };
    await this.update(updates);

    // Reset talent per-session uses
    const talentUpdates = [];
    for (const item of this.items) {
      if (item.type === 'talent' && item.system.usesPerSession) {
        talentUpdates.push({ _id: item.id, 'system.usesPerSession.value': item.system.usesPerSession.max });
      }
    }
    if (talentUpdates.length > 0) await this.updateEmbeddedDocuments('Item', talentUpdates);

    return this;
  }

  /* ------------------------------------------ */
  /*  Token Defaults                            */
  /* ------------------------------------------ */

  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    const prototypeToken = {};

    if (this.type === 'agent') {
      prototypeToken.actorLink = true;
      prototypeToken.disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
      prototypeToken.sight = { enabled: true };
    } else if (this.type === 'npc') {
      prototypeToken.actorLink = false;
      prototypeToken.disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    } else if (this.type === 'mob') {
      prototypeToken.actorLink = false;
      prototypeToken.disposition = CONST.TOKEN_DISPOSITIONS.HOSTILE;
    }

    if (Object.keys(prototypeToken).length > 0) {
      this.updateSource({ prototypeToken });
    }
  }
}
