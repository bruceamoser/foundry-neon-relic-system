/**
 * Roll configuration dialog using ApplicationV2.
 * Appears before a roll to let the player configure modifiers, difficulty, and options.
 * @module components/roll/roll-dialog
 */

import { buildPool, executeRoll, sendRollToChat } from './roll-handler.mjs';
import { NRStuntPicker } from './stunt-picker.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

/**
 * @extends ApplicationV2
 */
export class NRRollDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'nr-roll-dialog',
    classes: ['neon-relic', 'roll-dialog'],
    tag: 'form',
    window: {
      title: 'NEONRELIC.Roll.ConfigTitle',
      icon: 'fa-solid fa-dice',
      resizable: false,
    },
    position: {
      width: 400,
    },
    form: {
      handler: NRRollDialog.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'systems/neon-relic/templates/roll/roll-dialog.hbs',
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
    },
  };

  /* ------------------------------------------ */

  /**
   * @param {object} rollData - Pre-filled roll configuration.
   * @param {object} [options] - ApplicationV2 options.
   */
  constructor(rollData = {}, options = {}) {
    super(options);
    this.rollData = foundry.utils.mergeObject(
      {
        attribute: '',
        attributeValue: 0,
        skill: '',
        skillValue: 0,
        gearBonus: 0,
        modifier: 0,
        difficulty: 0,
        canPush: true,
        rollType: 'standard',
        notes: '',
        actorId: null,
        gearItems: [],
        talentItems: [],
      },
      rollData,
    );
    this._resolve = null;
  }

  /* ------------------------------------------ */

  /** @override */
  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(_options) {
    const pool = buildPool({
      attribute: this.rollData.attributeValue,
      skill: this.rollData.skillValue,
      gearBonus: this.rollData.gearBonus,
      modifier: this.rollData.modifier,
    });

    return {
      ...this.rollData,
      totalPool: pool.totalPool,
      attributes: CONFIG.NEON_RELIC?.attributes ?? {},
      skills: CONFIG.NEON_RELIC?.skills ?? {},
      buttons: [{ type: 'submit', icon: 'fa-solid fa-dice', label: 'NEONRELIC.Roll.Roll' }],
    };
  }

  /* ------------------------------------------ */

  /**
   * Open the dialog and return a Promise that resolves with the roll result.
   * @param {object} rollData - Pre-filled roll configuration.
   * @param {object} [options] - ApplicationV2 options.
   * @returns {Promise<NRRollResult|null>} Roll result or null if cancelled.
   */
  static async prompt(rollData = {}, options = {}) {
    return new Promise(resolve => {
      const dialog = new NRRollDialog(rollData, options);
      dialog._resolve = resolve;
      dialog.addEventListener('close', () => {
        if (dialog._resolve) {
          dialog._resolve(null);
          dialog._resolve = null;
        }
      });
      dialog.render({ force: true });
    });
  }

  /* ------------------------------------------ */

  /**
   * @param {Event} _event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(_event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const pool = buildPool({
      attribute: Number(data.attributeValue) || 0,
      skill: Number(data.skillValue) || 0,
      gearBonus: Number(data.gearBonus) || 0,
      modifier: Number(data.modifier) || 0,
    });

    const result = await executeRoll(pool);

    const difficulty = Number(data.difficulty) || 0;
    const stuntPoints = Math.max(0, result.successes - difficulty);

    // Send to chat
    await sendRollToChat(result, {
      attribute: data.attribute || '',
      skill: data.skill || '',
      difficulty,
      notes: data.notes || '',
      actorId: this.rollData.actorId,
      stuntPoints,
    });

    // Open stunt picker if the roll generated stunt points
    if (stuntPoints > 0) {
      const actor = this.rollData.actorId ? game.actors.get(this.rollData.actorId) : null;
      NRStuntPicker.open({ stuntPoints, actor });
    }

    if (this._resolve) {
      this._resolve(result);
      this._resolve = null;
    }
  }
}
