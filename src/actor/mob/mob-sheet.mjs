/**
 * Mob sheet using ApplicationV2.
 * Shows grouped enemy stats with shared pool calculation.
 * @module actor/mob/mob-sheet
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';

export class MobSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, 'mob-sheet'],
    position: {
      width: 420,
      height: 'auto',
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/actor/mob/mob-sheet.hbs`,
      scrollable: [''],
    },
  };

  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;

    context.system = system;
    context.isEditable = this.isEditable;
    context.enrichedDescription = await TextEditor.enrichHTML(system.description ?? '', {
      async: true,
      relativeTo: this.document,
    });

    return context;
  }
}
