/**
 * Base item sheet for all Neon Relic item types.
 * Uses ApplicationV2 + HandlebarsApplicationMixin with per-type template partials.
 * @module item/item-sheet
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';

/**
 * Show an item's portrait to all connected players via an ImagePopout share.
 * @param {Item} item
 */
function showImageToPlayers(item) {
  const { img, name, uuid } = item;
  const popout = new foundry.applications.apps.ImagePopout({
    src: img,
    uuid,
    window: { title: name },
  });
  popout.render({ force: true });
  if (game.user.isGM) popout.shareImage();
}

/**
 * Build the case board view model: day columns, organization rows, and the
 * resolved list of linked information cards.
 * @param {object} system - The case board system data.
 * @returns {Promise<object>}
 */
async function buildBoardContext(system) {
  const shifts = system.shiftsFilled ?? [];
  const days = [];
  for (let day = 14; day >= 1; day--) {
    const filled = shifts.filter(s => s.day === day).length;
    const relic = (system.relicMilestones ?? []).find(m => m.day === day);
    days.push({
      day,
      isCurrentDay: day === (system.currentDay ?? 14),
      complete: filled >= 4,
      headClass:
        'cb-day-head' +
        (day === (system.currentDay ?? 14) ? ' current-day' : '') +
        (filled >= 4 ? ' day-complete' : ''),
      relicClass: 'cb-relic-cell' + (relic ? ' has-ms' : ''),
      quads: ['N', 'M', 'D', 'E'].map(shift => {
        const quadFilled = shifts.some(s => s.day === day && s.shift === shift);
        return { day, shift, filled: quadFilled, quadClass: 'cb-quad' + (quadFilled ? ' filled' : '') };
      }),
      relicLabel: relic ? `D.${day}` : '',
      relicDescription: relic?.description ?? '',
    });
  }

  const orgs = (system.organizations ?? []).map((org, idx) => ({
    idx,
    id: org.id,
    name: org.name,
    orgUuid: org.orgUuid ?? '',
    value: org.value,
    active: org.active,
    dormant: org.dormant,
    cells: days.map(d => {
      const ms = (org.milestones ?? []).find(m => m.day === d.day);
      const consumed = (org.squaresConsumed ?? []).includes(d.day);
      return {
        day: d.day,
        orgIdx: idx,
        consumed,
        milestoneLabel: ms ? ms.label || `D.${d.day}` : '',
        triggered: ms?.triggered ?? false,
        cellClass:
          'cb-cell' + (consumed ? ' consumed' : '') + (ms ? ' has-ms' : '') + (ms?.triggered ? ' triggered' : ''),
        title: ms ? `${ms.label}: ${ms.description}` : `Day ${d.day} — click to consume, right-click to edit milestone`,
      };
    }),
  }));

  const cards = [];
  for (const uuid of system.infoCardUuids ?? []) {
    const doc = await fromUuid(uuid).catch(() => null);
    cards.push({
      uuid,
      name: doc?.name ?? '(missing card)',
      img: doc?.img ?? 'icons/svg/mystery-man.svg',
      revealed: doc?.system?.revealed ?? false,
    });
  }

  return { days, orgs, cards };
}

/**
 * Compute the update patch and chat messages for a completed day: fire the
 * relic milestone keyed to that day plus any organization milestones.
 * @param {object} system
 * @param {object[]} shifts
 * @param {number} day
 * @returns {{patch: object, messages: string[]}}
 */
function dayCompletePatch(system, shifts, day) {
  const patch = {};
  const messages = [];
  if (shifts.filter(s => s.day === day).length < 4) return { patch, messages };

  const relic = (system.relicMilestones ?? []).find(m => m.day === day && !m.triggered);
  if (relic) {
    const milestones = foundry.utils.deepClone(system.relicMilestones ?? []);
    milestones.find(m => m.day === day).triggered = true;
    patch['system.relicMilestones'] = milestones;
    messages.push(`<p><strong>Relic Milestone — Day ${day}.</strong><br>${relic.description}</p>`);
  }

  const orgs = foundry.utils.deepClone(system.organizations ?? []);
  let orgFired = false;
  for (const org of orgs) {
    const ms = (org.milestones ?? []).find(m => m.day === day && !m.triggered);
    if (ms) {
      ms.triggered = true;
      orgFired = true;
      messages.push(`<p><strong>${org.name || org.id} — ${ms.label}</strong><br>${ms.description}</p>`);
    }
  }
  if (orgFired) patch['system.organizations'] = orgs;
  return { patch, messages };
}

/**
 * Post milestone announcements to chat.
 * @param {string[]} messages
 */
async function announceMilestones(messages) {
  for (const content of messages) {
    await ChatMessage.create({ content: `<div class="neon-relic ops-milestone">${content}</div>` });
  }
}

