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
      removeNpc: NRItemSheet.#onRemoveNpc,
      openNpcSheet: NRItemSheet.#onOpenNpcSheet,
      removeLinkedDoc: NRItemSheet.#onRemoveLinkedDoc,
      openLinkedDoc: NRItemSheet.#onOpenLinkedDoc,
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

      // Resolve linked documents from UUIDs
      context.linkedNpcs = [];
      context.linkedInfoCards = [];
      context.linkedOrgs = [];

      const resolveDocs = async (uuids, target) => {
        if (!uuids?.length) return;
        for (const uuid of uuids) {
          if (!uuid) continue;
          try {
            const doc = await fromUuid(uuid);
            if (doc) target.push({ uuid, name: doc.name, img: doc.img });
          } catch {
            // UUID may be stale; skip
          }
        }
      };

      await resolveDocs(system.npcUuids, context.linkedNpcs);
      await resolveDocs(system.informationCardUuids, context.linkedInfoCards);
      await resolveDocs(system.organizationUuids, context.linkedOrgs);
    }
    if (item.type === 'organization') {
      // Resolve linked NPCs from UUIDs
      context.linkedNpcs = [];
      if (system.npcUuids?.length) {
        for (const uuid of system.npcUuids) {
          if (!uuid) continue;
          try {
            const doc = await fromUuid(uuid);
            if (doc) {
              context.linkedNpcs.push({ uuid, name: doc.name, img: doc.img });
            }
          } catch {
            // UUID may be stale; skip
          }
        }
      }
    }
    if (item.type === 'informationCard') {
      context.enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.content ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      context.enrichedDANotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.daNotes ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      // Precompute card type display class
      const typeClassMap = {
        containmentTruth: 'truth',
        supportingIntel: 'intel',
      };
      context.cardTypeClass = typeClassMap[system.cardType] ?? 'intel';
      context.isTruth = system.cardType === 'containmentTruth';
      context.isIntel = system.cardType === 'supportingIntel';

      // Resolve linked documents
      context.linkedFoundAt = null;
      if (system.foundAtUuid) {
        try {
          const doc = await fromUuid(system.foundAtUuid);
          if (doc) context.linkedFoundAt = { uuid: system.foundAtUuid, name: doc.name, img: doc.img, type: doc.type };
        } catch {
          /* skip */
        }
      }

      context.linkedKnownBy = null;
      if (system.knownByUuid) {
        try {
          const doc = await fromUuid(system.knownByUuid);
          if (doc) context.linkedKnownBy = { uuid: system.knownByUuid, name: doc.name, img: doc.img, type: doc.type };
        } catch {
          /* skip */
        }
      }

      // Resolve linked NPCs
      context.linkedNpcs = [];
      if (system.npcUuids?.length) {
        for (const uuid of system.npcUuids) {
          if (!uuid) continue;
          try {
            const doc = await fromUuid(uuid);
            if (doc) context.linkedNpcs.push({ uuid, name: doc.name, img: doc.img, type: doc.type });
          } catch {
            /* skip */
          }
        }
      }
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
    if (item.type === 'relicSheet') {
      context.enrichedSurfaceRead = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.surfaceRead ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedOperationalRead = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.operationalRead ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedColdArchiveRead = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.coldArchiveRead ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedActivationCondition = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.activationCondition ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedMechanicalEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.mechanicalEffect ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedFractureCondition = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.fractureCondition ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedContainmentProfile = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.containmentProfile ?? '',
        { async: true, relativeTo: item },
      );
      context.enrichedDaNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.daNotes ?? '',
        { async: true, relativeTo: item },
      );
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
    } else if (itemType === 'organization') {
      new foundry.applications.ux.Tabs({
        navSelector: '.org-tabs',
        contentSelector: '.org-tab-content',
        initial: this._orgActiveTab || 'details',
        group: 'org-primary',
        callback: (_event, _tabs, tab) => {
          this._orgActiveTab = tab.dataset.tab;
        },
      }).bind(this.element);
    } else if (itemType === 'location') {
      new foundry.applications.ux.Tabs({
        navSelector: '.loc-tabs',
        contentSelector: '.loc-tab-content',
        initial: this._locActiveTab || 'details',
        group: 'loc-primary',
        callback: (_event, _tabs, tab) => {
          this._locActiveTab = tab.dataset.tab;
        },
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

  /**
   * Remove a linked NPC from the organization reference.
   */
  static async #onRemoveNpc(_event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const system = this.document.system;
    const npcUuids = [...(system.npcUuids ?? [])];
    const idx = npcUuids.indexOf(uuid);
    if (idx !== -1) {
      npcUuids.splice(idx, 1);
      await this.document.update({ 'system.npcUuids': npcUuids });
    }
  }

  /**
   * Open an NPC actor sheet from a linked organization NPC.
   */
  static async #onOpenNpcSheet(_event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const doc = await fromUuid(uuid);
    if (doc) doc.sheet.render(true);
  }

  /* ------------------------------------------ */

  /** @override */
  _canDragDrop(_event) {
    return (
      (this.document.type === 'organization' ||
        this.document.type === 'location' ||
        this.document.type === 'informationCard') &&
      this.isEditable
    );
  }

  /** @override */
  async _onDrop(event) {
    const docType = this.document.type;
    if (docType !== 'organization' && docType !== 'location' && docType !== 'informationCard') return;

    let data;
    try {
      const raw = event.dataTransfer.getData('text/plain');
      if (!raw) return;
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (!data?.uuid) return;
    const doc = await fromUuid(data.uuid);
    if (!doc) return;

    const system = this.document.system;
    let uuidField;
    let reverseField; // field on the dropped document to update for bidirectional linking

    if (docType === 'organization') {
      // Organization: only accept NPC actors
      if (data.type !== 'Actor' || doc.type !== 'npc') return;
      uuidField = 'system.npcUuids';
      // Bidirectional: set this org as the NPC's organization
      reverseField = 'system.organizationUuid';
    } else if (docType === 'informationCard') {
      const dropKey = event.target.closest('[data-drop-key]')?.dataset?.dropKey;
      if (data.type === 'Item' && doc.type === 'location' && dropKey === 'foundAt') {
        if (system.foundAtUuid === data.uuid) return;
        await this.document.update({ 'system.foundAtUuid': data.uuid });
        // Bidirectional: add this info card to the location's informationCardUuids
        const locUuids = [...(doc.system.informationCardUuids ?? [])];
        const selfUuid = this.document.uuid;
        if (!locUuids.includes(selfUuid)) {
          locUuids.push(selfUuid);
          await doc.update({ 'system.informationCardUuids': locUuids });
        }
        return;
      } else if (data.type === 'Actor' && doc.type === 'npc') {
        if (dropKey === 'knownBy') {
          const uuids = [...(system.knownByUuids ?? [])];
          if (uuids.includes(data.uuid)) return;
          uuids.push(data.uuid);
          await this.document.update({ 'system.knownByUuids': uuids });
          // Bidirectional: add this info card to the NPC's startingKnowledgeUuids
          const npcUuids = [...(doc.system.startingKnowledgeUuids ?? [])];
          const selfUuid = this.document.uuid;
          if (!npcUuids.includes(selfUuid)) {
            npcUuids.push(selfUuid);
            await doc.update({ 'system.startingKnowledgeUuids': npcUuids });
          }
          return;
        }
        // Default drop: add to linked NPCs
        uuidField = 'system.npcUuids';
        // Bidirectional: add this info card to NPC's startingKnowledgeUuids
        reverseField = 'system.startingKnowledgeUuids';
      } else {
        return;
      }
    } else {
      // Location: accept NPCs, Information Cards, and Organizations
      if (data.type === 'Actor' && doc.type === 'npc') {
        uuidField = 'system.npcUuids';
        // Bidirectional: add this location to NPC's locationUuids
        reverseField = 'system.locationUuids';
      } else if (data.type === 'Item' && doc.type === 'informationCard') {
        uuidField = 'system.informationCardUuids';
        // Bidirectional: no reverse field on info card for locations (foundAt is already handled above)
      } else if (data.type === 'Item' && doc.type === 'organization') {
        uuidField = 'system.organizationUuids';
      } else {
        return;
      }
    }

    // Add to this document's UUID array
    const uuids = [...(foundry.utils.getProperty(system, uuidField.split('.').slice(1).join('.')) ?? [])];
    if (!uuids.includes(data.uuid)) {
      uuids.push(data.uuid);
      await this.document.update({ [uuidField]: uuids });
    }

    // Bidirectional: update the dropped document
    if (reverseField) {
      const selfUuid = this.document.uuid;
      if (reverseField === 'system.organizationUuid') {
        // Single UUID field — replace
        await doc.update({ [reverseField]: selfUuid });
      } else {
        // Array UUID field — append
        const revUuids = [...(foundry.utils.getProperty(doc.system, reverseField.split('.').slice(1).join('.')) ?? [])];
        if (!revUuids.includes(selfUuid)) {
          revUuids.push(selfUuid);
          await doc.update({ [reverseField]: revUuids });
        }
      }
    }
  }

  /**
   * Remove a linked document from a location or organization.
   */
  static async #onRemoveLinkedDoc(_event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const system = this.document.system;
    const selfUuid = this.document.uuid;
    const docType = this.document.type;

    // Resolve the dropped document for reverse-unlinking
    let doc = null;
    try {
      doc = await fromUuid(uuid);
    } catch {
      /* skip */
    }

    // Handle single-UUID field (foundAt on info cards)
    if (system.foundAtUuid === uuid) {
      await this.document.update({ 'system.foundAtUuid': '' });
      // Bidirectional unlink: remove info card from location's informationCardUuids
      if (doc?.system?.informationCardUuids) {
        const locUuids = doc.system.informationCardUuids.filter(u => u !== selfUuid);
        await doc.update({ 'system.informationCardUuids': locUuids });
      }
      return;
    }

    // Handle array-UUID fields with reverse unlinking
    const collections = [
      {
        path: 'system.npcUuids',
        arr: system.npcUuids,
        // Reverse: remove this document's UUID from the NPC
        reverse(doc) {
          if (!doc) return;
          if (docType === 'organization') return doc.update({ 'system.organizationUuid': '' });
          if (docType === 'location') {
            const locUuids = (doc.system.locationUuids ?? []).filter(u => u !== selfUuid);
            return doc.update({ 'system.locationUuids': locUuids });
          }
          if (docType === 'informationCard') {
            const skUuids = (doc.system.startingKnowledgeUuids ?? []).filter(u => u !== selfUuid);
            return doc.update({ 'system.startingKnowledgeUuids': skUuids });
          }
        },
      },
      {
        path: 'system.knownByUuids',
        arr: system.knownByUuids,
        reverse(doc) {
          if (!doc) return;
          // Remove info card from NPC's startingKnowledgeUuids
          const skUuids = (doc.system.startingKnowledgeUuids ?? []).filter(u => u !== selfUuid);
          return doc.update({ 'system.startingKnowledgeUuids': skUuids });
        },
      },
      { path: 'system.informationCardUuids', arr: system.informationCardUuids },
      { path: 'system.organizationUuids', arr: system.organizationUuids },
    ];

    for (const col of collections) {
      if (!col.arr?.length) continue;
      const idx = col.arr.indexOf(uuid);
      if (idx !== -1) {
        const updated = [...col.arr];
        updated.splice(idx, 1);
        await this.document.update({ [col.path]: updated });
        // Reverse unlink
        if (col.reverse) await col.reverse(doc);
        return;
      }
    }
  }

  /**
   * Open a linked document sheet from a location or organization.
   */
  static async #onOpenLinkedDoc(_event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const doc = await fromUuid(uuid);
    if (doc) doc.sheet.render(true);
  }
}
