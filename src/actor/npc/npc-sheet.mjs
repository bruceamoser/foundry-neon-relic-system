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
      width: 520,
      height: 'auto',
    },
    actions: {
      rollAttribute: NPCSheet.#onRollAttribute,
      adjustDisposition: NPCSheet.#onAdjustDisposition,
      toggleSimplified: NPCSheet.#onToggleSimplified,
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    header: {
      template: `systems/${SYSTEM_ID}/templates/actor/npc/npc-header.hbs`,
    },
    stats: {
      template: `systems/${SYSTEM_ID}/templates/actor/npc/npc-stats.hbs`,
      scrollable: [''],
    },
    entity: {
      template: `systems/${SYSTEM_ID}/templates/actor/npc/npc-entity.hbs`,
      scrollable: [''],
    },
    card: {
      template: `systems/${SYSTEM_ID}/templates/actor/npc/npc-card.hbs`,
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
    context.isSimplified = system.useSimplifiedView;

    // Corruption stage label
    const stages = ['clean', 'touched', 'marked', 'consumed'];
    context.corruptionStageLabel = stages[system.corruptionStage] ?? 'clean';

    // Enriched description
    context.enrichedDescription = await TextEditor.enrichHTML(system.description ?? '', {
      async: true,
      relativeTo: actor,
    });

    // Items
    context.abilities = actor.items.filter(i => i.type === 'talent');

    return context;
  }

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
}