/**
 * Prompt for a milestone label + description.
 * @param {string} title
 * @param {{label?: string, description?: string}} [existing]
 * @returns {Promise<{label: string, description: string}|null>}
 */
async function promptMilestone(title, existing = {}) {
  const label = foundry.utils.escapeHTML(existing?.label ?? '');
  const description = foundry.utils.escapeHTML(existing?.description ?? '');
  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="form-group"><label>Label</label><input type="text" name="label" value="${label}"></div>
      <div class="form-group"><label>Description</label><textarea name="description" rows="3">${description}</textarea></div>
      <p style="font-size:11px;opacity:.7">Leave both empty to clear this milestone.</p>`,
    ok: {
      callback: (_event, button) => ({
        label: button.form.elements.label.value.trim(),
        description: button.form.elements.description.value.trim(),
      }),
    },
    rejectClose: false,
  });
}

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
      rollAmmo: NRItemSheet.#onRollAmmo,
      stepDownArtifact: NRItemSheet.#onStepDownArtifact,
      useTalent: NRItemSheet.#onUseTalent,
      useConsumable: NRItemSheet.#onUseConsumable,
      replenishConsumable: NRItemSheet.#onReplenishConsumable,
      fixItem: NRItemSheet.#onFixItem,
      removeNpc: NRItemSheet.#onRemoveNpc,
      openNpcSheet: NRItemSheet.#onOpenNpcSheet,
      removeLinkedDoc: NRItemSheet.#onRemoveLinkedDoc,
      openLinkedDoc: NRItemSheet.#onOpenLinkedDoc,
      advanceDay: NRItemSheet.#onAdvanceDay,
      toggleShift: NRItemSheet.#onToggleShift,
      orgCell: { handler: NRItemSheet.#onOrgCell, buttons: [0, 2] },
      editRelicMilestone: NRItemSheet.#onEditRelicMilestone,
      addOrg: NRItemSheet.#onAddOrg,
      removeOrg: NRItemSheet.#onRemoveOrg,
      toggleCardReveal: NRItemSheet.#onToggleCardReveal,
      removeCard: NRItemSheet.#onRemoveCard,
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

    // Case Board — pre-compute the 14-day grid view model
    if (item.type === 'caseBoard') {
      context.board = await buildBoardContext(system);
    }

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
    if (item.type === 'anchor') {
      context.enrichedRelationship = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.relationship ?? '',
        {
          async: true,
          relativeTo: item,
        },
      );
      context.enrichedMemory = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.memory ?? '', {
        async: true,
        relativeTo: item,
      });
    }
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
      // Resolve linked locations
      context.linkedLocations = [];
      if (system.locationUuids?.length) {
        for (const uuid of system.locationUuids) {
          if (!uuid) continue;
          try {
            const doc = await fromUuid(uuid);
            if (doc) context.linkedLocations.push({ uuid, name: doc.name, img: doc.img, type: doc.type });
          } catch {
            /* skip */
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
      context.linkedFoundAt = [];
      if (system.foundAtUuids?.length) {
        for (const uuid of system.foundAtUuids) {
          if (!uuid) continue;
          try {
            const doc = await fromUuid(uuid);
            if (doc) context.linkedFoundAt.push({ uuid, name: doc.name, img: doc.img, type: doc.type });
          } catch {
            /* skip */
          }
        }
      }

      // Resolve linked NPCs (knownBy — multiple NPCs)
      context.linkedKnownBy = [];
      if (system.knownByUuids?.length) {
        for (const uuid of system.knownByUuids) {
          if (!uuid) continue;
          try {
            const doc = await fromUuid(uuid);
            if (doc) context.linkedKnownBy.push({ uuid, name: doc.name, img: doc.img, type: doc.type });
          } catch {
            /* skip */
          }
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

    // Right-click the portrait to share it with players; left-click edits it
    // via the core `editImage` action.
    this.element.querySelector('.item-header .item-img')?.addEventListener('contextmenu', event => {
      event.preventDefault();
      showImageToPlayers(this.document);
    });

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
          if (tab?.dataset?.tab) this._orgActiveTab = tab.dataset.tab;
        },
      }).bind(this.element);
    } else if (itemType === 'location') {
      new foundry.applications.ux.Tabs({
        navSelector: '.loc-tabs',
        contentSelector: '.loc-tab-content',
        initial: this._locActiveTab || 'details',
        group: 'loc-primary',
        callback: (_event, _tabs, tab) => {
          if (tab?.dataset?.tab) this._locActiveTab = tab.dataset.tab;
        },
      }).bind(this.element);
    } else if (itemType === 'informationCard') {
      new foundry.applications.ux.Tabs({
        navSelector: '.info-tabs',
        contentSelector: '.info-tab-content',
        initial: this._infoActiveTab || 'details',
        group: 'info-primary',
        callback: (_event, _tabs, tab) => {
          if (tab?.dataset?.tab) this._infoActiveTab = tab.dataset.tab;
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
   * Roll the weapon's Ammo Die — on 1–2 the die steps down one size.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onRollAmmo(_event, _target) {
    const result = await this.document.rollAmmoDie();
    if (result.depleted && result.rolled === 0) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Weapon.AmmoDepleted'));
      return;
    }
    const msg =
      result.stepped && result.depleted
        ? game.i18n.format('NEONRELIC.Consumable.UseDepleted', { die: result.die, roll: result.rolled })
        : result.stepped
          ? game.i18n.format('NEONRELIC.Consumable.UseStepped', {
              die: result.die,
              roll: result.rolled,
              newDie: result.newDie,
            })
          : game.i18n.format('NEONRELIC.Consumable.UseOk', { die: result.die, roll: result.rolled });
    ChatMessage.create({ content: `<p><strong>${this.document.name}</strong>: ${msg}</p>` });
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
    const msg =
      result.stepped && result.depleted
        ? game.i18n.format('NEONRELIC.Consumable.UseDepleted', { die: result.die, roll: result.rolled })
        : result.stepped
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

  /* ── Case Board actions ─────────────────────── */

  /**
   * Toggle a shift quadrant; a completed day fires its milestones.
   */
  static async #onToggleShift(_event, target) {
    const day = Number(target.dataset.day);
    const shift = target.dataset.shift;
    const system = this.document.system;
    const shifts = foundry.utils.deepClone(system.shiftsFilled ?? []);
    const idx = shifts.findIndex(s => s.day === day && s.shift === shift);
    if (idx !== -1) shifts.splice(idx, 1);
    else shifts.push({ day, shift, filled: true });

    const { patch, messages } = dayCompletePatch(system, shifts, day);
    await this.document.update({ 'system.shiftsFilled': shifts, ...patch });
    await announceMilestones(messages);
  }

  /**
   * Fill the next incomplete day (14 → 1) and fire its milestones.
   */
  static async #onAdvanceDay() {
    const system = this.document.system;
    const shifts = foundry.utils.deepClone(system.shiftsFilled ?? []);
    let target = null;
    for (let day = 14; day >= 1; day--) {
      if (shifts.filter(s => s.day === day).length < 4) {
        target = day;
        break;
      }
    }
    if (target === null) return;
    for (const shift of ['N', 'M', 'D', 'E']) {
      if (!shifts.some(s => s.day === target && s.shift === shift)) {
        shifts.push({ day: target, shift, filled: true });
      }
    }
    const { patch, messages } = dayCompletePatch(system, shifts, target);
    await this.document.update({ 'system.shiftsFilled': shifts, ...patch });
    await announceMilestones(messages);
  }

  /**
   * Left-click an organization cell to consume the square or fire its
   * milestone; right-click opens the milestone editor for that day.
   */
  static async #onOrgCell(event, target) {
    if (!this.isEditable) return;
    const idx = Number(target.dataset.orgIdx);
    const day = Number(target.dataset.day);
    const orgs = foundry.utils.deepClone(this.document.system.organizations ?? []);
    const org = orgs[idx];
    if (!org) return;

    if (event.button === 2) {
      const existing = (org.milestones ?? []).find(m => m.day === day);
      const result = await promptMilestone(`Day ${day} — ${org.name || org.id}`, existing);
      if (!result) return;
      org.milestones = (org.milestones ?? []).filter(m => m.day !== day);
      if (result.label || result.description) {
        org.milestones.push({ day, label: result.label, description: result.description, triggered: false });
      }
      await this.document.update({ 'system.organizations': orgs });
      return;
    }

    const ms = (org.milestones ?? []).find(m => m.day === day);
    if (ms) {
      if (ms.triggered) return;
      ms.triggered = true;
      await this.document.update({ 'system.organizations': orgs });
      await announceMilestones([`<p><strong>${org.name || org.id} — ${ms.label}</strong><br>${ms.description}</p>`]);
      return;
    }

    const consumed = new Set(org.squaresConsumed ?? []);
    if (consumed.has(day)) consumed.delete(day);
    else consumed.add(day);
    org.squaresConsumed = [...consumed].sort((a, b) => a - b);
    await this.document.update({ 'system.organizations': orgs });
  }

  /**
   * Edit (or clear) the relic milestone keyed to a day.
   */
  static async #onEditRelicMilestone(_event, target) {
    if (!this.isEditable) return;
    const day = Number(target.dataset.day);
    const system = this.document.system;
    const existing = (system.relicMilestones ?? []).find(m => m.day === day);
    const result = await promptMilestone(`Relic Milestone — Day ${day}`, existing);
    if (!result) return;
    const milestones = (system.relicMilestones ?? []).filter(m => m.day !== day);
    if (result.description) milestones.push({ day, description: result.description, triggered: false });
    await this.document.update({ 'system.relicMilestones': milestones });
  }

  /**
   * Add a blank organization row.
   */
  static async #onAddOrg() {
    const orgs = foundry.utils.deepClone(this.document.system.organizations ?? []);
    orgs.push({
      id: `O${orgs.length + 1}`,
      name: '',
      orgUuid: '',
      value: Math.min(14, orgs.length + 1),
      active: true,
      dormant: false,
      squaresConsumed: [],
      milestones: [],
    });
    await this.document.update({ 'system.organizations': orgs });
  }

  /**
   * Remove an organization row.
   */
  static async #onRemoveOrg(_event, target) {
    const idx = Number(target.dataset.idx);
    const orgs = foundry.utils.deepClone(this.document.system.organizations ?? []);
    orgs.splice(idx, 1);
    await this.document.update({ 'system.organizations': orgs });
  }

  /**
   * Toggle an information card's revealed state from the board.
   */
  static async #onToggleCardReveal(_event, target) {
    if (!this.isEditable) return;
    const card = await fromUuid(target.dataset.uuid);
    if (!card) return;
    await card.update({ 'system.revealed': !card.system.revealed });
  }

  /**
   * Unlink an information card from the board.
   */
  static async #onRemoveCard(_event, target) {
    const uuid = target.dataset.uuid;
    const uuids = [...(this.document.system.infoCardUuids ?? [])].filter(u => u !== uuid);
    await this.document.update({ 'system.infoCardUuids': uuids });
  }

  /* ------------------------------------------ */

  /** @override */
  _canDragDrop(_event) {
    return (
      (this.document.type === 'organization' ||
        this.document.type === 'location' ||
        this.document.type === 'informationCard' ||
        this.document.type === 'caseBoard') &&
      this.isEditable
    );
  }

  /** @override */
  async _onDrop(event) {
    const docType = this.document.type;
    if (
      docType !== 'organization' &&
      docType !== 'location' &&
      docType !== 'informationCard' &&
      docType !== 'caseBoard'
    )
      return;

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (!data?.uuid) return;
    const doc = await fromUuid(data.uuid);
    if (!doc) return;

    const system = this.document.system;

    // ── Case Board: accept organizations and information cards ──
    if (docType === 'caseBoard') {
      if (data.type === 'Item' && doc.type === 'organization') {
        const orgs = [...(system.organizations ?? [])];
        if (orgs.some(o => o.orgUuid === data.uuid)) return;
        orgs.push({
          id: `O${orgs.length + 1}`,
          name: doc.name,
          orgUuid: data.uuid,
          value: Math.min(14, orgs.length + 1),
          active: true,
          dormant: false,
          squaresConsumed: [],
          milestones: [],
        });
        await this.document.update({ 'system.organizations': orgs });
      } else if (data.type === 'Item' && doc.type === 'informationCard') {
        const uuids = [...(system.infoCardUuids ?? [])];
        if (uuids.includes(data.uuid)) return;
        uuids.push(data.uuid);
        await this.document.update({ 'system.infoCardUuids': uuids });
      }
      return;
    }
    let uuidField;
    let reverseField; // field on the dropped document to update for bidirectional linking

    if (docType === 'organization') {
      // Organization: accept NPC actors and Locations
      if (data.type === 'Actor' && doc.type === 'npc') {
        uuidField = 'system.npcUuids';
        reverseField = 'system.organizationUuid';
      } else if (data.type === 'Item' && doc.type === 'location') {
        uuidField = 'system.locationUuids';
        // Bidirectional: add this org to the location's organizationUuids
        reverseField = 'system.organizationUuids';
      } else {
        return;
      }
    } else if (docType === 'informationCard') {
      const dropKey = event.target.closest('[data-drop-key]')?.dataset?.dropKey;
      if (data.type === 'Item' && doc.type === 'location' && dropKey === 'foundAt') {
        const uuids = [...(system.foundAtUuids ?? [])];
        if (uuids.includes(data.uuid)) return;
        uuids.push(data.uuid);
        await this.document.update({ 'system.foundAtUuids': uuids });
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

    // Handle foundAtUuids (array) on info cards
    if (system.foundAtUuids?.includes(uuid)) {
      const updated = system.foundAtUuids.filter(u => u !== uuid);
      await this.document.update({ 'system.foundAtUuids': updated });
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
      {
        path: 'system.locationUuids',
        arr: system.locationUuids,
        reverse(doc) {
          if (!doc || docType !== 'organization') return;
          // Remove this org from the location's organizationUuids
          const orgUuids = (doc.system.organizationUuids ?? []).filter(u => u !== selfUuid);
          return doc.update({ 'system.organizationUuids': orgUuids });
        },
      },
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
