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
      width: 480,
      height: 'auto',
    },
    actions: {
      stepDown: NRItemSheet.#onStepDown,
      stepDownAmmo: NRItemSheet.#onStepDownAmmo,
      stepDownArtifact: NRItemSheet.#onStepDownArtifact,
      useTalent: NRItemSheet.#onUseTalent,
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

    context.system = system;
    context.config = CONFIG.NEON_RELIC;
    context.isEditable = this.isEditable;
    context.itemType = item.type;

    // Pre-render type-specific template content
    const typeTemplatePath = `systems/${SYSTEM_ID}/templates/item/${item.type}.hbs`;
    context.enrichedDescription = await TextEditor.enrichHTML(system.description ?? '', {
      async: true,
      relativeTo: item,
    });

    // Type-specific enrichments
    if (item.type === 'artifact') {
      context.enrichedEffect = await TextEditor.enrichHTML(system.effect ?? '', {
        async: true,
        relativeTo: item,
      });
    }
    if (item.type === 'talent') {
      context.enrichedEffect = await TextEditor.enrichHTML(system.effect ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedPrerequisites = await TextEditor.enrichHTML(system.prerequisites ?? '', {
        async: true,
        relativeTo: item,
      });
    }
    if (item.type === 'criticalInjury') {
      context.enrichedEffect = await TextEditor.enrichHTML(system.effect ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedInsight = await TextEditor.enrichHTML(system.insight ?? '', {
        async: true,
        relativeTo: item,
      });
    }
    if (item.type === 'location') {
      context.enrichedPositiveResult = await TextEditor.enrichHTML(system.positiveResult ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedNegativeResult = await TextEditor.enrichHTML(system.negativeResult ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedMilestoneChanges = await TextEditor.enrichHTML(system.milestoneChanges ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedNpcsPresent = await TextEditor.enrichHTML(system.npcsPresent ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedInformationAvailable = await TextEditor.enrichHTML(system.informationAvailable ?? '', {
        async: true,
        relativeTo: item,
      });
      context.enrichedOrganizationsPresent = await TextEditor.enrichHTML(system.organizationsPresent ?? '', {
        async: true,
        relativeTo: item,
      });
    }
    if (item.type === 'informationCard') {
      context.enrichedContent = await TextEditor.enrichHTML(system.content ?? '', {
        async: true,
        relativeTo: item,
      });
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

    // Render the type-specific partial to HTML
    context.typeContent = await foundry.applications.handlebars.renderTemplate(typeTemplatePath, context);

    return context;
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
}
