/**
 * Character Creation Wizard — multi-step ApplicationV2 dialog.
 * Guides players through a 10-step character creation process.
 * @module actor/agent/creation-wizard
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SYSTEM_ID = 'neon-relic';

/**
 * Wizard step definitions. Each step will get its own template and logic
 * in subsequent issues (#236–#243, #249).
 * @type {Array<{id: string, label: string, icon: string}>}
 */
const STEPS = [
  { id: 'identity', label: 'NEONRELIC.Wizard.Identity.Title', icon: 'fa-solid fa-id-card' },
  { id: 'division', label: 'NEONRELIC.Wizard.Division.Title', icon: 'fa-solid fa-sitemap' },
  { id: 'subunit', label: 'NEONRELIC.Wizard.SubUnit.Title', icon: 'fa-solid fa-users' },
  { id: 'specialty', label: 'NEONRELIC.Wizard.Specialty.Title', icon: 'fa-solid fa-bullseye' },
  { id: 'gear', label: 'NEONRELIC.Wizard.Gear.Title', icon: 'fa-solid fa-briefcase' },
  { id: 'attributes', label: 'NEONRELIC.Wizard.Attributes.Title', icon: 'fa-solid fa-chart-bar' },
  { id: 'skills', label: 'NEONRELIC.Wizard.Skills.Title', icon: 'fa-solid fa-cogs' },
  { id: 'talents', label: 'NEONRELIC.Wizard.Talents.Title', icon: 'fa-solid fa-bolt' },
  { id: 'anchorsecret', label: 'NEONRELIC.Wizard.AnchorSecret.Title', icon: 'fa-solid fa-anchor' },
  { id: 'summary', label: 'NEONRELIC.Wizard.Summary.Title', icon: 'fa-solid fa-clipboard-check' },
];

