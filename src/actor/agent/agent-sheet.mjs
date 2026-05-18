/**
 * Agent (player character) sheet using ApplicationV2 with tabbed layout.
 * @module actor/agent/agent-sheet
 */

import { NRRollDialog } from '../../components/roll/roll-dialog.mjs';

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
      adjustAttribute: AgentSheet.#onAdjustAttribute,
      adjustSkill: AgentSheet.#onAdjustSkill,
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

    // Organize items by type
    context.weapons = actor.items.filter(i => i.type === 'weapon');
    context.armor = actor.items.filter(i => i.type === 'armor');
    context.gear = actor.items.filter(i => i.type === 'gear');
    context.consumables = actor.items.filter(i => i.type === 'consumable');
    context.artifacts = actor.items.filter(i => i.type === 'artifact');
    context.talents = actor.items.filter(i => i.type === 'talent');
    context.criticalInjuries = actor.items.filter(i => i.type === 'criticalInjury');
    context.anchor = actor.items.find(i => i.type === 'anchor') ?? null;
    context.darkSecret = actor.items.find(i => i.type === 'darkSecret') ?? null;

    // Corruption stage
    const cv = system.corruption.value;
    if (cv <= 0) context.corruptionStage = 'clean';
    else if (cv <= 3) context.corruptionStage = 'touched';
    else if (cv <= 6) context.corruptionStage = 'marked';
    else if (cv <= 9) context.corruptionStage = 'consumed';
    else context.corruptionStage = 'lost';

    // Encumbrance tier
    const enc = system.encumbrance;
    if (enc.current <= enc.max) context.encumbranceTier = 'normal';
    else if (enc.current <= enc.overloaded) context.encumbranceTier = 'encumbered';
    else context.encumbranceTier = 'overloaded';

    // Enriched HTML
    context.enrichedDescription = await TextEditor.enrichHTML(system.description ?? '', {
      async: true,
      relativeTo: actor,
    });

    // Damage type labels per attribute
    const damageLabels = {};
    for (const [, dt] of Object.entries(CONFIG.NEON_RELIC.damageTypes)) {
      damageLabels[dt.attribute] = dt.label;
    }

    // Skills grouped by attribute for 4-column layout
    const skillsByAttr = { str: [], agi: [], wit: [], emp: [] };
    for (const [key, skillConfig] of Object.entries(CONFIG.NEON_RELIC.skills)) {
      skillsByAttr[skillConfig.attribute].push({
        key,
        label: skillConfig.label,
        value: system.skills[key] ?? 0,
      });
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
        damageLabel: damageLabels[attrKey] ?? '',
        damagePips: dmgPips,
        skills: skillsByAttr[attrKey],
      });
    }

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
  async _preparePartContext(partId, context, options) {
    const partContext = await super._preparePartContext(partId, context, options);
    partContext.tab = context.tabs?.primary?.[partId] ?? {};
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
   * Roll an attribute check.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRollAttribute(_event, target) {
    const attrKey = target.dataset.attribute;
    const attrValue = this.document.system.attributes[attrKey]?.value ?? 0;
    await NRRollDialog.prompt({
      attribute: attrKey,
      attributeValue: attrValue,
      actorId: this.document.id,
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
    const attrKey = skillConfig?.attribute ?? '';
    const attrValue = this.document.system.attributes[attrKey]?.value ?? 0;
    const skillValue = this.document.system.skills[skillKey] ?? 0;
    await NRRollDialog.prompt({
      attribute: attrKey,
      attributeValue: attrValue,
      skill: skillKey,
      skillValue,
      actorId: this.document.id,
    });
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

    // Enforce min 2, max 5
    if (newVal < 2 || newVal > 5) return;

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
      // Spend XP
      await this.document.update({
        [`system.skills.${key}`]: newVal,
        'system.experience.current': sys.experience.current - xpCost,
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
}
