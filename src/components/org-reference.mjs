/**
 * Organization Reference — ApplicationV2 window displaying all organizations
 * in the current case with milestones, dormancy, and strategy notes.
 * DA-only tool for managing faction trackers during play.
 * @module components/org-reference
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Organization Reference application window.
 */
export class OrgReferenceApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'org-reference',
    classes: ['neon-relic', 'org-reference'],
    position: { width: 640, height: 720 },
    window: { title: 'NEONRELIC.OrgRef.Title', resizable: true },
    actions: {
      advanceMilestone: OrgReferenceApp.#advanceMilestone,
      retreatMilestone: OrgReferenceApp.#retreatMilestone,
      toggleDormant: OrgReferenceApp.#toggleDormant,
    },
  };

  /** @override */
  static PARTS = {
    reference: { template: 'systems/neon-relic/templates/org-reference.hbs' },
  };

  /**
   * @param {object} caseData  Case data object containing organizations array
   * @param {object} [options]
   */
  constructor(caseData, options = {}) {
    super(options);
    this.caseData = caseData;
  }

  /** @override */
  async _prepareContext() {
    const orgs = this.caseData.organizations ?? [];
    return {
      organizations: orgs.map(org => ({
        ...org,
        statusClass: org.dormant ? 'dormant' : 'active',
        milestoneBoxes: Array.from({ length: org.maxCountdown ?? 8 }, (_, i) => {
          const filled = i < (org.countdown ?? 0);
          const isDanger = i >= (org.maxCountdown ?? 8) - 2;
          let boxClass = 'milestone-box';
          if (filled) boxClass += ' filled';
          if (isDanger) boxClass += ' danger';
          return { index: i, number: i + 1, boxClass };
        }),
      })),
    };
  }

  /* ── Actions ────────────────────────────────────── */

  /**
   * Advance an organization's countdown by 1.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #advanceMilestone(_event, target) {
    const orgId = target.dataset.orgId;
    const org = this.caseData.organizations?.find(o => o.id === orgId);
    if (!org) return;
    org.countdown = Math.min(org.maxCountdown ?? 8, (org.countdown ?? 0) + 1);
    this.render();
  }

  /**
   * Retreat an organization's countdown by 1.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #retreatMilestone(_event, target) {
    const orgId = target.dataset.orgId;
    const org = this.caseData.organizations?.find(o => o.id === orgId);
    if (!org) return;
    org.countdown = Math.max(0, (org.countdown ?? 0) - 1);
    this.render();
  }

  /**
   * Toggle dormancy for an organization.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #toggleDormant(_event, target) {
    const orgId = target.dataset.orgId;
    const org = this.caseData.organizations?.find(o => o.id === orgId);
    if (!org) return;
    org.dormant = !org.dormant;
    this.render();
  }
}
