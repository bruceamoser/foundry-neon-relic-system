/**
 * Headquarters sheet using ApplicationV2.
 * Covenant Cell HQ — City Network, HQ Upgrade Tree, Personnel Recruitment,
 * Cell roster (agents + NPCs), Vault custody, and the Compromise log.
 * Rules source: Ch 12 — Headquarters Management (12-headquarters.adoc).
 * @module actor/headquarters/hq-sheet
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';
const UPGRADE_PACK = `${SYSTEM_ID}.hq-upgrades`;
const PERSONNEL_PACK = `${SYSTEM_ID}.hq-personnel`;

/** Standing rank thresholds → rank key. */
const RANK_THRESHOLDS = [
  { min: 20, key: 'covenantElite' },
  { min: 15, key: 'honored' },
  { min: 10, key: 'trusted' },
  { min: 5, key: 'acknowledged' },
  { min: 0, key: 'unknown' },
];

/** Standing gate: Tier 2 / Tier 3 unlocks (Ch 12 — Standing Rewards). */
const TIER_STANDING_GATE = { 1: 0, 2: 5, 3: 10 };

/** Minimum purchased capabilities in the tier below before higher tiers unlock. */
const TIER_PREREQ_COUNT = { 1: 0, 2: 1, 3: 2 };

export class HeadquartersSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, 'hq-sheet'],
    position: {
      width: 720,
      height: 800,
    },
    form: {
      submitOnChange: true,
    },
    actions: {
      switchTab: HeadquartersSheet.#onSwitchTab,
      purchaseUpgrade: HeadquartersSheet.#onPurchaseUpgrade,
      recruitPersonnel: HeadquartersSheet.#onRecruitPersonnel,
      removePersonnel: HeadquartersSheet.#onRemovePersonnel,
      togglePersonnelUsed: HeadquartersSheet.#onTogglePersonnelUsed,
      togglePersonnelCompromised: HeadquartersSheet.#onTogglePersonnelCompromised,
      addMember: HeadquartersSheet.#onAddMember,
      removeMember: HeadquartersSheet.#onRemoveMember,
      openMember: HeadquartersSheet.#onOpenMember,
      addArtifact: HeadquartersSheet.#onAddArtifact,
      removeArtifact: HeadquartersSheet.#onRemoveArtifact,
      consecrateVault: HeadquartersSheet.#onConsecrateVault,
      recordCompromise: HeadquartersSheet.#onRecordCompromise,
      deleteCompromise: HeadquartersSheet.#onDeleteCompromise,
      addCoverIdentity: HeadquartersSheet.#onAddCoverIdentity,
      removeCoverIdentity: HeadquartersSheet.#onRemoveCoverIdentity,
    },
  };

  /** @override */
  static PARTS = {
    header: {
      template: `systems/${SYSTEM_ID}/templates/actor/hq/hq-header.hbs`,
    },
    tabs: {
      template: `systems/${SYSTEM_ID}/templates/generic/tab-navigation.hbs`,
    },
    overview: {
      template: `systems/${SYSTEM_ID}/templates/actor/hq/hq-overview.hbs`,
      scrollable: [''],
    },
    upgrades: {
      template: `systems/${SYSTEM_ID}/templates/actor/hq/hq-upgrades.hbs`,
      scrollable: [''],
    },
    personnel: {
      template: `systems/${SYSTEM_ID}/templates/actor/hq/hq-personnel.hbs`,
      scrollable: [''],
    },
    members: {
      template: `systems/${SYSTEM_ID}/templates/actor/hq/hq-members.hbs`,
      scrollable: [''],
    },
    vault: {
      template: `systems/${SYSTEM_ID}/templates/actor/hq/hq-vault.hbs`,
      scrollable: [''],
    },
    log: {
      template: `systems/${SYSTEM_ID}/templates/actor/hq/hq-log.hbs`,
      scrollable: [''],
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        {
          id: 'overview',
          group: 'primary',
          icon: 'fa-solid fa-city',
          label: 'NEONRELIC.HQ.Tab.Overview',
        },
        {
          id: 'upgrades',
          group: 'primary',
          icon: 'fa-solid fa-hammer',
          label: 'NEONRELIC.HQ.Tab.Upgrades',
        },
        {
          id: 'personnel',
          group: 'primary',
          icon: 'fa-solid fa-user-tie',
          label: 'NEONRELIC.HQ.Tab.Personnel',
        },
        {
          id: 'members',
          group: 'primary',
          icon: 'fa-solid fa-users',
          label: 'NEONRELIC.HQ.Tab.Members',
        },
        {
          id: 'vault',
          group: 'primary',
          icon: 'fa-solid fa-shield-halved',
          label: 'NEONRELIC.HQ.Tab.Vault',
        },
        {
          id: 'log',
          group: 'primary',
          icon: 'fa-solid fa-clipboard-list',
          label: 'NEONRELIC.HQ.Tab.Log',
        },
      ],
    },
  };

  /* ------------------------------------------ */
  /*  Context                                   */
  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;

    context.system = system;
    context.isEditable = this.isEditable;
    context.isGM = game.user.isGM;
    context.actor = this.document;
    context.owner = this.document;

    // Standing rank label
    context.standingRankLabel = game.i18n.localize(`NEONRELIC.HQ.Rank.${this.#rankKey(system.standing)}`);

    // Standing pips (0-20 in groups of 5)
    context.standingPips = this.#buildPips(20, system.standing, true);

    // Threat pips (0-6) — color-coded
    context.threatPips = this.#buildPips(6, system.threat, false);

    // City network
    context.coverIdentities = (system.coverIdentities ?? []).map((value, index) => ({
      value,
      index,
    }));
    context.citySizeOptions = [
      { value: 'major', label: 'NEONRELIC.HQ.CitySize.Major' },
      { value: 'mid', label: 'NEONRELIC.HQ.CitySize.Mid' },
      { value: 'remote', label: 'NEONRELIC.HQ.CitySize.Remote' },
    ];

    // Upgrades (merged from compendium pack + purchased state)
    context.upgradeTiers = await this.#prepareUpgradeContext(system);

    // Personnel (pack entries + recruitment state)
    context.personnelRoster = await this.#preparePersonnelContext(system);

    // Cell members
    context.cellMembers = await this.#prepareMemberContext(system);

    // Vault
    context.vaultArtifacts = await this.#prepareArtifactContext(system);
    context.vaultDampeningEstablished = this.#isPurchased(system, 'hq-fac10');
    context.vaultStatusClass = context.vaultDampeningEstablished ? 'status-badge established' : 'status-badge critical';

    // Compromise log
    context.compromiseLog = (system.compromiseLog ?? []).map((entry, index) => ({
      index,
      caseNumber: entry.caseNumber,
      event: entry.event,
      outcome: entry.outcome,
    }));

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? '',
      {
        async: true,
        relativeTo: this.document,
      },
    );

    return context;
  }

  /* ------------------------------------------ */

  /** @override */
  async _preparePartContext(partId, context, options) {
    const partContext = await super._preparePartContext(partId, context, options);
    partContext.tab = context.tabs?.[partId] ?? {};
    return partContext;
  }

  /* ------------------------------------------ */
  /*  Data helpers                              */
  /* ------------------------------------------ */

  /**
   * Resolve the standing rank key for a Standing score.
   * @param {number} standing
   * @returns {string}
   */
  #rankKey(standing) {
    return RANK_THRESHOLDS.find(t => standing >= t.min)?.key ?? 'unknown';
  }

  /**
   * Build pip view models for a track.
   * @param {number} count   Total pips
   * @param {number} filled  Number filled
   * @param {boolean} milestones  Mark every 5th pip as a milestone
   * @returns {Array<{index: number, cssClass: string}>}
   */
  #buildPips(count, filled, milestones) {
    const pips = [];
    for (let i = 1; i <= count; i++) {
      let cssClass = 'pip';
      if (i <= filled) {
        if (!milestones && i >= 5) cssClass += ' filled critical';
        else if (!milestones && i >= 3) cssClass += ' filled warning';
        else cssClass += ' filled';
      }
      if (milestones && (i === 5 || i === 10 || i === 15 || i === 20)) cssClass += ' milestone';
      pips.push({ index: i, cssClass });
    }
    return pips;
  }

  /**
   * Is an upgrade recorded as purchased on the HQ?
   * @param {object} system
   * @param {string} upgradeId
   * @returns {boolean}
   */
  #isPurchased(system, upgradeId) {
    return Boolean(system.upgrades?.find(u => u.upgradeId === upgradeId && u.purchased));
  }

  /**
   * Load the upgrade compendium index.
   * @returns {Promise<Array<object>>}
   */
  async #getUpgradeEntries() {
    const pack = game.packs.get(UPGRADE_PACK);
    if (!pack) return [];
    const index = await pack.getIndex({
      fields: [
        'img',
        'system.tier',
        'system.dpCost',
        'system.standingRequirement',
        'system.category',
        'system.prerequisites',
        'system.effect',
        'system.description',
      ],
    });
    return Array.from(index);
  }

  /**
   * Evaluate an upgrade's availability against current HQ state.
   * @param {object} entry  Compendium index entry
   * @param {object} state  {purchasedIds, purchasedByTier, dp, standing}
   * @returns {{purchased: boolean, available: boolean, lockReasons: string[]}}
   */
  #evaluateUpgrade(entry, state) {
    const id = entry._id;
    const sys = entry.system ?? {};
    const tier = Number(sys.tier ?? 1);

    if (state.purchasedIds.has(id)) {
      return { purchased: true, available: false, lockReasons: [] };
    }

    const lockReasons = [];

    // Capability prerequisites (specific capabilities in the tree)
    const prereqs = sys.prerequisites ?? [];
    if (prereqs.some(prereqId => !state.purchasedIds.has(prereqId))) {
      lockReasons.push('needPrereq');
    }

    // Tier gate — tier N requires purchased capabilities in tier N-1
    if (tier > 1 && (state.purchasedByTier[tier - 1] ?? 0) < TIER_PREREQ_COUNT[tier]) {
      lockReasons.push('needTier');
    }

    // Standing gates — tier unlock threshold + per-upgrade Standing gate
    const standingGate = Math.max(TIER_STANDING_GATE[tier] ?? 0, Number(sys.standingRequirement ?? 0));
    if (state.standing < standingGate) lockReasons.push('needStanding');

    // Affordability
    if (state.dp < Number(sys.dpCost ?? 0)) lockReasons.push('needDP');

    return { purchased: false, available: lockReasons.length === 0, lockReasons };
  }

  /**
   * Snapshot the purchase-relevant state from the HQ.
   * @param {object} system
   * @returns {{purchasedIds: Set<string>, purchasedByTier: Record<number, number>, dp: number, standing: number}}
   */
  #purchaseState(system) {
    const purchasedIds = new Set((system.upgrades ?? []).filter(u => u.purchased).map(u => u.upgradeId));
    return {
      purchasedIds,
      purchasedByTier: {},
      dp: system.dp,
      standing: system.standing,
    };
  }

  /**
   * Prepare upgrade tree context (grouped by tier, with availability).
   * @param {object} system
   * @returns {Promise<Array<object>>}
   */
  async #prepareUpgradeContext(system) {
    const entries = await this.#getUpgradeEntries();
    const state = this.#purchaseState(system);

    // Count purchased capabilities per tier (needed for tier gating)
    for (const entry of entries) {
      if (!state.purchasedIds.has(entry._id)) continue;
      const tier = Number(entry.system?.tier ?? 1);
      state.purchasedByTier[tier] = (state.purchasedByTier[tier] ?? 0) + 1;
    }

    const nameById = new Map(entries.map(e => [e._id, e.name]));
    const tiers = [1, 2, 3].map(tier => ({
      tier,
      label: `NEONRELIC.HQ.UpgradeTier.${tier}`,
      standingGate: TIER_STANDING_GATE[tier] ?? 0,
      items: [],
      established: state.purchasedByTier[tier] ?? 0,
      total: 0,
    }));

    for (const entry of entries) {
      const sys = entry.system ?? {};
      const tier = Number(sys.tier ?? 1);
      const evaluation = this.#evaluateUpgrade(entry, state);
      const bucket = tiers.find(t => t.tier === tier);
      if (!bucket) continue;

      const prereqNames = (sys.prerequisites ?? []).map(id => nameById.get(id) ?? id);
      const category = String(sys.category ?? 'facility');
      bucket.items.push({
        id: entry._id,
        name: entry.name,
        img: entry.img,
        dpCost: sys.dpCost ?? 0,
        standingRequirement: Math.max(TIER_STANDING_GATE[tier] ?? 0, Number(sys.standingRequirement ?? 0)),
        specificStandingRequirement: Number(sys.standingRequirement ?? 0),
        category,
        categoryLabel: `NEONRELIC.Upgrade.${category.charAt(0).toUpperCase()}${category.slice(1)}`,
        prerequisites: prereqNames,
        prereqText: prereqNames.join(', '),
        hasPrerequisites: prereqNames.length > 0,
        effect: sys.effect ?? '',
        description: sys.description ?? '',
        purchased: evaluation.purchased,
        available: evaluation.available,
        cardClass: `upgrade-card${evaluation.purchased ? ' established' : evaluation.available ? ' available' : ' locked'}`,
        lockReasons: evaluation.lockReasons,
        lockReasonText: this.#formatLockReasons(evaluation.lockReasons),
      });
      bucket.total++;
    }

    return tiers;
  }

  /**
   * Format lock reasons into a localized, comma-joined string.
   * @param {string[]} lockReasons
   * @returns {string}
   */
  #formatLockReasons(lockReasons) {
    if (!lockReasons.length) return '';
    return lockReasons.map(r => game.i18n.localize(`NEONRELIC.HQ.Lock.${r}`)).join(' · ');
  }

  /**
   * Load the personnel compendium index.
   * @returns {Promise<Array<object>>}
   */
  async #getPersonnelEntries() {
    const pack = game.packs.get(PERSONNEL_PACK);
    if (!pack) return [];
    const index = await pack.getIndex({
      fields: ['img', 'system.personnelType', 'system.dpCost', 'system.hqBonus', 'system.description'],
    });
    return Array.from(index).map(entry => ({
      ...entry,
      uuid: `Compendium.${pack.collection}.Actor.${entry._id}`,
    }));
  }

  /**
   * Does a stored personnelId refer to a compendium entry?
   * @param {string} storedId
   * @param {object} entry
   * @returns {boolean}
   */
  #matchesPersonnelId(storedId, entry) {
    if (!storedId) return false;
    return storedId === entry.uuid || storedId.split('.').pop() === entry._id;
  }

  /**
   * Prepare personnel context (pack roster + recruitment state).
   * @param {object} system
   * @returns {Promise<Array<object>>}
   */
  async #preparePersonnelContext(system) {
    const entries = await this.#getPersonnelEntries();
    const recorded = system.personnel ?? [];

    // Include stored personnel that no longer exist in the pack (e.g. world NPCs)
    const orphaned = recorded.filter(entry => !entries.some(e => this.#matchesPersonnelId(entry.personnelId, e)));

    const roster = entries.map(entry => {
      const state = recorded.find(rec => this.#matchesPersonnelId(rec.personnelId, entry));
      return {
        uuid: entry.uuid,
        id: entry._id,
        name: entry.name,
        img: entry.img,
        dpCost: entry.system?.dpCost ?? 0,
        hqBonus: entry.system?.hqBonus ?? '',
        description: entry.system?.description ?? '',
        recruited: Boolean(state),
        usedThisCase: state?.usedThisCase ?? false,
        isCompromised: state?.isCompromised ?? false,
        cardClass: `personnel-card${state ? ' recruited' : ''}${state?.isCompromised ? ' compromised' : ''}`,
        usedBtnClass: `toggle-btn${state?.usedThisCase ? ' active' : ''}`,
        compBtnClass: `toggle-btn danger${state?.isCompromised ? ' active' : ''}`,
        affordable: system.dp >= (entry.system?.dpCost ?? 0),
      };
    });

    for (const orphan of orphaned) {
      const doc = await this.#resolveUuid(orphan.personnelId);
      roster.push({
        uuid: orphan.personnelId,
        id: orphan.personnelId,
        name: doc?.name ?? game.i18n.localize('NEONRELIC.HQ.PersonnelMissing'),
        img: doc?.img,
        dpCost: 0,
        hqBonus: '',
        description: '',
        recruited: true,
        usedThisCase: orphan.usedThisCase,
        isCompromised: orphan.isCompromised,
        cardClass: `personnel-card recruited${orphan.isCompromised ? ' compromised' : ''}`,
        usedBtnClass: `toggle-btn${orphan.usedThisCase ? ' active' : ''}`,
        compBtnClass: `toggle-btn danger${orphan.isCompromised ? ' active' : ''}`,
        affordable: true,
        orphaned: true,
      });
    }

    return roster;
  }

  /**
   * Prepare the cell member roster (agents + NPCs assigned to the HQ).
   * @param {object} system
   * @returns {Promise<Array<object>>}
   */
  async #prepareMemberContext(system) {
    const members = [];
    for (const uuid of system.cellMembers ?? []) {
      const doc = await this.#resolveUuid(uuid);
      members.push({
        uuid,
        name: doc?.name ?? game.i18n.localize('NEONRELIC.HQ.MemberMissing'),
        img: doc?.img,
        isAgent: doc?.type === 'agent',
        isNPC: doc?.type === 'npc',
        typeLabel: doc ? `NEONRELIC.ActorType.${doc.type}` : 'NEONRELIC.HQ.MemberMissing',
        missing: !doc,
        rowClass: `member-row${doc ? '' : ' missing'}`,
      });
    }
    return members;
  }

  /**
   * Prepare vault artifact context.
   * @param {object} system
   * @returns {Promise<Array<object>>}
   */
  async #prepareArtifactContext(system) {
    const artifacts = [];
    for (const uuid of system.vault?.storedArtifacts ?? []) {
      const doc = await this.#resolveUuid(uuid);
      artifacts.push({
        uuid,
        name: doc?.name ?? game.i18n.localize('NEONRELIC.HQ.ArtifactMissing'),
        img: doc?.img,
        missing: !doc,
        rowClass: `vault-row${doc ? '' : ' missing'}`,
      });
    }
    return artifacts;
  }

  /**
   * Safely resolve a document from a UUID.
   * @param {string} uuid
   * @returns {Promise<foundry.abstract.Document|null>}
   */
  async #resolveUuid(uuid) {
    try {
      return await fromUuid(uuid);
    } catch {
      return null;
    }
  }

  /* ------------------------------------------ */
  /*  Drag & drop                               */
  /* ------------------------------------------ */

  /**
   * Route a dropped Actor: personnel becomes recruited staff; any other actor
   * joins the cell roster. Foundry v14 resolves the document before invoking
   * this hook (the base `_onDrop(event)` dispatches `_onDropDocument`).
   * @param {DragEvent} _event
   * @param {Actor} actor     The dropped (resolved) Actor document
   * @returns {Promise<null>}
   * @override
   */
  async _onDropActor(_event, actor) {
    const isPersonnel = Boolean(actor.system?.personnelType);
    if (isPersonnel) {
      const result = await this.#recruitPersonnelByUuid(actor.uuid, {
        name: actor.name,
        dpCost: actor.system?.dpCost ?? 0,
      });
      if (!result.ok && !result.message.endsWith('.Cancelled')) {
        ui.notifications.warn(game.i18n.format(result.message, { name: actor.name }));
      }
      return null;
    }

    await this.#addCellMember(actor.uuid, actor.name);
    return null;
  }

  /**
   * Route a dropped Item: upgrades are purchased, artifacts enter vault
   * custody. Other item types are ignored with a warning (the HQ holds no
   * inventory of its own).
   * @param {DragEvent} _event
   * @param {Item} item       The dropped (resolved) Item document
   * @returns {Promise<null>}
   * @override
   */
  async _onDropItem(_event, item) {
    if (item.type === 'upgrade') {
      const result = await this.#purchaseUpgradeById(item.id, {
        name: item.name,
        dpCost: item.system?.dpCost,
        tier: item.system?.tier,
        standingRequirement: item.system?.standingRequirement,
        prerequisites: item.system?.prerequisites,
      });
      if (!result.ok && !result.message.endsWith('.Cancelled')) {
        ui.notifications.warn(game.i18n.format(result.message, { name: item.name }));
      }
      return null;
    }

    if (item.type === 'artifact') {
      await this.#addVaultArtifact(item.uuid, item.name);
      return null;
    }

    ui.notifications.warn(game.i18n.format('NEONRELIC.HQ.DropUnsupported', { name: item.name }));
    return null;
  }

  /* ------------------------------------------ */
  /*  Purchase / recruitment                    */
  /* ------------------------------------------ */

  /**
   * Purchase an upgrade: validate, deduct DP, record the purchase.
   * @param {string} upgradeId
   * @param {object} [dropped]  Metadata for items dropped from outside the pack
   * @returns {Promise<{ok: boolean, message: string, reasons?: string}>}
   */
  async #purchaseUpgradeById(upgradeId, dropped = null) {
    if (!this.isEditable) return { ok: false, message: 'NEONRELIC.HQ.NotEditable' };

    const system = this.document.system;
    const entries = await this.#getUpgradeEntries();
    const entry =
      entries.find(e => e._id === upgradeId) ??
      (dropped ? { _id: upgradeId, name: dropped.name, system: dropped } : null);
    if (!entry) return { ok: false, message: 'NEONRELIC.HQ.UpgradeNotFound' };

    const state = this.#purchaseState(system);
    for (const e of entries) {
      if (!state.purchasedIds.has(e._id)) continue;
      const tier = Number(e.system?.tier ?? 1);
      state.purchasedByTier[tier] = (state.purchasedByTier[tier] ?? 0) + 1;
    }

    const evaluation = this.#evaluateUpgrade(entry, state);
    if (evaluation.purchased) {
      return { ok: false, message: 'NEONRELIC.HQ.AlreadyEstablished', name: entry.name };
    }
    if (!evaluation.available) {
      return {
        ok: false,
        message: 'NEONRELIC.HQ.CannotEstablish',
        reasons: this.#formatLockReasons(evaluation.lockReasons),
      };
    }

    const dpCost = Number(entry.system?.dpCost ?? 0);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('NEONRELIC.HQ.Establish.Title') },
      content: `<p>${game.i18n.format('NEONRELIC.HQ.Establish.Confirm', {
        name: entry.name,
        cost: dpCost,
      })}</p>`,
    });
    if (!confirmed) return { ok: false, message: 'NEONRELIC.HQ.Establish.Cancelled' };

    const upgrades = foundry.utils.deepClone(system.upgrades ?? []);
    const existing = upgrades.find(u => u.upgradeId === upgradeId);
    if (existing) existing.purchased = true;
    else upgrades.push({ upgradeId, purchased: true });

    await this.document.update({
      'system.dp': Math.max(0, system.dp - dpCost),
      'system.upgrades': upgrades,
    });

    ui.notifications.info(game.i18n.format('NEONRELIC.HQ.Establish.Done', { name: entry.name, cost: dpCost }));
    return { ok: true, message: 'NEONRELIC.HQ.Establish.Done' };
  }

  /**
   * Recruit personnel by UUID: validate DP, deduct, record.
   * @param {string} uuid
   * @param {object} [dropped]  Metadata for actors dropped from outside the pack
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async #recruitPersonnelByUuid(uuid, dropped = null) {
    if (!this.isEditable) return { ok: false, message: 'NEONRELIC.HQ.NotEditable' };

    const system = this.document.system;
    const entries = await this.#getPersonnelEntries();
    const entry =
      entries.find(e => this.#matchesPersonnelId(uuid, e)) ??
      (dropped ? { uuid, name: dropped.name, system: dropped } : null);
    if (!entry) return { ok: false, message: 'NEONRELIC.HQ.PersonnelNotFound' };

    const recorded = system.personnel ?? [];
    if (recorded.some(rec => this.#matchesPersonnelId(rec.personnelId, entry))) {
      return { ok: false, message: 'NEONRELIC.HQ.AlreadyRecruited' };
    }

    const dpCost = Number(entry.system?.dpCost ?? 0);
    if (system.dp < dpCost) {
      return { ok: false, message: 'NEONRELIC.HQ.CannotRecruit' };
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('NEONRELIC.HQ.Recruit.Title') },
      content: `<p>${game.i18n.format('NEONRELIC.HQ.Recruit.Confirm', {
        name: entry.name,
        cost: dpCost,
      })}</p>`,
    });
    if (!confirmed) return { ok: false, message: 'NEONRELIC.HQ.Recruit.Cancelled' };

    const personnel = foundry.utils.deepClone(recorded);
    personnel.push({ personnelId: entry.uuid ?? uuid, usedThisCase: false, isCompromised: false });

    await this.document.update({
      'system.dp': Math.max(0, system.dp - dpCost),
      'system.personnel': personnel,
    });

    ui.notifications.info(game.i18n.format('NEONRELIC.HQ.Recruit.Done', { name: entry.name, cost: dpCost }));
    return { ok: true, message: 'NEONRELIC.HQ.Recruit.Done' };
  }

  /* ------------------------------------------ */
  /*  Cell roster / vault helpers               */
  /* ------------------------------------------ */

  /**
   * Add an actor to the cell roster (idempotent).
   * @param {string} uuid
   * @param {string} name
   */
  async #addCellMember(uuid, name) {
    if (!this.isEditable) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.HQ.NotEditable'));
      return;
    }
    const members = this.document.system.cellMembers ?? [];
    if (members.includes(uuid)) {
      ui.notifications.warn(game.i18n.format('NEONRELIC.HQ.MemberExists', { name }));
      return;
    }
    await this.document.update({ 'system.cellMembers': [...members, uuid] });
    ui.notifications.info(game.i18n.format('NEONRELIC.HQ.MemberAdded', { name }));
  }

  /**
   * Add an artifact to vault custody (max 3).
   * @param {string} uuid
   * @param {string} name
   */
  async #addVaultArtifact(uuid, name) {
    if (!this.isEditable) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.HQ.NotEditable'));
      return;
    }
    const stored = this.document.system.vault?.storedArtifacts ?? [];
    if (stored.includes(uuid)) {
      ui.notifications.warn(game.i18n.format('NEONRELIC.HQ.Vault.ArtifactExists', { name }));
      return;
    }
    if (stored.length >= 3) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.HQ.Vault.Full'));
      return;
    }
    await this.document.update({ 'system.vault.storedArtifacts': [...stored, uuid] });
    ui.notifications.info(game.i18n.format('NEONRELIC.HQ.Vault.ArtifactAdded', { name }));
  }

  /* ------------------------------------------ */
  /*  Actions                                   */
  /* ------------------------------------------ */

  /**
   * Switch to a specific tab by group and tab ID.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onSwitchTab(_event, target) {
    const group = target.dataset.tabGroup || 'primary';
    const tab = target.dataset.tab;
    if (tab) this.changeTab(tab, group);
  }

  /**
   * Purchase an upgrade from the upgrade tree.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onPurchaseUpgrade(_event, target) {
    const upgradeId = target.dataset.upgradeId;
    if (!upgradeId) return;
    const result = await this.#purchaseUpgradeById(upgradeId);
    if (result.ok) return;
    if (result.message.endsWith('.Cancelled')) return;
    ui.notifications.warn(
      game.i18n.format(result.message, {
        name: target.dataset.upgradeName ?? '',
        reasons: result.reasons ?? '',
      }),
    );
  }

  /**
   * Recruit personnel from the roster.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRecruitPersonnel(_event, target) {
    const uuid = target.dataset.personnelUuid;
    if (!uuid) return;
    const result = await this.#recruitPersonnelByUuid(uuid);
    if (result.ok) return;
    if (result.message.endsWith('.Cancelled')) return;
    ui.notifications.warn(game.i18n.format(result.message, { name: target.dataset.personnelName ?? '' }));
  }

  /**
   * Remove recruited personnel (no DP refund — DA adjudicates).
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemovePersonnel(_event, target) {
    const uuid = target.dataset.personnelUuid;
    if (!uuid) return;
    const system = this.document.system;
    const entries = await this.#getPersonnelEntries();
    const entry = entries.find(e => this.#matchesPersonnelId(uuid, e));

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('NEONRELIC.HQ.PersonnelRemove.Title') },
      content: `<p>${game.i18n.format('NEONRELIC.HQ.PersonnelRemove.Confirm', {
        name: entry?.name ?? target.dataset.personnelName ?? '',
      })}</p>`,
    });
    if (!confirmed) return;

    const personnel = (system.personnel ?? []).filter(
      rec => rec.personnelId !== uuid && !(entry && this.#matchesPersonnelId(rec.personnelId, entry)),
    );
    await this.document.update({ 'system.personnel': personnel });
  }

  /**
   * Toggle a personnel contact's "used this Case File" flag.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onTogglePersonnelUsed(_event, target) {
    await this.#togglePersonnelFlag(target.dataset.personnelUuid, 'usedThisCase');
  }

  /**
   * Toggle a personnel contact's "compromised" flag.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onTogglePersonnelCompromised(_event, target) {
    await this.#togglePersonnelFlag(target.dataset.personnelUuid, 'isCompromised');
  }

  /**
   * Flip one boolean flag on a recorded personnel entry.
   * @param {string} uuid
   * @param {'usedThisCase'|'isCompromised'} flag
   */
  async #togglePersonnelFlag(uuid, flag) {
    if (!this.isEditable) return;
    const system = this.document.system;
    const entries = await this.#getPersonnelEntries();
    const entry = entries.find(e => this.#matchesPersonnelId(uuid, e));
    const personnel = foundry.utils.deepClone(system.personnel ?? []);
    const record = personnel.find(
      rec => rec.personnelId === uuid || (entry && this.#matchesPersonnelId(rec.personnelId, entry)),
    );
    if (!record) return;
    record[flag] = !record[flag];
    await this.document.update({ 'system.personnel': personnel });
  }

  /**
   * Open the member picker dialog (world agents + NPCs).
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onAddMember(_event, _target) {
    if (!this.isEditable) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.HQ.NotEditable'));
      return;
    }

    const candidates = game.actors.filter(a => a.type === 'agent' || a.type === 'npc');
    if (!candidates.length) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.HQ.MembersNoneAvailable'));
      return;
    }

    const current = this.document.system.cellMembers ?? [];
    const rows = candidates
      .map(actor => {
        const checked = current.includes(actor.uuid) ? 'checked' : '';
        return `<label class="hq-member-option"><input type="checkbox" name="member" value="${actor.uuid}" ${checked} /> ${foundry.utils.escapeHTML(actor.name)} <span class="hint">(${game.i18n.localize(`NEONRELIC.ActorType.${actor.type}`)})</span></label>`;
      })
      .join('');

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('NEONRELIC.HQ.Members.Title') },
      // NOTE: DialogV2 wraps content in its own <form>; a nested <form> here would be
      // dropped by the HTML parser (taking this class with it). Use a div.
      content: `<div class="hq-member-picker">${rows}</div>`,
      ok: {
        label: game.i18n.localize('NEONRELIC.HQ.Members.Save'),
        callback: (event, button) => Array.from(new FormData(button.form).getAll('member')),
      },
    });
    if (result === null) return;

    await this.document.update({ 'system.cellMembers': result });
    ui.notifications.info(game.i18n.format('NEONRELIC.HQ.Members.Updated', { count: result.length }));
  }

  /**
   * Remove a member from the cell roster.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveMember(_event, target) {
    const uuid = target.dataset.memberUuid;
    if (!uuid) return;
    const members = (this.document.system.cellMembers ?? []).filter(m => m !== uuid);
    await this.document.update({ 'system.cellMembers': members });
  }

  /**
   * Open a member's sheet.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onOpenMember(_event, target) {
    const uuid = target.dataset.memberUuid;
    if (!uuid) return;
    const doc = await this.#resolveUuid(uuid);
    doc?.sheet?.render(true);
  }

  /**
   * Open the artifact picker dialog (world artifact items).
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onAddArtifact(_event, _target) {
    if (!this.isEditable) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.HQ.NotEditable'));
      return;
    }

    const stored = this.document.system.vault?.storedArtifacts ?? [];
    if (stored.length >= 3) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.HQ.Vault.Full'));
      return;
    }

    const worldItems = game.items.filter(i => i.type === 'artifact');
    // NOTE: Foundry's Collection has no flatMap — iterate world actors manually.
    const carriedItems = [];
    for (const owner of game.actors) {
      for (const item of owner.items) {
        if (item.type !== 'artifact') continue;
        carriedItems.push({ uuid: item.uuid, name: `${item.name} — ${owner.name}` });
      }
    }
    const all = [...worldItems.map(i => ({ uuid: i.uuid, name: i.name })), ...carriedItems].filter(
      c => !stored.includes(c.uuid),
    );

    if (!all.length) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.HQ.Vault.NoneAvailable'));
      return;
    }

    const options = all.map(c => `<option value="${c.uuid}">${foundry.utils.escapeHTML(c.name)}</option>`).join('');
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('NEONRELIC.HQ.Vault.AddTitle') },
      content: `<div class="form-group"><label>${game.i18n.localize('NEONRELIC.HQ.Vault.Artifact')}</label><select name="artifact">${options}</select></div>`,
      ok: {
        label: game.i18n.localize('NEONRELIC.HQ.Vault.Add'),
        callback: (event, button) => new FormData(button.form).get('artifact'),
      },
    });
    if (!result) return;

    const chosen = all.find(c => c.uuid === result);
    await this.#addVaultArtifact(result, chosen?.name ?? '');
  }

  /**
   * Remove an artifact from vault custody.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveArtifact(_event, target) {
    const uuid = target.dataset.artifactUuid;
    if (!uuid) return;
    const stored = (this.document.system.vault?.storedArtifacts ?? []).filter(u => u !== uuid);
    await this.document.update({ 'system.vault.storedArtifacts': stored });
  }

  /**
   * Re-consecrate the vault (reset the case counter; DA resolves the Lore roll).
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onConsecrateVault(_event, _target) {
    if (!this.isEditable) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('NEONRELIC.HQ.Consecrate.Title') },
      content: `<p>${game.i18n.localize('NEONRELIC.HQ.Consecrate.Confirm')}</p>`,
    });
    if (!confirmed) return;
    await this.document.update({ 'system.vault.casesSinceConsecration': 0 });
    ui.notifications.info(game.i18n.localize('NEONRELIC.HQ.Consecrate.Done'));
  }

  /**
   * Record a Compromise Event in the log (also sets the Threat Meter).
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onRecordCompromise(_event, _target) {
    if (!this.isEditable) return;
    const system = this.document.system;

    const content = `
      <div class="hq-compromise-form">
        <div class="form-group">
          <label>${game.i18n.localize('NEONRELIC.HQ.Log.CaseNumber')}</label>
          <input type="number" name="caseNumber" value="0" min="0" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('NEONRELIC.HQ.Log.Event')}</label>
          <input type="text" name="event" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('NEONRELIC.HQ.Log.Outcome')}</label>
          <input type="text" name="outcome" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('NEONRELIC.HQ.Log.ThreatAfter')}</label>
          <input type="number" name="threatAfter" value="${system.threat}" min="0" max="6" />
        </div>
      </div>`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('NEONRELIC.HQ.Log.RecordTitle') },
      content,
      ok: {
        label: game.i18n.localize('NEONRELIC.HQ.Log.Record'),
        callback: (event, button) => {
          const form = new FormData(button.form);
          return {
            caseNumber: Number(form.get('caseNumber')) || 0,
            event: String(form.get('event') ?? '').trim(),
            outcome: String(form.get('outcome') ?? '').trim(),
            threatAfter: Number(form.get('threatAfter')),
          };
        },
      },
    });
    if (!result) return;

    const log = foundry.utils.deepClone(system.compromiseLog ?? []);
    log.push({
      caseNumber: result.caseNumber,
      event: result.event,
      outcome: result.outcome,
    });

    const threat = Number.isFinite(result.threatAfter) ? Math.clamp(result.threatAfter, 0, 6) : system.threat;

    await this.document.update({ 'system.compromiseLog': log, 'system.threat': threat });
    ui.notifications.info(game.i18n.localize('NEONRELIC.HQ.Log.Recorded'));
  }

  /**
   * Delete a Compromise log row.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onDeleteCompromise(_event, target) {
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index)) return;
    const log = foundry.utils.deepClone(this.document.system.compromiseLog ?? []);
    log.splice(index, 1);
    await this.document.update({ 'system.compromiseLog': log });
  }

  /**
   * Add a cover identity to the network.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onAddCoverIdentity(_event, _target) {
    if (!this.isEditable) return;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('NEONRELIC.HQ.CoverIdentity.AddTitle') },
      content: `<div class="form-group"><label>${game.i18n.localize('NEONRELIC.HQ.CoverIdentity.Label')}</label><input type="text" name="identity" autofocus /></div>`,
      ok: {
        callback: (event, button) => String(new FormData(button.form).get('identity') ?? '').trim(),
      },
    });
    if (!result) return;
    const identities = [...(this.document.system.coverIdentities ?? []), result];
    await this.document.update({ 'system.coverIdentities': identities });
  }

  /**
   * Remove a cover identity by index.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveCoverIdentity(_event, target) {
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index)) return;
    const identities = [...(this.document.system.coverIdentities ?? [])];
    identities.splice(index, 1);
    await this.document.update({ 'system.coverIdentities': identities });
  }
}
