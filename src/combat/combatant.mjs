/**
 * Neon Relic Combatant — extends Foundry Combatant for card-draw initiative
 * and action economy tracking.
 * @module combat/combatant
 */

/**
 * Neon Relic Combatant — stores card value and action economy state.
 */
export class NeonRelicCombatant extends Combatant {
  /**
   * Get the drawn card value for display.
   * @returns {number|null}
   */
  get cardValue() {
    return this.getFlag('neon-relic', 'cardValue') ?? null;
  }

  /**
   * Get the card label for display (e.g., "Ace", "2", "10").
   * @returns {string}
   */
  get cardLabel() {
    const val = this.cardValue;
    if (val === null) return '';
    if (val === 1) return game.i18n.localize('NEONRELIC.Combat.CardAce');
    return String(val);
  }

  // ─── Action Economy ────────────────────────────────────────

  /**
   * Whether the slow action has been spent this round.
   * @returns {boolean}
   */
  get slowActionSpent() {
    return this.getFlag('neon-relic', 'slowActionSpent') ?? false;
  }

  /**
   * Whether the fast action has been spent this round.
   * @returns {boolean}
   */
  get fastActionSpent() {
    return this.getFlag('neon-relic', 'fastActionSpent') ?? false;
  }

  /**
   * Whether this combatant has acted this round.
   * @returns {boolean}
   */
  get hasActed() {
    return this.getFlag('neon-relic', 'hasActed') ?? false;
  }

  /**
   * Whether this combatant is in cover.
   * @returns {boolean}
   */
  get inCover() {
    return this.getFlag('neon-relic', 'inCover') ?? false;
  }

  /**
   * Whether this combatant is in a surprise round (ambusher).
   * @returns {boolean}
   */
  get isSurprising() {
    return this.getFlag('neon-relic', 'isSurprising') ?? false;
  }

  /**
   * Whether this combatant is surprised (cannot use reactive actions).
   * @returns {boolean}
   */
  get isSurprised() {
    return this.getFlag('neon-relic', 'isSurprised') ?? false;
  }

  /**
   * Spend a slow action.
   * @returns {Promise<void>}
   */
  async spendSlowAction() {
    await this.setFlag('neon-relic', 'slowActionSpent', true);
    await this.setFlag('neon-relic', 'hasActed', true);
  }

  /**
   * Spend a fast action.
   * @returns {Promise<void>}
   */
  async spendFastAction() {
    await this.setFlag('neon-relic', 'fastActionSpent', true);
    await this.setFlag('neon-relic', 'hasActed', true);
  }

  /**
   * Move 1 zone — costs a fast action.
   * @returns {Promise<boolean>} Whether the move succeeded.
   */
  async moveOneZone() {
    if (this.fastActionSpent) return false;
    await this.spendFastAction();
    return true;
  }

  /**
   * Move 2 zones — costs fast + slow action (entire turn).
   * @returns {Promise<boolean>} Whether the move succeeded.
   */
  async moveTwoZones() {
    if (this.fastActionSpent || this.slowActionSpent) return false;
    await this.spendFastAction();
    await this.spendSlowAction();
    return true;
  }

  /**
   * Toggle cover state.
   * @param {boolean} [covered] - If provided, set to this value. Otherwise toggle.
   * @returns {Promise<void>}
   */
  async toggleCover(covered) {
    const newValue = covered !== undefined ? covered : !this.inCover;
    await this.setFlag('neon-relic', 'inCover', newValue);
  }

  /**
   * Set surprise state flags.
   * @param {boolean} surprising - Whether this combatant is an ambusher.
   * @param {boolean} surprised - Whether this combatant is surprised.
   * @returns {Promise<void>}
   */
  async setSurprise(surprising, surprised) {
    await this.setFlag('neon-relic', 'isSurprising', surprising);
    await this.setFlag('neon-relic', 'isSurprised', surprised);
  }

  /**
   * Reset action economy for a new round.
   * @returns {Promise<void>}
   */
  async resetActions() {
    await this.setFlag('neon-relic', 'slowActionSpent', false);
    await this.setFlag('neon-relic', 'fastActionSpent', false);
    await this.setFlag('neon-relic', 'hasActed', false);
    await this.setFlag('neon-relic', 'isSurprising', false);
    await this.setFlag('neon-relic', 'isSurprised', false);
  }
}
