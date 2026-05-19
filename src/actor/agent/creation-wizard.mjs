/**
 * Character Creation Wizard — multi-step ApplicationV2 dialog.
 * Guides players through a 10-step character creation process.
 * @module actor/agent/creation-wizard
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SYSTEM_ID = 'neon-relic';

/**
 * Division key attribute mapping.
 * Wayfinder→Wits, Recovery→Agility, Keep→Empathy.
 */
const DIVISION_KEY_ATTRIBUTES = {
  wayfinder: 'wit',
  recovery: 'agi',
  keep: 'emp',
};

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
    this.#snapshot = this.#takeSnapshot();
  }

  /** The current step index (0-based). */
  #currentStep;

  /** Snapshot of key actor data for change detection. */
  #snapshot;

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
      width: 720,
      height: 640,
    },
    actions: {
      next: CreationWizard.#onNext,
      back: CreationWizard.#onBack,
      cancel: CreationWizard.#onCancel,
      complete: CreationWizard.#onComplete,
      openTalentCompendium: CreationWizard.#onOpenTalentCompendium,
      removeTalent: CreationWizard.#onRemoveTalent,
      rollAnchor: CreationWizard.#onRollAnchor,
      customAnchor: CreationWizard.#onCustomAnchor,
      removeAnchor: CreationWizard.#onRemoveItem,
      openDarkSecretCompendium: CreationWizard.#onOpenDarkSecretCompendium,
      removeDarkSecret: CreationWizard.#onRemoveItem,
      viewItem: CreationWizard.#onViewItem,
      viewCompendiumItem: CreationWizard.#onViewCompendiumItem,
      adjustWizardAttribute: CreationWizard.#onAdjustWizardAttribute,
      adjustWizardSkill: CreationWizard.#onAdjustWizardSkill,
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
    context.steps = STEPS.map((step, i) => ({ ...step, number: i + 1 }));
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
            description: game.i18n.localize(`NEONRELIC.Wizard.Division.Desc.${key}`),
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
            uuid: s.uuid,
            name: s.name,
            description: s.system.description ?? '',
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
          name: sp.label ?? sp,
          selected: system.specialty === (sp.label ?? sp),
          cssClass: system.specialty === (sp.label ?? sp) ? 'selected' : '',
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
        const keyAttr = DIVISION_KEY_ATTRIBUTES[system.division] ?? '';
        context.attributes = {};
        for (const [key, label] of Object.entries(CONFIG.NEON_RELIC.attributes)) {
          const value = system.attributes[key].max;
          const isKeyAttr = key === keyAttr;
          const max = isKeyAttr ? 5 : 4;
          context.attributes[key] = {
            key,
            label: game.i18n.localize(label),
            value,
            isKeyAttr,
            max,
            canIncrease: value < max && system.budget.attrRemaining > 0,
            canDecrease: value > 2,
            disabledPlus: value >= max || system.budget.attrRemaining <= 0 ? 'disabled' : '',
            disabledMinus: value <= 2 ? 'disabled' : '',
            cssClass: isKeyAttr ? 'key-attribute' : '',
          };
        }
        context.attrBudget = system.budget;
        context.attrBudgetOver = system.budget.attrRemaining < 0;
        context.budgetClass = system.budget.attrRemaining < 0 ? 'over-budget' : '';
        context.keyAttrName = keyAttr ? game.i18n.localize(CONFIG.NEON_RELIC.attributes[keyAttr] ?? '') : '';
        break;
      }

      case 'skills': {
        // Look up key skill from the subdivision compendium
        const pack = game.packs.get('neon-relic.subdivisions');
        const allSubs = pack ? await pack.getDocuments() : [];
        const sub = allSubs.find(s => s.name === system.subUnit);
        const keySkill = sub?.system.keySkill ?? '';

        // Group skills by parent attribute into columns
        const columnMap = {};
        for (const [attrKey, attrLabel] of Object.entries(CONFIG.NEON_RELIC.attributes)) {
          columnMap[attrKey] = {
            attrKey,
            attrLabel: game.i18n.localize(attrLabel),
            attrValue: system.attributes[attrKey].max,
            skills: [],
          };
        }
        for (const [key, cfg] of Object.entries(CONFIG.NEON_RELIC.skills)) {
          const value = system.skills[key] ?? 0;
          const isKey = key === keySkill;
          const max = isKey ? 4 : 3;
          columnMap[cfg.attribute].skills.push({
            key,
            label: game.i18n.localize(cfg.label),
            value,
            isKeySkill: isKey,
            max,
            disabledPlus: value >= max || system.budget.skillRemaining <= 0 ? 'disabled' : '',
            disabledMinus: value <= 0 ? 'disabled' : '',
            cssClass: isKey ? 'key-skill' : '',
          });
        }
        context.skillColumns = Object.values(columnMap);
        context.skillBudget = system.budget;
        context.skillBudgetClass = system.budget.skillRemaining < 0 ? 'over-budget' : '';
        context.keySkillName = keySkill ? game.i18n.localize(CONFIG.NEON_RELIC.skills[keySkill]?.label ?? '') : '';
        context.skillsDescription = game.i18n.format('NEONRELIC.Wizard.Skills.Description', {
          keySkill: context.keySkillName || '—',
        });
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
        context.summaryAttributes = Object.entries(CONFIG.NEON_RELIC.attributes).map(([key, label]) => ({
          label: game.i18n.localize(label),
          value: system.attributes[key].max,
        }));
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
  /*  State Management                          */
  /* ------------------------------------------ */

  /**
   * Take a snapshot of key actor data for change detection.
   * @returns {object}  The snapshot object.
   */
  #takeSnapshot() {
    const s = this.actor.system;
    return {
      ageGroup: s.ageGroup,
      division: s.division,
      subUnit: s.subUnit,
    };
  }

  /**
   * Detect upstream changes and reset downstream data.
   * Called when advancing from the current step.
   */
  async #resetDownstream() {
    const prev = this.#snapshot;
    const curr = this.#takeSnapshot();
    const updates = {};
    const itemsToDelete = [];

    // Step 0 (Identity): age group changed → reset attributes and skills
    if (prev.ageGroup !== curr.ageGroup) {
      updates['system.attributes.str.max'] = 3;
      updates['system.attributes.agi.max'] = 3;
      updates['system.attributes.wit.max'] = 3;
      updates['system.attributes.emp.max'] = 3;
      for (const key of Object.keys(CONFIG.NEON_RELIC.skills)) {
        updates[`system.skills.${key}`] = 0;
      }
    }

    // Step 1 (Division): division changed → clear sub-unit, specialty, Slot 1 & 2 talents
    if (prev.division !== curr.division) {
      updates['system.subUnit'] = '';
      updates['system.specialty'] = '';
      // Remove division and sub-unit talents (Slots 1 & 2)
      for (const item of this.actor.items) {
        if (item.type === 'talent' && (item.system.talentType === 'division' || item.system.talentType === 'subunit')) {
          itemsToDelete.push(item.id);
        }
        // Remove division-specific gear
        if (item.type === 'divisionItem') {
          itemsToDelete.push(item.id);
        }
      }
    }

    // Step 2 (Sub-Unit): sub-unit changed → clear specialty, Slot 2 talent
    if (prev.subUnit !== curr.subUnit) {
      updates['system.specialty'] = '';
      // Remove sub-unit talents (Slot 2 only)
      if (prev.division === curr.division) {
        for (const item of this.actor.items) {
          if (item.type === 'talent' && item.system.talentType === 'subunit') {
            itemsToDelete.push(item.id);
          }
        }
      }
    }

    // Apply updates
    if (Object.keys(updates).length) {
      await this.actor.update(updates);
    }
    if (itemsToDelete.length) {
      await this.actor.deleteEmbeddedDocuments('Item', itemsToDelete);
    }

    // Update snapshot
    this.#snapshot = this.#takeSnapshot();
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
   * Adjust a wizard attribute by +1 or -1 via the +/− buttons.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAdjustWizardAttribute(_event, target) {
    const attr = target.dataset.attr;
    const delta = Number(target.dataset.delta);
    if (!attr || !delta) return;

    const system = this.actor.system;
    const current = system.attributes[attr]?.max ?? 2;
    const keyAttr = DIVISION_KEY_ATTRIBUTES[system.division] ?? '';
    const max = attr === keyAttr ? 5 : 4;
    const newValue = Math.clamp(current + delta, 2, max);
    if (newValue === current) return;

    // Check budget on increase
    if (delta > 0 && system.budget.attrRemaining <= 0) return;

    await this.actor.update({ [`system.attributes.${attr}.max`]: newValue });
    this.render();
  }

  /**
   * Adjust a wizard skill by +1 or -1 via the +/− buttons.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAdjustWizardSkill(_event, target) {
    const skill = target.dataset.skill;
    const delta = Number(target.dataset.delta);
    if (!skill || !delta) return;

    const system = this.actor.system;
    const current = system.skills[skill] ?? 0;
    const pack = game.packs.get('neon-relic.subdivisions');
    const allSubs = pack ? await pack.getDocuments() : [];
    const sub = allSubs.find(s => s.name === system.subUnit);
    const keySkill = sub?.system.keySkill ?? '';
    const max = skill === keySkill ? 4 : 3;
    const newValue = Math.clamp(current + delta, 0, max);
    if (newValue === current) return;

    // Check budget on increase
    if (delta > 0 && system.budget.skillRemaining <= 0) return;

    await this.actor.update({ [`system.skills.${skill}`]: newValue });
    this.render();
  }

  /**
   * Advance to the next wizard step.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onNext(_event, _target) {
    if (this.isLastStep) return;

    // Validate attribute budget before leaving attributes step
    const stepId = STEPS[this.#currentStep].id;
    if (stepId === 'attributes') {
      const budget = this.actor.system.budget;
      if (budget.attrRemaining !== 0) {
        ui.notifications.warn(game.i18n.localize('NEONRELIC.Wizard.Attributes.BudgetWarning'));
        return;
      }
    }

    // Validate skill budget before leaving skills step
    if (stepId === 'skills') {
      const budget = this.actor.system.budget;
      if (budget.skillRemaining !== 0) {
        ui.notifications.warn(game.i18n.localize('NEONRELIC.Wizard.Skills.BudgetWarning'));
        return;
      }
    }

    await this.#resetDownstream();
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

  /**
   * Open the talents compendium browser.
   */
  static async #onOpenTalentCompendium(_event, _target) {
    const pack = game.packs.get('neon-relic.talents');
    if (pack) pack.render(true);
  }

  /**
   * Remove a talent item from the actor.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveTalent(_event, target) {
    const itemId = target.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (item) await item.delete();
    this.render();
  }

  /**
   * Remove an item from the actor by ID.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveItem(_event, target) {
    const itemId = target.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (item) await item.delete();
    this.render();
  }

  /**
   * Roll a random anchor from the anchor roll table.
   */
  static async #onRollAnchor(_event, _target) {
    const pack = game.packs.get('neon-relic.roll-tables');
    if (!pack) {
      ui.notifications.warn('Roll tables compendium not found.');
      return;
    }
    const tables = await pack.getDocuments();
    const anchorTable = tables.find(t => t.name.includes('Anchor'));
    if (!anchorTable) {
      ui.notifications.warn('Anchor Table not found in roll tables compendium.');
      return;
    }
    try {
      const { results } = await anchorTable.roll();
      if (results.length) {
        const result = results[0];
        const text = result.name ?? result.text;
        await this.actor.createEmbeddedDocuments('Item', [
          {
            name: text,
            type: 'anchor',
            system: { relationship: text },
          },
        ]);
        this.render();
      }
    } catch (err) {
      console.error('Anchor roll error:', err);
      ui.notifications.error('Failed to roll on the Anchor Table.');
    }
  }

  /**
   * Create a custom anchor with a dialog prompt.
   */
  static async #onCustomAnchor(_event, _target) {
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('NEONRELIC.Wizard.AnchorSecret.AnchorLabel') },
      content: `<input type="text" name="name" placeholder="${game.i18n.localize('NEONRELIC.Wizard.AnchorSecret.AnchorName')}" autofocus />`,
      ok: {
        callback: (event, button) => button.form.elements.name.value,
      },
    });
    if (name) {
      await this.actor.createEmbeddedDocuments('Item', [
        {
          name,
          type: 'anchor',
          system: { relationship: '' },
        },
      ]);
      this.render();
    }
  }

  /**
   * Open the dark secrets compendium.
   */
  static async #onOpenDarkSecretCompendium(_event, _target) {
    const pack = game.packs.get('neon-relic.dark-secrets');
    if (pack) pack.render(true);
  }

  /**
   * View an item sheet for an item owned by the actor.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onViewItem(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  }

  /**
   * View an item sheet for a compendium item by UUID.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onViewCompendiumItem(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const uuid = target.closest('[data-uuid]')?.dataset.uuid;
    if (!uuid) return;
    const doc = await fromUuid(uuid);
    if (doc) doc.sheet.render(true);
  }
}
