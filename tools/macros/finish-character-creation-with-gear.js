/* Neon Relic — finish character creation AND hand over the starting kit.
 *
 * Same as finish-character-creation.js but it also performs the wizard's
 * completion housekeeping: embeds the Sub-Unit item, the Sub-Unit's starting
 * gear, the Division item, syncs attribute value = max and computes Clearance
 * Level. Use it when the character never got its gear because the wizard could
 * not be completed. Run from the Foundry console (F12) as the GM.
 */
(async () => {
  const actor =
    canvas.tokens?.controlled?.[0]?.actor ??
    game.user.character ??
    game.actors.find(a => a.type === 'agent' && a.system?.creationComplete === false) ??
    game.actors.find(a => a.type === 'agent');
  if (!actor) return ui.notifications.error('No agent found — select the token first.');
  if (!actor.isOwner && !game.user.isGM) return ui.notifications.error(`You do not own ${actor.name}.`);

  const sys = actor.system;

  // ── Resolve the sub-unit from its compendium ────────────────────────
  const subs = (await game.packs.get('neon-relic.subdivisions')?.getDocuments()) ?? [];
  const sub = subs.find(s => s.name === sys.subUnit);
  if (!sub)
    ui.notifications.warn(
      `${actor.name}: sub-unit "${sys.subUnit || '(unset)'}" not found in the compendium — gear not added.`,
    );

  const toCreate = [];
  const hasItem = (name, type) => actor.items.some(i => i.name === name && (!type || i.type === type));

  if (sub) {
    if (!actor.items.some(i => i.type === 'subdivision')) toCreate.push(sub.toObject());

    for (const ref of sub.system.startingGear ?? []) {
      const pack = game.packs.get(ref.pack || 'neon-relic.gear');
      const docs = pack ? await pack.getDocuments() : [];
      const found = docs.find(d => d.name === ref.name);
      if (found && !hasItem(found.name)) toCreate.push(found.toObject());
    }

    const divItemName = sub.system.divisionItemName ?? '';
    if (divItemName && !hasItem(divItemName)) {
      const gearDocs = (await game.packs.get('neon-relic.gear')?.getDocuments()) ?? [];
      const divItem = gearDocs.find(d => d.name === divItemName);
      if (divItem) toCreate.push(divItem.toObject());
    }
  }

  if (toCreate.length) await actor.createEmbeddedDocuments('Item', toCreate);

  // ── Attributes value = max, Clearance Level, completion flag ────────
  const ageMods = { young: -1, experienced: 0, senior: 1 };
  const updates = {
    ...Object.fromEntries(
      Object.entries(sys.attributes ?? {}).map(([k, a]) => [`system.attributes.${k}.value`, a.max]),
    ),
    'system.creationComplete': true,
  };
  if (sub && !sys.clearanceLevel) {
    updates['system.clearanceLevel'] = Math.clamp((sub.system.baseCL ?? 2) + (ageMods[sys.ageGroup] ?? 0), 1, 5);
  }
  await actor.update(updates);

  ui.notifications.info(`${actor.name}: creation complete — ${toCreate.length} item(s) added.`);
  console.log('NEON RELIC | finished', actor.name, {
    addedItems: toCreate.map(i => i.name),
    clearanceLevel: actor.system.clearanceLevel,
    budget: actor.system.budget,
  });
})();
