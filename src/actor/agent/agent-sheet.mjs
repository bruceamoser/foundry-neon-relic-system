/**
 * Agent (player character) sheet using ApplicationV2 with tabbed layout.
 * @module actor/agent/agent-sheet
 */

import { NRRollDialog } from '../../components/roll/roll-dialog.mjs';
import { CreationWizard } from './creation-wizard.mjs';
import { applyDebriefXP } from '../../components/game-systems.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';

export class AgentSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, 'agent-sheet'],
    position: {
      width: 720,
      height: 680,
    },
    actions: {
      rollAttribute: AgentSheet.#onRollAttribute,
      rollSkill: AgentSheet.#onRollSkill,
      toggleCondition: AgentSheet.#onToggleCondition,
      useTalent: AgentSheet.#onUseTalent,
      viewItem: AgentSheet.#onViewItem,
      adjustAttribute: AgentSheet.#onAdjustAttribute,
      adjustSkill: AgentSheet.#onAdjustSkill,
      launchWizard: AgentSheet.#onLaunchWizard,
      resetCreation: AgentSheet.#onResetCreation,
      healCorruption: AgentSheet.#onHealCorruption,
      shortRest: AgentSheet.#onShortRest,
      takeDamage: AgentSheet.#onTakeDamage,
      removeItem: AgentSheet.#onRemoveItem,
      addGear: AgentSheet.#onAddGear,
      addArtifact: AgentSheet.#onAddArtifact,
      addTalent: AgentSheet.#onAddTalent,
      addItem: AgentSheet.#onAddItem,
      awardXP: AgentSheet.#onAwardXP,
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    header: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-header.hbs`,
    },
    tabs: {
      template: 'templates/generic/tab-navigation.hbs',
    },
    summary: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-summary.hbs`,
      scrollable: [''],
    },
    attributes: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-attributes.hbs`,
      scrollable: [''],
    },
    combat: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-combat.hbs`,
      scrollable: [''],
    },
    gear: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-gear.hbs`,
      scrollable: [''],
    },
    talents: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-talents.hbs`,
      scrollable: [''],
    },
    corruption: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-corruption.hbs`,
      scrollable: [''],
    },
    biography: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-biography.hbs`,
      scrollable: [''],
    },
    progression: {
      template: `systems/${SYSTEM_ID}/templates/actor/agent/agent-progression.hbs`,
      scrollable: [''],
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: 'summary', group: 'primary', icon: 'fa-solid fa-user', label: 'NEONRELIC.Tab.Summary' },
        {
          id: 'attributes',
          group: 'primary',
          icon: 'fa-solid fa-chart-bar',
          label: 'NEONRELIC.Tab.Attributes',
        },
        { id: 'combat', group: 'primary', icon: 'fa-solid fa-crosshairs', label: 'NEONRELIC.Tab.Combat' },
        { id: 'gear', group: 'primary', icon: 'fa-solid fa-briefcase', label: 'NEONRELIC.Tab.Gear' },
        { id: 'talents', group: 'primary', icon: 'fa-solid fa-bolt', label: 'NEONRELIC.Tab.Talents' },
        {
          id: 'corruption',
          group: 'primary',
          icon: 'fa-solid fa-skull-crossbones',
          label: 'NEONRELIC.Tab.Corruption',
        },
        { id: 'biography', group: 'primary', icon: 'fa-solid fa-book', label: 'NEONRELIC.Tab.Biography' },
        { id: 'progression', group: 'primary', icon: 'fa-solid fa-arrow-trend-up', label: 'NEONRELIC.Tab.Progression' },
      ],
      initial: 'summary',
    },
  };

  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const system = actor.system;

    context.system = system;
    context.config = CONFIG.NEON_RELIC;
    context.isEditable = this.isEditable;
    context.isGM = game.user.isGM;
    context.actor = actor;

    // Organize items by type
    context.weapons = actor.items.filter(i => i.type === 'weapon');
    context.armor = actor.items.filter(i => i.type === 'armor');
    context.gear = actor.items.filter(i => i.type === 'gear');
    context.consumables = actor.items.filter(i => i.type === 'consumable');
    context.artifacts = actor.items.filter(i => i.type === 'artifact');
    context.divisionItems = actor.items.filter(i => i.type === 'divisionItem');
    context.talents = actor.items.filter(i => i.type === 'talent');

    // Talent XP gating
    const talentCount = context.talents.length;
    const freeTalents = 3;
    const talentXPCost = talentCount >= freeTalents ? 6 : 0;
    context.talentCount = talentCount;
    context.talentXPCost = talentXPCost;
    context.canAddTalent = talentCount < freeTalents || system.experience.current >= talentXPCost;
    if (talentXPCost > 0) {
      context.talentCostHint = game.i18n.format('NEONRELIC.Agent.TalentCost', {
        cost: talentXPCost,
        xp: system.experience.current,
      });
    } else {
      context.talentCostHint = game.i18n.localize('NEONRELIC.Agent.TalentFree');
    }

    context.criticalInjuries = actor.items.filter(i => i.type === 'criticalInjury');
    context.anchor = actor.items.find(i => i.type === 'anchor') ?? null;
    context.darkSecret = actor.items.find(i => i.type === 'darkSecret') ?? null;

    // Corruption stage
    const cv = system.corruption.value;
    if (cv <= 0) context.corruptionStage = 'Clean';
    else if (cv <= 3) context.corruptionStage = 'Touched';
    else if (cv <= 6) context.corruptionStage = 'Marked';
    else if (cv <= 9) context.corruptionStage = 'Consumed';
    else context.corruptionStage = 'Lost';

    // Encumbrance tier
    const enc = system.encumbrance;
    if (enc.current <= enc.max) context.encumbranceTier = 'normal';
    else if (enc.current <= enc.overloaded) context.encumbranceTier = 'encumbered';
    else context.encumbranceTier = 'overloaded';

    // Enriched HTML
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? '',
      {
        async: true,
        relativeTo: actor,
      },
    );

    // Damage type labels per attribute
    const damageLabels = {};
    for (const [, dt] of Object.entries(CONFIG.NEON_RELIC.damageTypes)) {
      damageLabels[dt.attribute] = dt.label;
    }

    // Skills grouped by attribute for 4-column layout
    const skillsByAttr = { str: [], agi: [], wit: [], emp: [] };
    for (const [key, skillConfig] of Object.entries(CONFIG.NEON_RELIC.skills)) {
      const entry = {
        key,
        label: skillConfig.label,
        value: system.skills[key] ?? 0,
      };
      skillsByAttr[skillConfig.attribute].push(entry);
      // Also add to secondary attribute column if defined (e.g., Heal under both EMP and WIT)
      if (skillConfig.secondaryAttribute) {
        skillsByAttr[skillConfig.secondaryAttribute].push({ ...entry, isSecondary: true });
      }
    }

    // Build attribute columns for the attr-skill grid
    context.attrColumns = [];
    for (const [attrKey, attrLabel] of Object.entries(CONFIG.NEON_RELIC.attributes)) {
      const attr = system.attributes[attrKey];
      const dmg = attr.max - attr.value;
      const dmgPips = [];
      for (let i = 0; i < attr.max; i++) {
        const filled = i < dmg;
        dmgPips.push({ filled, cssClass: filled ? 'pip filled' : 'pip' });
      }
      context.attrColumns.push({
        key: attrKey,
        label: attrLabel,
        value: attr.value,
        max: attr.max,
        isDamaged: attr.value < attr.max,
        damageLabel: damageLabels[attrKey] ?? '',
        damagePips: dmgPips,
        skills: skillsByAttr[attrKey],
      });
    }

    // Build point warnings for Summary tab display
    const budget = system.budget;
    const buildWarnings = { hasWarnings: false };
    if (budget.attrRemaining !== 0) {
      buildWarnings.hasWarnings = true;
      buildWarnings.attrDiff = Math.abs(budget.attrRemaining);
      if (budget.attrRemaining < 0) {
        buildWarnings.attrClass = 'build-warning--over';
        buildWarnings.attrIcon = 'fa-triangle-exclamation';
        buildWarnings.attrDiffText = game.i18n.format('NEONRELIC.Budget.Over', { n: buildWarnings.attrDiff });
      } else {
        buildWarnings.attrClass = 'build-warning--under';
        buildWarnings.attrIcon = 'fa-circle-info';
        buildWarnings.attrDiffText = game.i18n.format('NEONRELIC.Budget.Under', { n: buildWarnings.attrDiff });
      }
    }
    if (budget.skillRemaining !== 0) {
      buildWarnings.hasWarnings = true;
      buildWarnings.skillDiff = Math.abs(budget.skillRemaining);
      if (budget.skillRemaining < 0) {
        buildWarnings.skillClass = 'build-warning--over';
        buildWarnings.skillIcon = 'fa-triangle-exclamation';
        buildWarnings.skillDiffText = game.i18n.format('NEONRELIC.Budget.Over', { n: buildWarnings.skillDiff });
      } else {
        buildWarnings.skillClass = 'build-warning--under';
        buildWarnings.skillIcon = 'fa-circle-info';
        buildWarnings.skillDiffText = game.i18n.format('NEONRELIC.Budget.Under', { n: buildWarnings.skillDiff });
      }
    }
    context.buildWarnings = buildWarnings;

    // Progression tab: session debrief questions for XP tracking
    context.progressionQuestions = [
      { key: 'Q1', label: game.i18n.localize('NEONRELIC.Debrief.Q1'), auto: true },
      { key: 'Q2', label: game.i18n.localize('NEONRELIC.Debrief.Q2'), auto: false },
      { key: 'Q3', label: game.i18n.localize('NEONRELIC.Debrief.Q3'), auto: false },
      { key: 'Q4', label: game.i18n.localize('NEONRELIC.Debrief.Q4'), auto: false },
      { key: 'Q5', label: game.i18n.localize('NEONRELIC.Debrief.Q5'), auto: false },
    ];
    context.xpReport = {
      total: system.experience.total,
      spent: system.experience.spent,
      current: system.experience.current,
    };

    // Corruption pip array for numbered track
    const threshold = system.corruption.threshold;
    context.corruptionPips = [];
    for (let i = 1; i <= threshold; i++) {
      const filled = i <= cv;
      const danger = i > threshold - 3;
      let cls = 'pip';
      if (filled) cls += ' filled';
      if (danger) cls += ' danger';
      context.corruptionPips.push({
        number: i,
        filled,
        danger,
        cssClass: cls,
      });
    }

    // Flat skill entries (kept for backward compat)
    context.skillEntries = [];
    for (const [key, skillConfig] of Object.entries(CONFIG.NEON_RELIC.skills)) {
      context.skillEntries.push({
        key,
        label: skillConfig.label,
        attribute: skillConfig.attribute,
        value: system.skills[key] ?? 0,
        attrValue: system.attributes[skillConfig.attribute]?.value ?? 0,
      });
    }

    // Precomputed CSS classes for conditions
    context.brokenClass = system.conditions.isBroken ? 'condition-btn active' : 'condition-btn';
    context.dyingClass = system.conditions.isDying ? 'condition-btn active' : 'condition-btn';

    return context;
  }

  /* ------------------------------------------ */

  /** @override */
  _getHeaderControls() {
    const controls = super._getHeaderControls();
    controls.unshift(
      {
        icon: 'fa-solid fa-wand-magic-sparkles',
        label: game.i18n.localize('NEONRELIC.Wizard.Launch'),
        action: 'launchWizard',
        visible: !this.document.system.creationComplete,
      },
      {
        icon: 'fa-solid fa-rotate-left',
        label: game.i18n.localize('NEONRELIC.Wizard.Reset.Title'),
        action: 'resetCreation',
        visible: game.user.isGM,
      },
    );
    return controls;
  }

  /* ------------------------------------------ */

  /** @override */
  async _preparePartContext(partId, context, options) {
    const partContext = await super._preparePartContext(partId, context, options);
    partContext.tab = context.tabs?.[partId] ?? {};
    return partContext;
  }

  /* ------------------------------------------ */

  /** @override */
  async _onDropItem(event, data) {
    const item = await Item.implementation.fromDropData(data);
    if (!item) return super._onDropItem(event, data);

    // Handle subdivision drop — configure agent identity fields
    if (item.type === 'subdivision') {
      return this.#applySubdivision(item);
    }

    // Handle talent drop — enforce free talent limit and XP cost
    if (item.type === 'talent') {
      const talentCount = this.document.items.filter(i => i.type === 'talent').size;
      const freeTalents = 3;
      if (talentCount >= freeTalents) {
        const xpCost = 6;
        const xp = this.document.system.experience.current;
        if (xp < xpCost) {
          ui.notifications.warn(game.i18n.localize('NEONRELIC.Talent.InsufficientXP'));
          return;
        }
        // Deduct XP and allow the drop, tracking spent
        await this.document.update({
          'system.experience.current': xp - xpCost,
          'system.experience.spent': (this.document.system.experience.spent ?? 0) + xpCost,
        });
        ui.notifications.info(game.i18n.format('NEONRELIC.Talent.XPSpent', { cost: xpCost }));
      }
    }

    return super._onDropItem(event, data);
  }

  /**
   * Apply a subdivision item to the agent — sets division, sub-unit,
   * and prompts the user to choose a specialty.
   * @param {Item} subdivision
   */
  async #applySubdivision(subdivision) {
    const sys = subdivision.system;
    const specialties = sys.specialties ?? [];

    // Build specialty choices
    let specialty = '';
    if (specialties.length === 1) {
      specialty = specialties[0].label;
    } else if (specialties.length > 1) {
      const options = specialties.map(s => `<option value="${s.label}">${s.label}</option>`).join('');
      const content = `<form><div class="form-group"><label>${game.i18n.localize('NEONRELIC.Agent.Specialty')}</label><select name="specialty">${options}</select></div></form>`;
      const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize('NEONRELIC.Agent.Specialty') },
        content,
        ok: {
          callback: (event, button) => new FormData(button.form).get('specialty'),
        },
      });
      if (result === null) return; // cancelled
      specialty = result;
    }

    await this.document.update({
      'system.division': sys.division,
      'system.subUnit': subdivision.name,
      'system.specialty': specialty,
    });

    ui.notifications.info(game.i18n.format('NEONRELIC.Subdivision.Applied', { name: subdivision.name }));
  }

  /* ------------------------------------------ */
  /*  Action Handlers                            */
  /* ------------------------------------------ */

  /**
   * Launch the character creation wizard.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static #onLaunchWizard(_event, _target) {
    new CreationWizard(this.document).render(true);
  }

  /**
   * Reset character creation (GM only) — removes all items and resets fields.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onResetCreation(_event, _target) {
    if (!game.user.isGM) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('NEONRELIC.Wizard.Reset.Title') },
      content: `<p>${game.i18n.localize('NEONRELIC.Wizard.Reset.Confirm')}</p>`,
    });
    if (!confirmed) return;

    // Remove all embedded items
    const itemIds = this.document.items.map(i => i.id);
    if (itemIds.length) {
      await this.document.deleteEmbeddedDocuments('Item', itemIds);
    }

    // Reset system fields to defaults
    const skillReset = {};
    for (const key of Object.keys(CONFIG.NEON_RELIC.skills)) {
      skillReset[`system.skills.${key}`] = 0;
    }
    await this.document.update({
      name: 'New Agent',
      'system.division': '',
      'system.subUnit': '',
      'system.specialty': '',
      'system.ageGroup': 'experienced',
      'system.age': 0,
      'system.sex': '',
      'system.countryOfOrigin': '',
      'system.attributes.str.max': 3,
      'system.attributes.str.value': 3,
      'system.attributes.agi.max': 3,
      'system.attributes.agi.value': 3,
      'system.attributes.wit.max': 3,
      'system.attributes.wit.value': 3,
      'system.attributes.emp.max': 3,
      'system.attributes.emp.value': 3,
      'system.creationComplete': false,
      ...skillReset,
    });

    ui.notifications.info(game.i18n.localize('NEONRELIC.Wizard.Reset.Success'));
  }

  /**
   * Roll an attribute check.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRollAttribute(_event, target) {
    const attrKey = target.dataset.attribute;
    const attrValue = this.document.system.attributes[attrKey]?.value ?? 0;
    const gearItems = AgentSheet.#getGearForRoll(this.document, null, attrKey);
    const talentItems = AgentSheet.#getTalentsForRoll(this.document, null, attrKey);
    await NRRollDialog.prompt({
      attribute: attrKey,
      attributeValue: attrValue,
      actorId: this.document.id,
      gearItems,
      talentItems,
    });
  }

  /**
   * Roll a skill check.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRollSkill(_event, target) {
    const skillKey = target.dataset.skill;
    const skillConfig = CONFIG.NEON_RELIC.skills[skillKey];
    // Use secondary attribute if this is a secondary-column entry
    const isSecondary = target.dataset.secondary === 'true';
    const attrKey = isSecondary
      ? (skillConfig?.secondaryAttribute ?? skillConfig?.attribute ?? '')
      : (skillConfig?.attribute ?? '');
    const attrValue = this.document.system.attributes[attrKey]?.value ?? 0;
    const skillValue = this.document.system.skills[skillKey] ?? 0;
    const gearItems = AgentSheet.#getGearForRoll(this.document, skillKey, attrKey);
    const talentItems = AgentSheet.#getTalentsForRoll(this.document, skillKey, attrKey);
    await NRRollDialog.prompt({
      attribute: attrKey,
      attributeValue: attrValue,
      skill: skillKey,
      skillValue,
      actorId: this.document.id,
      gearItems,
      talentItems,
    });
  }

  /**
   * Collect gear items that could provide a bonus for a roll.
   * @param {Actor} actor
   * @param {string|null} skillKey
   * @param {string} attrKey
   * @returns {Array<{id: string, name: string, bonus: number}>}
   */
  static #getGearForRoll(actor, skillKey, attrKey) {
    const items = [];
    for (const item of actor.items) {
      if (item.type !== 'gear' && item.type !== 'weapon') continue;
      const bonus = item.system.gearBonus?.value ?? 0;
      if (bonus <= 0) continue;

      if (item.type === 'weapon') {
        // Include weapons whose skill matches the roll skill
        if (skillKey && item.system.skill === skillKey) {
          items.push({ id: item.id, name: item.name, bonus });
        }
        continue;
      }

      // Filter gear by skill if the gear specifies one
      if (item.type === 'gear' && item.system.skillBonus) {
        if (skillKey && item.system.skillBonus !== skillKey) continue;
        if (!skillKey) {
          // Attribute-only roll: include gear if its skill belongs to this attribute
          const gearSkillConfig = CONFIG.NEON_RELIC.skills[item.system.skillBonus];
          if (gearSkillConfig?.attribute !== attrKey) continue;
        }
      }
      items.push({ id: item.id, name: item.name, bonus });
    }
    return items;
  }

  /**
   * Collect talents relevant to a roll for display.
   * @param {Actor} actor
   * @param {string|null} skillKey
   * @param {string} attrKey
   * @returns {Array<{id: string, name: string, bonus: number, description: string}>}
   */
  static #getTalentsForRoll(actor, skillKey, _attrKey) {
    const items = [];
    for (const item of actor.items) {
      if (item.type !== 'talent') continue;
      const mod = item.system.conditionalModifier;
      if (!mod?.skill && !mod?.bonus) continue;
      // Include if the talent's conditional modifier matches the skill or attribute
      if (skillKey && mod.skill === skillKey) {
        items.push({ id: item.id, name: item.name, bonus: mod.bonus, description: mod.condition ?? '' });
      }
    }
    return items;
  }

  /**
   * Toggle a condition on/off.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onToggleCondition(_event, target) {
    const condition = target.dataset.condition;
    const current = this.document.system.conditions[condition];
    await this.document.update({ [`system.conditions.${condition}`]: !current });
  }

  /**
   * Use a talent (decrement uses, apply corruption).
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onUseTalent(_event, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item) await item.useTalent();
  }

  /**
   * Heal corruption via a dialog prompt.
   */
  static async #onHealCorruption() {
    const actor = this.document;
    const sys = actor.system.corruption;
    const maxSession = 5;
    const available = Math.max(0, maxSession - sys.sessionHealing);
    if (available <= 0) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Corruption.SessionCapReached'));
      return;
    }
    const maxHealable = Math.min(available, sys.value);
    if (maxHealable <= 0) {
      ui.notifications.info(game.i18n.localize('NEONRELIC.Corruption.NoneToHeal'));
      return;
    }
    const amount = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('NEONRELIC.Corruption.HealTitle') },
      content: `<div class="form-group"><label>${game.i18n.localize('NEONRELIC.Corruption.HealAmount')}</label><input type="number" name="amount" value="1" min="1" max="${maxHealable}" autofocus /></div><p class="hint">${game.i18n.format('NEONRELIC.Corruption.HealHint', { available })}</p>`,
      ok: {
        callback: (event, button) => Math.clamp(Number(button.form.elements.amount.value) || 0, 0, maxHealable),
      },
    });
    if (amount > 0) {
      await actor.healCorruption(amount);
      ui.notifications.info(game.i18n.format('NEONRELIC.Corruption.Healed', { amount }));
    }
  }

  /**
   * Short rest — recover +1 per damaged attribute.
   */
  static async #onShortRest() {
    const actor = this.document;
    await actor.shortRest();
    ui.notifications.info(game.i18n.localize('NEONRELIC.Agent.ShortRestApplied'));
  }

  /**
   * Take damage — prompt for type and amount.
   */
  static async #onTakeDamage() {
    const actor = this.document;
    const types = { physical: 'STR', hobbling: 'AGI', horror: 'WIT', trauma: 'EMP' };
    const options = Object.entries(types)
      .map(
        ([k, v]) =>
          `<option value="${k}">${v} — ${game.i18n.localize(CONFIG.NEON_RELIC.damageTypes[k]?.label ?? k)}</option>`,
      )
      .join('');
    const content = `<div class="form-group"><label>Type</label><select name="type">${options}</select></div>
      <div class="form-group"><label>Amount</label><input type="number" name="amount" value="1" min="1" max="10" autofocus /></div>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('NEONRELIC.Damage.TakeDamage') },
      content,
      ok: {
        callback: (event, button) => ({
          type: button.form.elements.type.value,
          amount: Number(button.form.elements.amount.value) || 0,
        }),
      },
    });
    if (result?.amount > 0) {
      await actor.applyDamage(result.amount, result.type);
      ui.notifications.info(
        game.i18n.format('NEONRELIC.Damage.Applied', { amount: result.amount, type: types[result.type] }),
      );
    }
  }

  /**
   * Remove an item from the actor.
   */
  static async #onRemoveItem(_event, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;
    const item = this.document.items.get(itemId);
    if (!item) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('NEONRELIC.Item.DeleteConfirm') },
      content: game.i18n.format('NEONRELIC.Item.DeleteConfirmText', { name: item.name }),
    });
    if (confirmed) await item.delete();
  }

  /**
   * Open a custom popup listing gear and consumables from compendiums,
   * filtered to items at or below the agent's Clearance Level.
   */
  static async #onAddGear(_event, _target) {
    const cl = this.document.system.clearanceLevel ?? 1;
    const packs = ['neon-relic.gear', 'neon-relic.consumables'];
    const items = [];

    for (const packId of packs) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      await pack.getIndex();
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        const itemCL = doc.system?.cl ?? doc.system?.clearanceLevel ?? 99;
        items.push({
          uuid: doc.uuid,
          name: doc.name,
          type: doc.type,
          cl: itemCL,
          img: doc.img,
          allowed: itemCL <= cl,
        });
      }
    }

    // Sort: allowed first, then by name
    items.sort((a, b) => b.allowed - a.allowed || a.name.localeCompare(b.name));

    const rows = items
      .map(
        i => `
        <li class="gear-popup-item ${i.allowed ? '' : 'locked'}" data-uuid="${i.uuid}"
            title="${i.allowed ? '' : game.i18n.localize('NEONRELIC.Agent.CLTooLow')}">
          <img src="${i.img}" class="gear-popup-img" alt="${i.name}" />
          <span class="gear-popup-name">${i.name}</span>
          <span class="gear-popup-type">${game.i18n.localize(`TYPES.Item.${i.type}`)}</span>
          <span class="gear-popup-cl">CL ${i.cl}</span>
          ${
            i.allowed
              ? `<button type="button" class="gear-popup-add" data-uuid="${i.uuid}">+</button>`
              : `<span class="gear-popup-locked"><i class="fa-solid fa-lock"></i></span>`
          }
        </li>`,
      )
      .join('');

    const content = `
      <div class="gear-popup">
        <p class="gear-popup-hint">${game.i18n.format('NEONRELIC.Agent.AddGearHint', { cl })}</p>
        <ul class="gear-popup-list">${rows}</ul>
      </div>`;

    const uuid = await AgentSheet.#itemPicker(game.i18n.localize('NEONRELIC.Item.AddGear'), content);

    if (uuid) {
      const doc = await fromUuid(uuid);
      if (doc) await this.document.createEmbeddedDocuments('Item', [doc.toObject()]);
    }
  }

  /**
   * Open a custom popup listing artifacts from compendiums,
   * filtered to items at or below the agent's Clearance Level.
   */
  static async #onAddArtifact(_event, _target) {
    const cl = this.document.system.clearanceLevel ?? 1;
    const pack = game.packs.get('neon-relic.artifacts');
    if (!pack) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Compendium.NotFound'));
      return;
    }

    await pack.getIndex();
    const docs = await pack.getDocuments();
    const items = [];

    for (const doc of docs) {
      const itemCL = doc.system?.cl ?? doc.system?.clearanceLevel ?? 99;
      items.push({
        uuid: doc.uuid,
        name: doc.name,
        type: doc.type,
        cl: itemCL,
        img: doc.img,
        allowed: itemCL <= cl,
      });
    }

    // Sort: allowed first, then by name
    items.sort((a, b) => b.allowed - a.allowed || a.name.localeCompare(b.name));

    const rows = items
      .map(
        i => `
        <li class="gear-popup-item ${i.allowed ? '' : 'locked'}" data-uuid="${i.uuid}"
            title="${i.allowed ? '' : game.i18n.localize('NEONRELIC.Agent.CLTooLow')}">
          <img src="${i.img}" class="gear-popup-img" alt="${i.name}" />
          <span class="gear-popup-name">${i.name}</span>
          <span class="gear-popup-cl">CL ${i.cl}</span>
          ${
            i.allowed
              ? `<button type="button" class="gear-popup-add" data-uuid="${i.uuid}">+</button>`
              : `<span class="gear-popup-locked"><i class="fa-solid fa-lock"></i></span>`
          }
        </li>`,
      )
      .join('');

    const content = `
      <div class="gear-popup">
        <p class="gear-popup-hint">${game.i18n.format('NEONRELIC.Agent.AddGearHint', { cl })}</p>
        <ul class="gear-popup-list">${rows}</ul>
      </div>`;

    const uuid = await AgentSheet.#itemPicker(game.i18n.localize('NEONRELIC.Item.AddArtifact'), content);

    if (uuid) {
      const doc = await fromUuid(uuid);
      if (doc) await this.document.createEmbeddedDocuments('Item', [doc.toObject()]);
    }
  }

  /**
   * Open a custom popup listing talents from the talents compendium.
   * XP gating is enforced before the popup opens.
   */
  static async #onAddTalent(_event, _target) {
    const talentCount = this.document.items.filter(i => i.type === 'talent').length;
    const freeTalents = 3;
    const xpCost = talentCount >= freeTalents ? 6 : 0;

    // XP gate check (belt-and-suspenders; button should already be disabled)
    if (xpCost > 0 && this.document.system.experience.current < xpCost) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Talent.InsufficientXP'));
      return;
    }

    const pack = game.packs.get('neon-relic.talents');
    if (!pack) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Compendium.NotFound'));
      return;
    }

    await pack.getIndex();
    const docs = await pack.getDocuments();
    const items = docs.map(doc => ({
      uuid: doc.uuid,
      name: doc.name,
      img: doc.img,
    }));
    items.sort((a, b) => a.name.localeCompare(b.name));

    const rows = items
      .map(
        i => `
        <li class="gear-popup-item" data-uuid="${i.uuid}">
          <img src="${i.img}" class="gear-popup-img" alt="${i.name}" />
          <span class="gear-popup-name">${i.name}</span>
          <button type="button" class="gear-popup-add" data-uuid="${i.uuid}">+</button>
        </li>`,
      )
      .join('');

    const costNote =
      xpCost > 0
        ? game.i18n.format('NEONRELIC.Agent.TalentCost', { cost: xpCost, xp: this.document.system.experience.current })
        : game.i18n.localize('NEONRELIC.Agent.TalentFree');

    const content = `
      <div class="gear-popup">
        <p class="gear-popup-hint">${costNote}</p>
        <ul class="gear-popup-list">${rows}</ul>
      </div>`;

    const uuid = await AgentSheet.#itemPicker(game.i18n.localize('NEONRELIC.Agent.AddTalent'), content);

    if (uuid) {
      const doc = await fromUuid(uuid);
      if (!doc) return;

      // Deduct XP if beyond free talents
      if (xpCost > 0) {
        await this.document.update({
          'system.experience.current': this.document.system.experience.current - xpCost,
          'system.experience.spent': (this.document.system.experience.spent ?? 0) + xpCost,
        });
        ui.notifications.info(game.i18n.format('NEONRELIC.Talent.XPSpent', { cost: xpCost }));
      }

      await this.document.createEmbeddedDocuments('Item', [doc.toObject()]);
    }
  }

  /**
   * Show a picker dialog with item rows. Returns the selected UUID or null.
   * @param {string} title  Dialog window title
   * @param {string} content  Pre-rendered HTML content
   * @returns {Promise<string|null>}
   */
  static #itemPicker(title, content) {
    return new Promise(resolve => {
      let resolved = false;
      const done = val => {
        if (resolved) return;
        resolved = true;
        resolve(val);
      };

      const dlg = new foundry.applications.api.DialogV2({
        window: { title },
        content,
        buttons: [
          {
            action: 'cancel',
            label: game.i18n.localize('Cancel'),
            callback: () => done(null),
          },
        ],
      });

      dlg.addEventListener('close', () => done(null));
      dlg.render(true).then(() => {
        dlg.element.find('.gear-popup-add').on('click', function (ev) {
          ev.preventDefault();
          done(this.dataset.uuid);
          dlg.close();
        });
      });
    });
  }

  /**
   * Add a new item of the specified type to this actor.
   * Creates the item, then opens its sheet for editing.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAddItem(_event, target) {
    const itemType = target.dataset.itemType;
    if (!itemType) return;

    const typeLabel = game.i18n.localize(`TYPES.Item.${itemType}`);
    const itemName = game.i18n.format('NEONRELIC.Agent.NewItem', { type: typeLabel });
    const itemData = { name: itemName, type: itemType };

    const [created] = await this.document.createEmbeddedDocuments('Item', [itemData]);
    if (created) created.sheet.render(true);
  }

  /**
   * Open an item's sheet when clicking its name.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onViewItem(_event, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item) item.sheet.render(true);
  }

  /**
   * Adjust an attribute max by +/−1.
   * During creation (budget remaining ≥ 0): free within 2–5.
   * Attributes never increase with XP.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAdjustAttribute(_event, target) {
    const key = target.dataset.attribute;
    const delta = Number(target.dataset.delta);
    const sys = this.document.system;
    const current = sys.attributes[key].max;
    const newVal = current + delta;

    // Enforce min 1, max 5
    if (newVal < 1 || newVal > 5) return;

    // Check budget when increasing
    if (delta > 0 && sys.budget.attrRemaining <= 0) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Budget.NoneRemaining'));
      return;
    }

    await this.document.update({
      [`system.attributes.${key}.max`]: newVal,
      [`system.attributes.${key}.value`]: newVal,
    });
  }

  /**
   * Adjust a skill value by +/−1.
   * During creation: free within budget (max 3, key skill max 4).
   * During play: +1 costs 5 XP.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAdjustSkill(_event, target) {
    const key = target.dataset.skill;
    const delta = Number(target.dataset.delta);
    const sys = this.document.system;
    const current = sys.skills[key] ?? 0;
    const newVal = current + delta;

    if (newVal < 0 || newVal > 5) return;

    // Determine max at creation (3 normally, 4 for key skill)
    const keySkill = this.document.items.find(i => i.type === 'subdivision')?.system.keySkill;
    const creationMax = key === keySkill ? 4 : 3;

    // If increasing and no budget remaining, require XP
    if (delta > 0 && sys.budget.skillRemaining <= 0) {
      const xpCost = 5;
      if (sys.experience.current < xpCost) {
        ui.notifications.warn(game.i18n.localize('NEONRELIC.Budget.InsufficientXP'));
        return;
      }
      // Spend XP — track spent
      await this.document.update({
        [`system.skills.${key}`]: newVal,
        'system.experience.current': sys.experience.current - xpCost,
        'system.experience.spent': (sys.experience.spent ?? 0) + xpCost,
      });
      return;
    }

    // During creation: enforce max
    if (delta > 0 && newVal > creationMax) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.Budget.SkillMaxReached'));
      return;
    }

    await this.document.update({ [`system.skills.${key}`]: newVal });
  }

  /**
   * Award debrief XP to the agent via a dialog prompt.
   * Calls applyDebriefXP which increments both current and total.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onAwardXP(_event, _target) {
    const actor = this.document;
    const amount = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('NEONRELIC.Debrief.Title') },
      content: `<div class="form-group"><label>${game.i18n.localize('NEONRELIC.Agent.XP')}</label><input type="number" name="amount" value="1" min="1" max="10" autofocus /></div><p class="hint">${game.i18n.localize('NEONRELIC.Debrief.XPAwardedHint')}</p>`,
      ok: {
        callback: (event, button) => Math.clamp(Number(button.form.elements.amount.value) || 0, 0, 10),
      },
    });
    if (amount > 0) {
      await applyDebriefXP(actor, amount);
    }
  }
}