export class CreationWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {Actor} actor  The agent actor being created.
   * @param {object} [options]  Additional application options.
   */
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.#currentStep = 0;
  }

  /** The current step index (0-based). */
  #currentStep;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'creation-wizard-{id}',
    classes: [SYSTEM_ID, 'creation-wizard'],
    tag: 'form',
    window: {
      title: 'NEONRELIC.Wizard.Title',
      icon: 'fa-solid fa-wand-magic-sparkles',
      resizable: true,
    },
    position: {
      width: 640,
      height: 560,
    },
    actions: {
      next: CreationWizard.#onNext,
      back: CreationWizard.#onBack,
      cancel: CreationWizard.#onCancel,
      complete: CreationWizard.#onComplete,
    },
    form: {
      submitOnChange: true,
      handler: CreationWizard.#onFormSubmit,
    },
  };

  /** @override */
  static PARTS = {
    wizard: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/wizard/wizard-shell.hbs`,
      scrollable: ['.wizard-step-content'],
    },
  };

  /* ------------------------------------------ */
  /*  Getters                                   */
  /* ------------------------------------------ */

  /** @returns {number} The current step index. */
  get currentStep() {
    return this.#currentStep;
  }

  /** @returns {object} The current step definition. */
  get stepConfig() {
    return STEPS[this.#currentStep];
  }

  /** @returns {boolean} Is this the first step? */
  get isFirstStep() {
    return this.#currentStep === 0;
  }

  /** @returns {boolean} Is this the last step (Summary)? */
  get isLastStep() {
    return this.#currentStep === STEPS.length - 1;
  }

  /* ------------------------------------------ */
  /*  Rendering                                 */
  /* ------------------------------------------ */

  /** @override */
  get title() {
    return game.i18n.localize('NEONRELIC.Wizard.Title');
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.config = CONFIG.NEON_RELIC;
    context.steps = STEPS;
    context.currentStep = this.#currentStep;
    context.stepConfig = this.stepConfig;
    context.isFirstStep = this.isFirstStep;
    context.isLastStep = this.isLastStep;
    context.stepLabel = game.i18n.format('NEONRELIC.Wizard.StepOf', {
      current: this.#currentStep + 1,
      total: STEPS.length,
    });

    // Pre-compute step CSS states for the progress bar
    context.stepStates = STEPS.map((_, i) => {
      if (i === this.#currentStep) return 'active';
      if (i < this.#currentStep) return 'completed';
      return '';
    });

    // Render step-specific content
    await this.#prepareStepContext(context);
    context.stepContent = await this.#renderStepContent(context);

    return context;
  }

  /**
   * Prepare step-specific context data.
   * @param {object} context  The context to augment.
   */
  async #prepareStepContext(context) {
    const system = this.actor.system;

    switch (this.stepConfig.id) {
      case 'division': {
        // Build division choice cards
        const subdivisions = this.actor.items.filter(i => i.type === 'subdivision');
        context.divisionChoices = Object.entries(CONFIG.NEON_RELIC.divisions).map(([key, label]) => {
          const sub = subdivisions.find(s => s.system.division === key);
          return {
            key,
            label: game.i18n.localize(label),
            baseCL: sub?.system.baseCL ?? 2,
            selected: system.division === key,
            cssClass: system.division === key ? 'selected' : '',
            checkedAttr: system.division === key ? 'checked' : '',
          };
        });
        break;
      }

      case 'subunit': {
        // Filter subdivisions by selected division
        const pack = game.packs.get('neon-relic.subdivisions');
        const allSubs = pack ? await pack.getDocuments() : [];
        context.subUnitChoices = allSubs
          .filter(s => s.system.division === system.division)
          .map(s => ({
            id: s.id,
            name: s.name,
            keySkill: s.system.keySkill,
            keySkillLabel: s.system.keySkill
              ? game.i18n.localize(CONFIG.NEON_RELIC.skills[s.system.keySkill]?.label ?? '')
              : '',
            baseCL: s.system.baseCL,
            selected: system.subUnit === s.name,
            cssClass: system.subUnit === s.name ? 'selected' : '',
          }));
        break;
      }

      case 'specialty': {
        // Filter specialties from current subdivision
        const pack = game.packs.get('neon-relic.subdivisions');
        const allSubs = pack ? await pack.getDocuments() : [];
        const currentSub = allSubs.find(s => s.name === system.subUnit);
        context.specialtyChoices = (currentSub?.system.specialties ?? []).map(sp => ({
          name: sp,
          selected: system.specialty === sp,
          cssClass: system.specialty === sp ? 'selected' : '',
        }));
        break;
      }

      case 'gear': {
        // List starting gear from items
        context.gearItems = this.actor.items.filter(
          i => i.type === 'gear' || i.type === 'weapon' || i.type === 'armor' || i.type === 'consumable',
        );
        context.divisionItem = this.actor.items.find(i => i.type === 'divisionItem') ?? null;
        break;
      }

      case 'attributes': {
        context.attributes = {};
        for (const [key, cfg] of Object.entries(CONFIG.NEON_RELIC.attributes)) {
          context.attributes[key] = {
            key,
            label: game.i18n.localize(cfg.label),
            value: system.attributes[key].max,
          };
        }
        context.attrBudget = system.budget;
        break;
      }

      case 'skills': {
        context.skillList = [];
        const sub = this.actor.items.find(i => i.type === 'subdivision');
        const keySkill = sub?.system.keySkill ?? '';
        for (const [key, cfg] of Object.entries(CONFIG.NEON_RELIC.skills)) {
          context.skillList.push({
            key,
            label: game.i18n.localize(cfg.label),
            value: system.skills[key] ?? 0,
            isKeySkill: key === keySkill,
            max: key === keySkill ? 4 : 3,
            cssClass: key === keySkill ? 'key-skill' : '',
          });
        }
        context.skillBudget = system.budget;
        context.keySkillName = keySkill ? game.i18n.localize(CONFIG.NEON_RELIC.skills[keySkill]?.label ?? '') : '';
        break;
      }

      case 'talents': {
        context.talentSlots = this.actor.items.filter(i => i.type === 'talent');
        break;
      }

      case 'anchorsecret': {
        context.anchor = this.actor.items.find(i => i.type === 'anchor') ?? null;
        context.darkSecret = this.actor.items.find(i => i.type === 'darkSecret') ?? null;
        break;
      }

      case 'summary': {
        // Gather summary data
        const sub = this.actor.items.find(i => i.type === 'subdivision');
        context.summaryDivision = system.division
          ? game.i18n.localize(CONFIG.NEON_RELIC.divisions[system.division] ?? '')
          : '';
        context.summarySubUnit = system.subUnit || '';
        context.summarySpecialty = system.specialty || '';
        context.summaryAnchor = this.actor.items.find(i => i.type === 'anchor')?.name ?? '';
        context.summaryDarkSecret = this.actor.items.find(i => i.type === 'darkSecret')?.name ?? '';
        context.summaryTalents = this.actor.items.filter(i => i.type === 'talent').map(t => t.name);
        context.summaryKeySkill = sub?.system.keySkill ?? '';
        break;
      }
    }
  }

  /**
   * Render the content for the current wizard step.
   * @param {object} context  The prepared context.
   * @returns {Promise<string>}  Rendered HTML for the step body.
   */
  async #renderStepContent(context) {
    const stepId = this.stepConfig.id;
    const templatePath = `systems/${SYSTEM_ID}/templates/actor/agent/wizard/step-${stepId}.hbs`;

    // Check if the step template exists; fall back to a placeholder
    const templates = Handlebars.partials;
    if (!templates[templatePath]) {
      try {
        await foundry.applications.handlebars.loadTemplates([templatePath]);
      } catch {
        return `<p class="step-placeholder"><em>Step "${stepId}" content pending implementation.</em></p>`;
      }
    }

    return foundry.applications.handlebars.renderTemplate(templatePath, context);
  }

  /* ------------------------------------------ */
  /*  Navigation Actions                        */
  /* ------------------------------------------ */

  /**
   * Handle form submission — save form data to the actor.
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onFormSubmit(_event, form, formData) {
    const updateData = foundry.utils.expandObject(formData.object);
    await this.actor.update(updateData);
  }

  /**
   * Advance to the next wizard step.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onNext(_event, _target) {
    if (this.isLastStep) return;
    this.#currentStep++;
    this.render();
  }

  /**
   * Return to the previous wizard step.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onBack(_event, _target) {
    if (this.isFirstStep) return;
    this.#currentStep--;
    this.render();
  }

  /**
   * Cancel the wizard and close without saving.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onCancel(_event, _target) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'NEONRELIC.Wizard.Title' },
      content: game.i18n.localize('NEONRELIC.Wizard.CancelConfirm'),
    });
    if (confirmed) this.close();
  }

  /**
   * Complete character creation — mark agent as complete.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onComplete(_event, _target) {
    await this.actor.update({ 'system.creationComplete': true });
    ui.notifications.info(game.i18n.localize('NEONRELIC.Wizard.Summary.Success'));
    this.close();
  }

  /**
   * Navigate to a specific step by index.
   * @param {number} stepIndex  The step index to navigate to.
   */
  goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= STEPS.length) return;
    this.#currentStep = stepIndex;
    this.render();
  }
}
