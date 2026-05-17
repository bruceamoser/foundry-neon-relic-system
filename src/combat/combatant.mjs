/**
 * Neon Relic Combatant — extends Foundry Combatant for card-draw initiative.
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
   * Spend a slow action.
   * @returns {Promise<void>}
   */
  async spendSlowAction() {
    await this.setFlag('neon-relic', 'slowActionSpent', true);
  }

  /**
   * Spend a fast action.
   * @returns {Promise<void>}
   */
  async spendFastAction() {
    await this.setFlag('neon-relic', 'fastActionSpent', true);
  }

  /**
   * Reset action economy for a new round.
   * @returns {Promise<void>}
   */
  async resetActions() {
    await this.setFlag('neon-relic', 'slowActionSpent', false);
    await this.setFlag('neon-relic', 'fastActionSpent', false);
  }
}
