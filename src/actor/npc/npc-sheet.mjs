/**
 * NPC (and entity) sheet using ApplicationV2 with tabbed layout.
 * Tab 1: Case Card — DA case-file management with drag-drop linking.
 * Tab 2: Stat Block — combat stats, attributes, entity fields.
 * Tab 3: Entity — supernatural entity configuration.
 * @module actor/npc/npc-sheet
 */

import { NRRollDialog } from '../../components/roll/roll-dialog.mjs';
import { resolveLinkedDoc } from '../../system/document-links.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const SYSTEM_ID = 'neon-relic';

async function resolveDocs(uuids, target) {
  if (!uuids?.length) return;
  for (const uuid of uuids) {
    try {
      const doc = await fromUuid(uuid);
      if (doc) target.push({ uuid, name: doc.name, img: doc.img, type: doc.type });
    } catch {
      /* skip */
    }
  }
}

export class NPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, 'npc-sheet'],
    position: { width: 840, height: 800 },
    actions: {
      rollAttribute: NPCSheet.#onRollAttribute,
      rollSkill: NPCSheet.#onRollSkill,
      rollAttack: NPCSheet.#onRollAttack,
      openItem: NPCSheet.#onOpenItem,
      adjustDisposition: NPCSheet.#onAdjustDisposition,
      removeLinkedDoc: NPCSheet.#onRemoveLinkedDoc,
      openLinkedDoc: NPCSheet.#onOpenLinkedDoc,
    },
    form: { submitOnChange: true },
  };

  /** @override */
  static PARTS = {
    content: {
      template: 'systems/neon-relic/templates/actor/npc/npc-sheet.hbs',
      scrollable: ['.npc-tab-content'],
    },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const system = actor.system;

    context.system = system;
    context.config = CONFIG.NEON_RELIC;
    context.isEditable = this.isEditable;
    context.actor = actor;

    context.dispositionPips = [];
    for (let i = 1; i <= 5; i++) {
      context.dispositionPips.push({
        number: i,
        filled: i <= system.disposition,
        cssClass: i <= system.disposition ? 'pip filled' : 'pip',
      });
    }

    context.attrEntries = [];
    for (const [key, label] of Object.entries(CONFIG.NEON_RELIC.attributes)) {
      context.attrEntries.push({ key, label, value: system.attributes[key] ?? 0 });
    }

    context.brokenClass = system.isBroken ? 'broken-badge active' : 'broken-badge';

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description ?? '',
      { async: true, relativeTo: actor },
    );

    const skillKeys = new Set([...Object.keys(CONFIG.NEON_RELIC.skills), ...Object.keys(system.skills ?? {})]);
    context.skillEntries = [...skillKeys].map(key => {
      const config = CONFIG.NEON_RELIC.skills[key];
      const value = Number(system.skills?.[key] ?? 0);
      return {
        key,
        label: config?.label ?? key,
        value,
        pool: value + (system.attributes[config?.attribute] ?? 0),
        canRoll: !!config,
      };
    });
    context.activeSkills = context.skillEntries.filter(skill => skill.value > 0);

    const enrich = html =>
      foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? '', { async: true, relativeTo: actor });
    context.abilities = await Promise.all(
      actor.items
        .filter(item => item.type === 'talent')
        .map(async item => ({
          id: item.id,
          name: item.name,
          content: await enrich(item.system.effect || item.system.description),
        })),
    );
    context.attacks = await Promise.all(
      actor.items
        .filter(item => item.type === 'weapon')
        .map(async item => {
          const skill = CONFIG.NEON_RELIC.skills[item.system.skill];
          return {
            id: item.id,
            name: item.name,
            damage: item.system.damage,
            range: item.system.range,
            canRoll: !!skill && !item.system.isBroken,
            pool:
              (system.attributes[skill?.attribute] ?? 0) +
              (system.skills?.[item.system.skill] ?? 0) +
              (item.system.gearBonus?.value ?? 0),
            content: await enrich(item.system.description),
          };
        }),
    );

    // Resolve linked documents
    context.linkedOrg = null;
    if (system.organizationUuid) {
      try {
        const doc = await fromUuid(system.organizationUuid);
        if (doc) context.linkedOrg = { uuid: system.organizationUuid, name: doc.name, img: doc.img, type: doc.type };
      } catch {
        /* skip */
      }
    }

    context.linkedInformationCards = [];
    await resolveDocs(system.startingKnowledgeUuids, context.linkedInformationCards);
    await resolveDocs(system.gainedKnowledgeUuids, context.linkedInformationCards);
    context.linkedLocations = [];
    await resolveDocs(system.locationUuids, context.linkedLocations);

    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    new foundry.applications.ux.Tabs({
      navSelector: '.npc-tabs',
      contentSelector: '.npc-tab-content',
      initial: this._npcActiveTab || 'stats',
      group: 'npc-primary',
      callback: (_event, _tabs, tab) => {
        this._npcActiveTab = typeof tab === 'string' ? tab : tab?.dataset?.tab || this._npcActiveTab;
      },
    }).bind(this.element);
    for (const section of this.element.querySelectorAll('details[data-section]')) {
      const key = section.dataset.section;
      section.open = this._npcOpenSections.has(key);
      section.addEventListener('toggle', () => {
        if (section.open) this._npcOpenSections.add(key);
        else this._npcOpenSections.delete(key);
      });
    }
  }

  _npcActiveTab = null;
  _npcOpenSections = new Set();

  /* ------------------------------------------ */
  /*  Drag-and-Drop                              */
  /* ------------------------------------------ */

  _canDragDrop(_event) {
    return this.isEditable;
  }

  async _onDrop(event) {
    if (!this.isEditable) return;
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (!data?.uuid) return;
    const doc = await fromUuid(data.uuid);
    if (!doc) return;

    const system = this.document.system;
    const updateData = {};
    let linkBack = null;

    if (data.type === 'Item' && ['weapon', 'talent'].includes(doc.type)) {
      const source = doc.toObject();
      delete source._id;
      await this.document.createEmbeddedDocuments('Item', [source]);
      return;
    } else if (data.type === 'Item' && doc.type === 'organization') {
      if (system.organizationUuid === data.uuid) return;
      updateData['system.organizationUuid'] = data.uuid;
      linkBack = { doc, field: 'system.npcUuids' };
    } else if (data.type === 'Item' && doc.type === 'informationCard') {
      const uuids = [...(system.startingKnowledgeUuids ?? [])];
      if (uuids.includes(data.uuid)) return;
      uuids.push(data.uuid);
      updateData['system.startingKnowledgeUuids'] = uuids;
      linkBack = { doc, field: 'system.knownByUuids' };
    } else if (data.type === 'Item' && doc.type === 'location') {
      const uuids = [...(system.locationUuids ?? [])];
      if (uuids.includes(data.uuid)) return;
      uuids.push(data.uuid);
      updateData['system.locationUuids'] = uuids;
      linkBack = { doc, field: 'system.npcUuids' };
    } else {
      return;
    }

    await this.document.update(updateData);

    if (linkBack) {
      const backField = linkBack.field.split('.').slice(1).join('.');
      const backUuids = [...(foundry.utils.getProperty(linkBack.doc.system, backField) ?? [])];
      const npcUuid = this.document.uuid;
      if (!backUuids.includes(npcUuid)) {
        backUuids.push(npcUuid);
        await linkBack.doc.update({ [linkBack.field]: backUuids });
      }
    }
  }

  /* ------------------------------------------ */

  static async #onRollAttribute(_event, target) {
    const attrKey = target.dataset.attribute;
    const attrValue = this.document.system.attributes[attrKey] ?? 0;
    await NRRollDialog.prompt({ attribute: attrKey, attributeValue: attrValue, actorId: this.document.id });
  }

  static async #onAdjustDisposition(_event, target) {
    if (!this.isEditable) return;
    const delta = Number(target.dataset.delta) || 0;
    const current = this.document.system.disposition;
    const newVal = Math.clamp(current + delta, 1, 5);
    await this.document.update({ 'system.disposition': newVal });
  }

  static async #onRollSkill(_event, target) {
    const skillKey = target.dataset.skill;
    const config = CONFIG.NEON_RELIC.skills[skillKey];
    if (!config) return;
    await NRRollDialog.prompt({
      attribute: config.attribute,
      attributeValue: this.document.system.attributes[config.attribute] ?? 0,
      skill: skillKey,
      skillValue: this.document.system.skills?.[skillKey] ?? 0,
      actorId: this.document.id,
    });
  }

  static async #onRollAttack(_event, target) {
    const item = this.document.items.get(target.dataset.itemId);
    const config = CONFIG.NEON_RELIC.skills[item?.system.skill];
    if (item?.type !== 'weapon' || !config || item.system.isBroken) return;
    await NRRollDialog.prompt({
      attribute: config.attribute,
      attributeValue: this.document.system.attributes[config.attribute] ?? 0,
      skill: item.system.skill,
      skillValue: this.document.system.skills?.[item.system.skill] ?? 0,
      gearBonus: item.system.gearBonus?.value ?? 0,
      actorId: this.document.id,
      notes: item.name,
    });
  }

  static async #onOpenItem(_event, target) {
    const item = this.document.items.get(target.dataset.itemId);
    if (item) item.sheet.render(true);
  }

  static async #onRemoveLinkedDoc(_event, target) {
    if (!this.isEditable) return;
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const system = this.document.system;
    const doc = await fromUuid(uuid);
    let unlinkBack = null;
    let updateData;

    if (system.organizationUuid === uuid) {
      updateData = { 'system.organizationUuid': '' };
      if (doc) unlinkBack = { doc, field: 'system.npcUuids' };
    } else if (system.startingKnowledgeUuids?.includes(uuid)) {
      updateData = { 'system.startingKnowledgeUuids': system.startingKnowledgeUuids.filter(u => u !== uuid) };
      if (doc) unlinkBack = { doc, field: 'system.knownByUuids' };
    } else if (system.gainedKnowledgeUuids?.includes(uuid)) {
      updateData = { 'system.gainedKnowledgeUuids': system.gainedKnowledgeUuids.filter(u => u !== uuid) };
      if (doc) unlinkBack = { doc, field: 'system.knownByUuids' };
    } else if (system.locationUuids?.includes(uuid)) {
      updateData = { 'system.locationUuids': system.locationUuids.filter(u => u !== uuid) };
      if (doc) unlinkBack = { doc, field: 'system.npcUuids' };
    } else {
      return;
    }

    await this.document.update(updateData);

    if (unlinkBack) {
      const backField = unlinkBack.field.split('.').slice(1).join('.');
      const backUuids = [...(foundry.utils.getProperty(unlinkBack.doc.system, backField) ?? [])];
      const npcUuid = this.document.uuid;
      await unlinkBack.doc.update({ [unlinkBack.field]: backUuids.filter(u => u !== npcUuid) });
    }
  }

  static async #onOpenLinkedDoc(_event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const doc = await resolveLinkedDoc(uuid);
    if (doc) doc.sheet.render(true);
  }
}
