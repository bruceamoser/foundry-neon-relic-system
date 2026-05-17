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

    // Skill data with linked attributes for display
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
    return super._onDropItem(event, data);
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
}
