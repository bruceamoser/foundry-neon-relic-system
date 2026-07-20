/**
 * Base item sheet for all Neon Relic item types.
 * Uses ApplicationV2 + HandlebarsApplicationMixin with per-type template partials.
 * @module item/item-sheet
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';

export class NRItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, 'item-sheet'],
    position: {
      width: 680,
      height: 'auto',
    },
    actions: {
      stepDown: NRItemSheet.#onStepDown,
      stepDownAmmo: NRItemSheet.#onStepDownAmmo,
      stepDownArtifact: NRItemSheet.#onStepDownArtifact,
      useTalent: NRItemSheet.#onUseTalent,
      useConsumable: NRItemSheet.#onUseConsumable,
      replenishConsumable: NRItemSheet.#onReplenishConsumable,
      fixItem: NRItemSheet.#onFixItem,
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    header: {
      template: `systems/${SYSTEM_ID}/templates/item/item-header.hbs`,
    },
    body: {
      template: `systems/${SYSTEM_ID}/templates/item/item-body.hbs`,
      scrollable: [''],
    },
  };

  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    const system = item.system;

    context.item = item;
    context.system = system;
    context.config = CONFIG.NEON_RELIC;
    context.isEditable = this.isEditable;
    context.itemType = item.type;

    // Linked consumable options (only when item is on an actor)
    if (item.parent && (item.type === 'weapon' || item.type === 'gear')) {
      const consumables = item.parent.items.filter(i => i.type === 'consumable');
      context.linkedConsumables = consumables.map(c => ({
        id: c.id,
        name: c.name,
        die: c.system.currentDie,
        type: c.system.consumableType,
        selected: c.id === system.linkedConsumableId,
      }));
      context.hasLinkedConsumables = consumables.length > 0;
    } else {
      context.linkedConsumables = [];
      context.hasLinkedConsumables = false;
    }

    // Pre-render type-specific template content
    const typeTemplatePath = `systems/${SYSTEM_ID}/templates/item/${item.type}.hbs`;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? '',
      {
        async: true,
        relativeTo: item,
      },
    );

    // Type-specific enrichments
    if (item.type === 'artifact') {
      context.enrichedEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.effect ?? '', {
        async: true,
        relativeTo: item,
      });
    }
    if (item.type === 'talent') {
      context.enrichedEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.effect ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedPrerequisites = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.prerequisites ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
    }
    if (item.type === 'criticalInjury') {
      context.enrichedEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.effect ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedInsight = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.insight ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
    }
    if (item.type === 'location') {
      context.enrichedPositiveResult = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.positiveResult ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      context.enrichedNegativeResult = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.negativeResult ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      context.enrichedMilestoneChanges = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.milestoneChanges ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      context.enrichedNpcsPresent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.npcsPresent ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      context.enrichedInformationAvailable = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.informationAvailable ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      context.enrichedOrganizationsPresent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.organizationsPresent ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
    }
    if (item.type === 'informationCard') {
      context.enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.content ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      // Precompute card type display class and select state
      const typeClassMap = {
        containmentTruth: 'truth',
        supportingIntel: 'intel',
      };
      context.cardTypeClass = typeClassMap[system.cardType] ?? 'intel';
      context.isTruth = system.cardType === 'containmentTruth';
      context.isIntel = system.cardType === 'supportingIntel';
      context.cardTypeChoices = {
        supportingIntel: game.i18n.localize('NEONRELIC.InfoCard.SupportingIntel'),
        containmentTruth: game.i18n.localize('NEONRELIC.InfoCard.ContainmentTruth'),
      };
    }
    if (item.type === 'playerCaseBrief') {
      context.enrichedSituationSummary = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.situationSummary ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedPrimaryObjective = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.primaryObjective ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedSecondaryObjective = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.secondaryObjective ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedKnownOrganizations = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.knownOrganizations ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedStartingLeads = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.startingLeads ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedTimelinePressure = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.timelinePressure ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedConstraints = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.constraints ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedRegionalContacts = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.regionalContacts ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedAgentNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.agentNotes ?? '',
        { async: true, relativeTo: item },
      );
    }
    if (item.type === 'daCaseBrief') {
      context.enrichedMysteryStatement = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.mysteryStatement ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedRealSituation = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.realSituation ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedPrimaryObjective = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.primaryObjective ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedSecondaryObjective = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.secondaryObjective ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedContainmentTrigger = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.containmentTrigger ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedContainmentAppetite = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.containmentAppetite ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedContainmentQuiescence = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.containmentQuiescence ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedKeyActors = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.keyActors ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedBestCaseResolution = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.bestCaseResolution ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedWorstCaseResolution = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.worstCaseResolution ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedDANotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.daNotes ?? '',
        { async: true, relativeTo: item },
      );
    }

    // Pre-computed CSS classes (Prettier-compatible — no {{#if}} in attributes)
    if (item.type === 'consumable') {
      context.dieValueClass = system.isDepleted ? 'die-value depleted' : 'die-value';
    }
    if (item.type === 'gear') {
      context.brokenClass = system.isBroken ? 'trait-chip active' : 'trait-chip';
    }
    if (item.type === 'talent') {
      context.healingTagClass = system.hasHealingTag ? 'trait-chip active' : 'trait-chip';
      context.oncePerSessionClass = system.isOncePerSession ? 'trait-chip active' : 'trait-chip';
    }
    if (item.type === 'weapon') {
      context.reliableClass = system.traits.reliable ? 'trait-chip active' : 'trait-chip';
      context.highCapacityClass = system.traits.highCapacity ? 'trait-chip active' : 'trait-chip';
      context.fullAutoClass = system.traits.fullAuto ? 'trait-chip active' : 'trait-chip';
      context.stunnedClass = system.traits.stunned ? 'trait-chip active' : 'trait-chip';
      context.weaponBrokenClass = system.isBroken ? 'trait-chip active' : 'trait-chip';
      context.ammoDieClass = system.ammoDie.current ? 'die-value' : 'die-value depleted';
      context.ammoDieLabel = system.ammoDie.current ? system.ammoDie.current : '—';
    }

    // Render the type-specific partial to HTML
    context.typeContent = await foundry.applications.handlebars.renderTemplate(typeTemplatePath, context);

    return context;
  }

  /* ------------------------------------------ */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Initialize tabs for case brief item types
    const itemType = this.document.type;
    if (itemType === 'daCaseBrief') {
      new foundry.applications.ux.Tabs({
        navSelector: '.dcb-tabs',
        contentSelector: '.dcb-tab-content',
        initial: 'section-i',
        group: 'dcb-primary',
      }).bind(this.element);
    } else if (itemType === 'playerCaseBrief') {
      new foundry.applications.ux.Tabs({
        navSelector: '.pcb-tabs',
        contentSelector: '.pcb-tab-content',
        initial: 'section-1',
        group: 'pcb-primary',
      }).bind(this.element);
    }
  }

  /* ------------------------------------------ */
  /*  Action Handlers                            */
  /* ------------------------------------------ */

  /**
   * Step down a consumable's resource die.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onStepDown(_event, _target) {
    await this.document.stepDown();
  }

  /**
   * Step down a weapon's ammo die.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onStepDownAmmo(_event, _target) {
    await this.document.stepDownAmmo();
  }

  /**
   * Step down an artifact's artifact die.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onStepDownArtifact(_event, _target) {
    await this.document.stepDownArtifactDie();
  }

  /**
   * Use a talent (decrement uses, apply corruption).
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onUseTalent(_event, _target) {
    await this.document.useTalent();
  }

  /**
   * Use a consumable — roll the resource die and step down on a 1.
   */
  static async #onUseConsumable(_event, _target) {
    const result = await this.document.useConsumable();
    if (result.depleted && result.rolled === 0) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Consumable.Depleted'));
      return;
    }
    const msg = result.stepped
      ? game.i18n.format('NEONRELIC.Consumable.UseStepped', {
          die: result.die,
          roll: result.rolled,
          newDie: result.newDie,
        })
      : game.i18n.format('NEONRELIC.Consumable.UseOk', { die: result.die, roll: result.rolled });
    ChatMessage.create({ content: `<p><strong>${this.document.name}</strong>: ${msg}</p>` });
  }

  /**
   * Replenish a consumable — step the resource die up one size.
   */
  static async #onReplenishConsumable(_event, _target) {
    const result = await this.document.replenish();
    if (result.stepped) {
      ui.notifications.info(
        game.i18n.format('NEONRELIC.Consumable.Replenished', { old: result.oldDie, new: result.newDie }),
      );
    } else {
      ui.notifications.info(game.i18n.localize('NEONRELIC.Consumable.ReplenishMax'));
    }
  }

  /**
   * Repair a broken gear item or weapon — restore bonus to max, clear Broken flag.
   */
  static async #onFixItem(_event, _target) {
    await this.document.repair();
  }
}
