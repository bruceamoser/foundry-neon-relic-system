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
        difficulty: 1,
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

    const isLocked = !!(this.rollData.attribute || this.rollData.skill);
    const attrConfig = CONFIG.NEON_RELIC?.attributes ?? {};
    const skillConfig = CONFIG.NEON_RELIC?.skills ?? {};
    const lockedAttrLabel = this.rollData.attribute
      ? game.i18n.localize(attrConfig[this.rollData.attribute] ?? this.rollData.attribute)
      : '';
    const lockedSkillLabel = this.rollData.skill
      ? game.i18n.localize(skillConfig[this.rollData.skill]?.label ?? this.rollData.skill)
      : '';

    return {
      ...this.rollData,
      totalPool: pool.totalPool,
      poolBase: pool.baseDice,
      poolSkill: pool.skillDice,
      poolExtra: pool.extraDice,
      poolGear: pool.gearDice,
      isLocked,
      lockedAttrLabel,
      lockedSkillLabel,
      attributes: attrConfig,
      skills: skillConfig,
      buttons: [{ type: 'submit', icon: 'fa-solid fa-dice', label: 'NEONRELIC.Roll.Roll' }],
    };
  }

  /* ------------------------------------------ */

  /** @override */
  _onRender(_context, _options) {
    const form = this.element;
    if (!form) return;

    const poolValue = form.querySelector('.nr-roll-dialog__pool-value');
    const poolDetail = form.querySelector('.nr-roll-dialog__pool-detail');
    const gearSelect = form.querySelector('[name="gearItemId"]');
    const modifierInput = form.querySelector('[name="modifier"]');

    if (!poolValue || !poolDetail) return;

    /**
     * Recalculate and update the pool display from current form state.
     */
    const refreshPool = () => {
      const attrVal = Number(form.querySelector('[name="attributeValue"]')?.value) || 0;
      const skillVal = Number(form.querySelector('[name="skillValue"]')?.value) || 0;
      let gearVal = 0;
      if (gearSelect?.value) {
        const selectedOption = gearSelect.options[gearSelect.selectedIndex];
        gearVal = Number(selectedOption?.dataset?.bonus) || 0;
      }
      const modVal = Number(modifierInput?.value) || 0;
      const pool = buildPool({ attribute: attrVal, skill: skillVal, gearBonus: gearVal, modifier: modVal });

      poolValue.textContent = pool.totalPool;

      // Rebuild chips from the actual dice groups the roll will use
      let chips = `<span class="nr-pool-chip nr-pool-chip--base">${game.i18n.localize('NEONRELIC.Roll.BaseDice')}: ${pool.baseDice}</span>`;
      chips += `<span class="nr-pool-plus">+</span>`;
      chips += `<span class="nr-pool-chip nr-pool-chip--skill">${game.i18n.localize('NEONRELIC.Roll.SkillDice')}: ${pool.skillDice}</span>`;
      if (pool.extraDice > 0) {
        chips += `<span class="nr-pool-plus">+</span>`;
        chips += `<span class="nr-pool-chip nr-pool-chip--extra">${game.i18n.localize('NEONRELIC.Roll.ExtraDice')}: ${pool.extraDice}</span>`;
      }
      if (pool.gearDice > 0) {
        chips += `<span class="nr-pool-plus">+</span>`;
        chips += `<span class="nr-pool-chip nr-pool-chip--gear">${game.i18n.localize('NEONRELIC.Roll.GearDice')}: ${pool.gearDice}</span>`;
      }
      poolDetail.innerHTML = chips;
    };

    if (gearSelect) gearSelect.addEventListener('change', refreshPool);
    if (modifierInput) modifierInput.addEventListener('input', refreshPool);
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

    // Resolve gear bonus from selected item or manual input
    let gearBonus = 0;
    let gearItemId = null;
    if (data.gearItemId) {
      gearItemId = data.gearItemId;
      const gearEntry = this.rollData.gearItems.find(g => g.id === gearItemId);
      gearBonus = gearEntry?.bonus ?? 0;
    } else {
      gearBonus = Number(data.gearBonus) || 0;
    }

    const pool = buildPool({
      attribute: Number(data.attributeValue) || 0,
      skill: Number(data.skillValue) || 0,
      gearBonus,
      modifier: Number(data.modifier) || 0,
    });

    const result = await executeRoll(pool);

    const difficulty = Number(data.difficulty) || 0;
    const stuntPoints = Math.max(0, result.successes - difficulty);

    // ── Gear Degradation ──
    // An item degrades ONLY when its own Gear Dice were rolled in the pool
    // AND at least one of them shows a 1 on the initial roll. Rolling with an
    // item (usage) never degrades it, and pushes never degrade it either.
    // GMs can disable auto-degradation with the world setting.
    let gearDamage = null;
    const degradationEnabled = game.settings.get('neon-relic', 'gearDegradation');
    const gearDiceRolled = pool.gearDice > 0;
    const gearDieShowedOne = result.gearOnes > 0;
    if (degradationEnabled && gearDiceRolled && gearDieShowedOne && gearItemId && this.rollData.actorId) {
      const actor = game.actors.get(this.rollData.actorId);
      if (actor) {
        const gearItem = actor.items.get(gearItemId);
        if (gearItem && (gearItem.type === 'weapon' || gearItem.type === 'gear')) {
          await gearItem.degradeGear();
          // Re-fetch the item from the actor to get updated system data
          const updatedItem = actor.items.get(gearItemId);
          const afterBonus = updatedItem?.system.gearBonus.value ?? 0;
          const isBroken = updatedItem?.system.isBroken ?? false;
          gearDamage = {
            itemName: gearItem.name,
            itemId: gearItem.id,
            ones: result.gearOnes,
            isBroken,
            newBonus: afterBonus,
          };
        }
      }
    }

    // Auto-roll ammo/consumable die ONLY when a specific gear item was selected
    let ammoDieResult = null;
    if (gearItemId && this.rollData.actorId) {
      const actor = game.actors.get(this.rollData.actorId);
      if (actor) {
        const selectedItem = actor.items.get(gearItemId);
        if (selectedItem) {
          // Prefer a healthy linked consumable; otherwise fall back to the
          // weapon's built-in Ammo Die so ammo is always rolled when used.
          const linkedId = selectedItem.system.linkedConsumableId;
          const linkedConsumable = linkedId ? actor.items.get(linkedId) : null;
          const useLinked =
            linkedConsumable && linkedConsumable.type === 'consumable' && !linkedConsumable.system.isDepleted;

          if (useLinked) {
            const result = await linkedConsumable.useConsumable();
            ammoDieResult = {
              weaponName: selectedItem.name,
              die: result.die,
              roll: result.rolled,
              stepped: result.stepped,
              newDie: result.newDie,
              depleted: result.depleted,
            };
          } else if (
            selectedItem.type === 'weapon' &&
            selectedItem.system.ammoDie?.current &&
            selectedItem.system.ammoDie.current !== 'depleted'
          ) {
            // Built-in Ammo Die on weapons (rolls on 1–2 to step down)
            const result = await selectedItem.rollAmmoDie();
            ammoDieResult = {
              weaponName: selectedItem.name,
              die: result.die,
              roll: result.rolled,
              stepped: result.stepped,
              newDie: result.newDie,
              depleted: result.depleted,
            };
          }
        }
      }
    }

    // Send to chat
    await sendRollToChat(result, {
      attribute: data.attribute || '',
      skill: data.skill || '',
      difficulty,
      notes: data.notes || '',
      actorId: this.rollData.actorId,
      stuntPoints,
      ammoDieResult,
      gearDamage,
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
