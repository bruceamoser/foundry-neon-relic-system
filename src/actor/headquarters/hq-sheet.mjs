/**
 * Headquarters sheet using ApplicationV2.
 * Displays standing, threat, vault, upgrades, and personnel.
 * @module actor/headquarters/hq-sheet
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';

export class HeadquartersSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, 'hq-sheet'],
    position: {
      width: 600,
      height: 700,
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/actor/hq/hq-sheet.hbs`,
      scrollable: ['.hq-body'],
    },
  };

  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;

    context.system = system;
    context.isEditable = this.isEditable;

    // Standing rank label
    const rankKeys = {
      unknown: 'NEONRELIC.HQ.Rank.Unknown',
      acknowledged: 'NEONRELIC.HQ.Rank.Acknowledged',
      trusted: 'NEONRELIC.HQ.Rank.Trusted',
      honored: 'NEONRELIC.HQ.Rank.Honored',
      covenantElite: 'NEONRELIC.HQ.Rank.CovenantElite',
    };
    context.standingRankLabel = game.i18n.localize(rankKeys[system.standingRank] ?? rankKeys.unknown);

    context.enrichedDescription = await TextEditor.enrichHTML(system.description ?? '', {
      async: true,
      relativeTo: this.document,
    });

    return context;
  }
}
