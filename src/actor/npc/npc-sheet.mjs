/**
 * NPC (and entity) sheet using ApplicationV2.
 * Compact stat-block format with entity-specific collapsible fields.
 * @module actor/npc/npc-sheet
 */

import { NRRollDialog } from '../../components/roll/roll-dialog.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';

export class NPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, 'npc-sheet'],
    position: {
      width: 480,
      height: 'auto',
    },
    actions: {
      rollAttribute: NPCSheet.#onRollAttribute,
      adjustDisposition: NPCSheet.#onAdjustDisposition,
      toggleSimplified: NPCSheet.#onToggleSimplified,
      flipCard: NPCSheet.#onFlipCard,
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/actor/npc/npc-sheet.hbs`,
      scrollable: [''],
    },
  };

  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const system = actor.system;

    context.system = system;
    context.config = CONFIG.NEON_RELIC;
    context.isEditable = this.isEditable;
    context.actor = actor;
    context.isSimplified = system.useSimplifiedView;
    context.showBack = this._showBack ?? false;

    // Corruption stage label
    const stages = ['clean', 'touched', 'marked', 'consumed'];
    context.corruptionStageLabel = stages[system.corruptionStage] ?? 'clean';

    // Tier badge class
    context.tierClass = `tier-${system.tier}`;

    // Disposition pips (1-5)
    context.dispositionPips = [];
    for (let i = 1; i <= 5; i++) {
      context.dispositionPips.push({
        number: i,
        filled: i <= system.disposition,
        cssClass: i <= system.disposition ? 'pip filled' : 'pip',
      });
    }

    // Attribute entries for compact display
    context.attrEntries = [];
    for (const [key, label] of Object.entries(CONFIG.NEON_RELIC.attributes)) {
      context.attrEntries.push({
        key,
        label,
        value: system.attributes[key] ?? 0,
      });
    }

    // Broken state class
    context.brokenClass = system.isBroken ? 'broken-badge active' : 'broken-badge';

    // Enriched description
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? '',
      {
        async: true,
        relativeTo: actor,
      },
    );

    // Items
    context.abilities = actor.items.filter(i => i.type === 'talent');

    // Locations string for display
    context.locationsString = system.locations ?? '';

    return context;
  }

  /**
   * Track whether the card is flipped to show DA notes.
   * @type {boolean}
   */
  _showBack = false;

  /* ------------------------------------------ */
  /*  Action Handlers                            */
  /* ------------------------------------------ */

  /**
   * Roll an NPC attribute.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRollAttribute(_event, target) {
    const attrKey = target.dataset.attribute;
    const attrValue = this.document.system.attributes[attrKey] ?? 0;
    await NRRollDialog.prompt({
      attribute: attrKey,
      attributeValue: attrValue,
      actorId: this.document.id,
    });
  }

  /**
   * Adjust NPC disposition by +1 or -1.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAdjustDisposition(_event, target) {
    const delta = Number(target.dataset.delta) || 0;
    const current = this.document.system.disposition;
    const newVal = Math.clamp(current + delta, 1, 5);
    await this.document.update({ 'system.disposition': newVal });
  }

  /**
   * Toggle simplified humanoid view.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onToggleSimplified(_event, _target) {
    await this.document.update({
      'system.useSimplifiedView': !this.document.system.useSimplifiedView,
    });
  }

  /**
   * Flip between front (stat card) and back (DA notes).
   */
  static #onFlipCard() {
    this._showBack = !this._showBack;
    this.render();
  }
}
