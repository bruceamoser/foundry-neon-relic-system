/**
 * Vehicle sheet using ApplicationV2.
 * Displays speed, armor, reliability, wear tracking, and crew.
 * @module actor/vehicle/vehicle-sheet
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';

export class VehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, 'vehicle-sheet'],
    position: {
      width: 480,
      height: 'auto',
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/actor/vehicle/vehicle-sheet.hbs`,
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
    context.actor = this.document;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? '',
      {
        async: true,
        relativeTo: this.document,
      },
    );

    // Build wear pips for visual tracker
    const wearPips = [];
    for (let i = 1; i <= system.reliability; i++) {
      let cssClass = 'pip';
      if (i <= system.wear) {
        if (i >= system.stopsThreshold) cssClass += ' filled critical';
        else if (i >= system.problemThreshold) cssClass += ' filled warning';
        else cssClass += ' filled';
      }
      wearPips.push({ index: i, cssClass });
    }
    context.wearPips = wearPips;
    context.statusClass = system.isStopped ? 'stopped' : system.hasProblem ? 'problem' : '';

    return context;
  }
}
