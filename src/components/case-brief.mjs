/**
 * Case Brief Viewer — ApplicationV2 window that presents case data
 * from a journal entry in either DA (full) or Player (redacted) view.
 * @module components/case-brief
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Case Brief viewer application window.
 */
export class CaseBriefApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'case-brief',
    classes: ['neon-relic', 'case-brief'],
    position: { width: 640, height: 720 },
    window: { title: 'NEONRELIC.CaseBrief.Title', resizable: true },
    actions: {
      toggleView: CaseBriefApp.#toggleView,
      toggleObjective: CaseBriefApp.#toggleObjective,
    },
  };

  /** @override */
  static PARTS = {
    brief: { template: 'systems/neon-relic/templates/case-brief.hbs' },
  };

  /**
   * @param {JournalEntry} journalEntry  The case journal entry
   * @param {object} [options]
   */
  constructor(journalEntry, options = {}) {
    super(options);
    this.journalEntry = journalEntry;
    this.caseData = journalEntry.system ?? {};
    /** @type {'da'|'player'} */
    this.viewMode = game.user.isGM ? 'da' : 'player';
  }

  /** @override */
  async _prepareContext() {
    const d = this.caseData;
    const isDa = this.viewMode === 'da';
    const isGM = game.user.isGM;

    // Enrich HTML fields
    const enrichedSummary = await TextEditor.enrichHTML(d.summary ?? '', { async: true });
    const enrichedNotes = await TextEditor.enrichHTML(d.notes ?? '', { async: true });

    return {
      caseData: d,
      caseName: this.journalEntry.name,
      isDa,
      isGM,
      viewMode: this.viewMode,
      headerClass: isDa ? 'da-view' : 'player-view',
      status: d.status ?? '',
      threatLevel: d.threatLevel ?? 0,
      summary: enrichedSummary,
      objectives: (d.objectives ?? []).map(o => ({
        ...o,
        liClass: o.complete ? 'completed' : '',
        canEdit: isGM,
      })),
      relics: d.relics ?? [],
      organizations: (d.organizations ?? []).map(o => ({
        ...o,
        showDa: isDa,
      })),
      notes: enrichedNotes,
    };
  }

  /* ── Actions ────────────────────────────────────── */

  /**
   * Toggle between DA and Player views (GM only).
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #toggleView(_event, _target) {
    if (!game.user.isGM) return;
    this.viewMode = this.viewMode === 'da' ? 'player' : 'da';
    this.render();
  }

  /**
   * Toggle an objective's completion state.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #toggleObjective(event, target) {
    if (!game.user.isGM) return;
    const idx = Number(target.dataset.index);
    const objectives = this.caseData.objectives ?? [];
    if (objectives[idx]) {
      objectives[idx].complete = !objectives[idx].complete;
      this.render();
    }
  }
}
