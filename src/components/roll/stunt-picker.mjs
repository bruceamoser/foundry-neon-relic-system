/**
 * Stunt picker dialog — post-roll UI for selecting stunts with Stunt Points.
 * Shows a unified list of general stunts, enforces SP budget.
 * Stunt points = extra successes above difficulty.
 * @module components/roll/stunt-picker
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

const SYSTEM_ID = 'neon-relic';

/**
 * Generic stunts available to any skill roll.
 */
const GENERIC_STUNTS = [
  { id: 'extraSuccess', cost: 1, name: 'NEONRELIC.Stunt.ExtraSuccess', effect: 'NEONRELIC.Stunt.ExtraSuccessEffect' },
  { id: 'assist', cost: 1, name: 'NEONRELIC.Stunt.Assist', effect: 'NEONRELIC.Stunt.AssistEffect' },
  {
    id: 'dramaticEffect',
    cost: 1,
    name: 'NEONRELIC.Stunt.DramaticEffect',
    effect: 'NEONRELIC.Stunt.DramaticEffectEffect',
  },
  { id: 'quickAction', cost: 2, name: 'NEONRELIC.Stunt.QuickAction', effect: 'NEONRELIC.Stunt.QuickActionEffect' },
  { id: 'momentum', cost: 2, name: 'NEONRELIC.Stunt.Momentum', effect: 'NEONRELIC.Stunt.MomentumEffect' },
  { id: 'recover', cost: 2, name: 'NEONRELIC.Stunt.Recover', effect: 'NEONRELIC.Stunt.RecoverEffect' },
];

export class NRStuntPicker extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'stunt-picker',
    classes: [SYSTEM_ID, 'stunt-picker'],
    position: {
      width: 400,
      height: 'auto',
    },
    window: {
      title: 'NEONRELIC.Stunt.PickerTitle',
    },
    actions: {
      toggleStunt: NRStuntPicker.#onToggleStunt,
      confirmStunts: NRStuntPicker.#onConfirm,
    },
  };

  /** @override */
  static PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/roll/stunt-picker.hbs`,
    },
  };

  /* ------------------------------------------ */

  /**
   * @param {object} options
   * @param {number} options.stuntPoints - Available SP (extra successes above difficulty).
   * @param {Actor} [options.actor] - The actor who rolled.
   */
  constructor(options = {}) {
    super(options);
    this.stuntPoints = options.stuntPoints ?? 0;
    this.actor = options.actor ?? null;
    this._selected = new Set();
  }

  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const genericStunts = GENERIC_STUNTS.map(s => ({
      ...s,
      localName: game.i18n.localize(s.name),
      localEffect: game.i18n.localize(s.effect),
      selected: this._selected.has(s.id),
      affordable: s.cost <= this._remainingSP(s.id),
    }));

    context.stuntPoints = this.stuntPoints;
    context.spentSP = this._spentSP();
    context.remainingSP = this.stuntPoints - this._spentSP();
    context.genericStunts = genericStunts;
    context.canConfirm = this._selected.size > 0;

    return context;
  }

  /* ------------------------------------------ */

  _spentSP() {
    let spent = 0;
    for (const s of GENERIC_STUNTS) {
      if (this._selected.has(s.id)) spent += s.cost;
    }
    return spent;
  }

  _remainingSP(stuntId) {
    let spent = 0;
    for (const s of GENERIC_STUNTS) {
      if (this._selected.has(s.id) && s.id !== stuntId) spent += s.cost;
    }
    return this.stuntPoints - spent;
  }

  /* ------------------------------------------ */

  static #onToggleStunt(event, target) {
    const stuntId = target.dataset.stuntId;
    if (this._selected.has(stuntId)) {
      this._selected.delete(stuntId);
    } else {
      const stunt = GENERIC_STUNTS.find(s => s.id === stuntId);
      if (stunt && stunt.cost <= this._remainingSP(stuntId)) {
        this._selected.add(stuntId);
      }
    }
    this.render();
  }

  static async #onConfirm() {
    const chosen = GENERIC_STUNTS.filter(s => this._selected.has(s.id));

    // Post to chat
    const content = chosen
      .map(
        s => `<li><strong>${game.i18n.localize(s.name)}</strong> (${s.cost} SP): ${game.i18n.localize(s.effect)}</li>`,
      )
      .join('');

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<h3>${game.i18n.localize('NEONRELIC.Stunt.ChatHeader')}</h3><ul>${content}</ul>`,
    });

    this.close();
  }

  /* ------------------------------------------ */

  /**
   * Open the stunt picker if SP > 0.
   * @param {object} params
   * @param {number} params.stuntPoints - Extra successes above difficulty.
   * @param {Actor} [params.actor]
   * @returns {NRStuntPicker|null}
   */
  static open({ stuntPoints, actor } = {}) {
    if (stuntPoints <= 0) return null;
    const picker = new NRStuntPicker({ stuntPoints, actor });
    picker.render(true);
    return picker;
  }
}
