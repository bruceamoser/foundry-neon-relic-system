/**
 * NPC (and entity) sheet using ApplicationV2 with tabbed layout.
 * Tab 1: Case Card — DA case-file management with drag-drop linking.
 * Tab 2: Stat Block — combat stats, attributes, entity fields.
 * Tab 3: Entity — supernatural entity configuration.
 * @module actor/npc/npc-sheet
 */

import { NRRollDialog } from '../../components/roll/roll-dialog.mjs';

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
    position: { width: 720, height: 'auto' },
    actions: {
      rollAttribute: NPCSheet.#onRollAttribute,
      adjustDisposition: NPCSheet.#onAdjustDisposition,
      toggleSimplified: NPCSheet.#onToggleSimplified,
      removeLinkedDoc: NPCSheet.#onRemoveLinkedDoc,
      openLinkedDoc: NPCSheet.#onOpenLinkedDoc,
    },
    form: { submitOnChange: true },
  };

  /** @override */
  static PARTS = {
    content: {
      template: 'systems/neon-relic/templates/actor/npc/npc-sheet.hbs',
      scrollable: [''],
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
    context.isSimplified = system.useSimplifiedView;

    const stages = ['clean', 'touched', 'marked', 'consumed'];
    context.corruptionStageLabel = stages[system.corruptionStage] ?? 'clean';
    context.tierClass = 'tier-' + system.tier;

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

    context.abilities = actor.items.filter(i => i.type === 'talent');

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

    context.linkedStartingKnowledge = [];
    await resolveDocs(system.startingKnowledgeUuids, context.linkedStartingKnowledge);
    context.linkedGainedKnowledge = [];
    await resolveDocs(system.gainedKnowledgeUuids, context.linkedGainedKnowledge);
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
      initial: this._npcActiveTab || 'card',
      group: 'npc-primary',
      callback: (_event, _tabs, tab) => {
        if (tab) this._npcActiveTab = tab.dataset.tab;
      },
    }).bind(this.element);
  }

  _npcActiveTab = null;

  /* ------------------------------------------ */
  /*  Drag-and-Drop                              */
  /* ------------------------------------------ */

  _canDragDrop(_event) {
    return this.isEditable;
  }

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (!data?.uuid) return;
    const doc = await fromUuid(data.uuid);
    if (!doc) return;

    const system = this.document.system;
    const updateData = {};
    let linkBack = null;

    if (data.type === 'Item' && doc.type === 'organization') {
      if (system.organizationUuid === data.uuid) return;
      updateData['system.organizationUuid'] = data.uuid;
      linkBack = { doc, field: 'system.npcUuids' };
    } else if (data.type === 'Item' && doc.type === 'informationCard') {
      const dropKey = event.target.closest('[data-drop-key]')?.dataset?.dropKey;
      const field = dropKey === 'gainedKnowledge' ? 'system.gainedKnowledgeUuids' : 'system.startingKnowledgeUuids';
      const currentField = dropKey === 'gainedKnowledge' ? system.gainedKnowledgeUuids : system.startingKnowledgeUuids;
      const uuids = [...(currentField ?? [])];
      if (uuids.includes(data.uuid)) return;
      uuids.push(data.uuid);
      updateData[field] = uuids;
      linkBack = { doc, field: 'system.npcUuids' };
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
    const delta = Number(target.dataset.delta) || 0;
    const current = this.document.system.disposition;
    const newVal = Math.clamp(current + delta, 1, 5);
    await this.document.update({ 'system.disposition': newVal });
  }

  static async #onToggleSimplified(_event, _target) {
    await this.document.update({ 'system.useSimplifiedView': !this.document.system.useSimplifiedView });
  }

  static async #onRemoveLinkedDoc(_event, target) {
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
      if (doc) unlinkBack = { doc, field: 'system.npcUuids' };
    } else if (system.gainedKnowledgeUuids?.includes(uuid)) {
      updateData = { 'system.gainedKnowledgeUuids': system.gainedKnowledgeUuids.filter(u => u !== uuid) };
      if (doc) unlinkBack = { doc, field: 'system.npcUuids' };
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
    const doc = await fromUuid(uuid);
    if (doc) doc.sheet.render(true);
  }
}
