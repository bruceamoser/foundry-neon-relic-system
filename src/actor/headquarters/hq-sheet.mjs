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

    // Standing pips (0-20 in groups of 5)
    const standingPips = [];
    for (let i = 1; i <= 20; i++) {
      let cssClass = 'pip';
      if (i <= system.standing) cssClass += ' filled';
      if (i === 5 || i === 10 || i === 15 || i === 20) cssClass += ' milestone';
      standingPips.push({ index: i, cssClass });
    }
    context.standingPips = standingPips;

    // Threat pips (0-6) — color-coded
    const threatPips = [];
    for (let i = 1; i <= 6; i++) {
      let cssClass = 'pip';
      if (i <= system.threat) {
        if (i >= 5) cssClass += ' filled critical';
        else if (i >= 3) cssClass += ' filled warning';
        else cssClass += ' filled';
      }
      threatPips.push({ index: i, cssClass });
    }
    context.threatPips = threatPips;

    context.enrichedDescription = await TextEditor.enrichHTML(system.description ?? '', {
      async: true,
      relativeTo: this.document,
    });

    return context;
  }
}
