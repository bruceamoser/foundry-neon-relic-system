/**
 * Card-draw initiative combat system.
 * Virtual deck: Ace (1) through 10. Higher card acts first.
 * Deck reshuffles every round.
 * @module combat/combat
 */

/**
 * Build a full virtual deck — values 1–10.
 * @returns {number[]}
 */
function buildDeck() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
}

/**
 * Shuffle an array in-place (Fisher-Yates).
 * @param {number[]} array
 * @returns {number[]}
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Neon Relic Combat — card-draw initiative.
 * Extends Foundry Combat to use a virtual card deck.
 */
export class NeonRelicCombat extends Combat {
  /**
   * Virtual deck for the current round.
   * @type {number[]}
   */
  _deck = [];

  /** @override */
  async startCombat() {
    this._reshuffleDeck();
    return super.startCombat();
  }

  /** @override */
  async nextRound() {
    this._reshuffleDeck();
    return super.nextRound();
  }

  /**
   * Reshuffle the deck — called at start of combat and each new round.
   */
  _reshuffleDeck() {
    this._deck = shuffle(buildDeck());
  }

  /**
   * Draw a card from the virtual deck.
   * @returns {number} Card value 1–10.
   */
  drawCard() {
    if (!this._deck.length) this._reshuffleDeck();
    return this._deck.pop();
  }

  /** @override */
  async rollInitiative(
    ids,
    { formula: _formula = null, updateTurn = true, messageOptions: _messageOptions = {} } = {},
  ) {
    this._reshuffleDeck();

    const updates = [];
    const drawnValues = new Map();

    for (const id of ids) {
      const combatant = this.combatants.get(id);
      if (!combatant) continue;

      // Combat Reflexes: draw 2, keep higher
      const hasCombatReflexes = combatant.actor?.items.some(i => i.type === 'talent' && i.name === 'Combat Reflexes');

      let card;
      if (hasCombatReflexes) {
        const c1 = this.drawCard();
        const c2 = this.drawCard();
        card = Math.max(c1, c2);
      } else {
        card = this.drawCard();
      }

      // Elevated zone bonus
      const elevatedBonus = combatant.getFlag('neon-relic', 'elevated') ? 2 : 0;
      let initiative = card + elevatedBonus;

      // Tie-breaking: if value already used, add 0.1 offset to preserve ordering
      while (drawnValues.has(initiative)) {
        initiative -= 0.01;
      }
      drawnValues.set(initiative, id);

      updates.push({ _id: id, initiative });

      // Store the raw card value for display
      await combatant.setFlag('neon-relic', 'cardValue', card);
    }

    await this.updateEmbeddedDocuments('Combatant', updates);

    if (updateTurn) {
      const turn = this.turns.findIndex(t => ids.includes(t.id));
      if (turn !== -1) await this.update({ turn });
    }

    return this;
  }

  /** @override */
  _sortCombatants(a, b) {
    // Higher initiative goes first (descending)
    return (b.initiative ?? -1) - (a.initiative ?? -1);
  }
}
