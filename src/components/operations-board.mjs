/**
 * Operations Board — ApplicationV2 window for managing case file organizations,
 * countdowns, cross-links, NPC tracker, and information cards.
 * @module components/operations-board
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Operations Board application window.
 */
export class OperationsBoard extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'operations-board',
    classes: ['neon-relic', 'operations-board'],
    position: { width: 800, height: 600 },
    window: { title: 'NEONRELIC.OpsBoard.Title', resizable: true },
    actions: {
      advanceShift: OperationsBoard.#advanceShift,
      advanceOrg: OperationsBoard.#advanceOrg,
      toggleDormant: OperationsBoard.#toggleDormant,
      flipCard: OperationsBoard.#flipCard,
    },
  };

  /** @override */
  static PARTS = {
    board: { template: 'systems/neon-relic/templates/operations-board.hbs' },
  };

  /**
   * The case data stored in a JournalEntry or flag.
   * @type {object}
   */
  caseData = {
    organizations: [],
    informationCards: [],
    containmentTruths: { trigger: false, appetite: false, quiescence: false },
    currentShift: 1,
  };

  /**
   * @param {object} [options={}]
   * @param {object} [options.caseData] - Pre-loaded case data.
   */
  constructor(options = {}) {
    super(options);
    if (options.caseData) this.caseData = foundry.utils.mergeObject(this.caseData, options.caseData);
  }

  /** @override */
  async _prepareContext() {
    return {
      caseData: this.caseData,
      organizations: this.caseData.organizations,
      informationCards: this.caseData.informationCards,
      containmentTruths: this.caseData.containmentTruths,
      currentShift: this.caseData.currentShift,
      allContainmentTruthsFound:
        this.caseData.containmentTruths.trigger &&
        this.caseData.containmentTruths.appetite &&
        this.caseData.containmentTruths.quiescence,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    // Populate countdown tracks (avoids ../ Glimmer limitation)
    const tracks = this.element.querySelectorAll('.countdown-track');
    for (const track of tracks) {
      const current = Number(track.dataset.current) || 0;
      let html = '';
      for (let i = 1; i <= 14; i++) {
        html += `<div class="countdown-square" data-filled="${i <= current}">${i}</div>`;
      }
      track.innerHTML = html;
    }
  }

  /**
   * Advance all active organizations by 1 (shift advancement).
   * Checks for milestone triggers and cross-link cascades.
   */
  static async #advanceShift() {
    const board = this;
    board.caseData.currentShift += 1;

    for (const org of board.caseData.organizations) {
      if (org.dormant) continue;
      await OperationsBoard.advanceOrganization(board, org.id, 1);
    }

    board.render();

    // Chat notification
    await ChatMessage.create({
      content: `<div class="ops-board-shift">
        <strong>${game.i18n.localize('NEONRELIC.OpsBoard.ShiftAdvanced')}</strong>:
        ${game.i18n.localize('NEONRELIC.OpsBoard.Shift')} ${board.caseData.currentShift}
      </div>`,
    });
  }

  /**
   * Advance a specific organization.
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #advanceOrg(event, target) {
    const board = this;
    const orgId = target.dataset.orgId;
    await OperationsBoard.advanceOrganization(board, orgId, 1);
    board.render();
  }

  /**
   * Toggle dormant status of an organization.
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #toggleDormant(event, target) {
    const board = this;
    const orgId = target.dataset.orgId;
    const org = board.caseData.organizations.find(o => o.id === orgId);
    if (org) {
      org.dormant = !org.dormant;
      board.render();
    }
  }

  /**
   * Flip an information card between DA/player views.
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #flipCard(event, target) {
    const board = this;
    const cardId = target.dataset.cardId;
    const card = board.caseData.informationCards.find(c => c.id === cardId);
    if (card) {
      card.revealed = !card.revealed;
      board.render();
    }
  }

  /**
   * Advance an organization's countdown and process milestones/cross-links.
   * @param {OperationsBoard} board
   * @param {string} orgId
   * @param {number} amount
   */
  static async advanceOrganization(board, orgId, amount) {
    const org = board.caseData.organizations.find(o => o.id === orgId);
    if (!org || org.dormant) return;

    const oldValue = org.currentValue;
    org.currentValue = Math.min(14, org.currentValue + amount);

    // Check milestones between old and new values
    for (const milestone of org.milestones ?? []) {
      if (milestone.position > oldValue && milestone.position <= org.currentValue) {
        // Milestone triggered
        await ChatMessage.create({
          content: `<div class="ops-milestone">
            <strong>${org.name}</strong>: ${milestone.label}
            <br>${milestone.consequenceText ?? ''}
          </div>`,
        });

        // Process cross-links
        for (const link of milestone.crossLinks ?? []) {
          await OperationsBoard.advanceOrganization(board, link.targetOrgId, link.advancementAmount);
        }
      }
    }
  }

  /**
   * Create a default organization structure.
   * @param {string} id
   * @param {string} name
   * @param {number} startingValue
   * @returns {object}
   */
  static createOrganization(id, name, startingValue = 1) {
    return {
      id,
      name,
      startingValue,
      currentValue: startingValue,
      milestones: [],
      dormant: false,
      activationCondition: '',
    };
  }

  /**
   * Create a default information card.
   * @param {string} id
   * @param {object} data
   * @returns {object}
   */
  static createInformationCard(
    id,
    { content = '', foundAt = '', knownBy = '', hqFallback = 0, type = 'supportingIntel' } = {},
  ) {
    return {
      id,
      content,
      foundAt,
      knownBy,
      hqFallback,
      type,
      revealed: false,
    };
  }
}
