/* Neon Relic — finish/stick a character that is trapped in character creation.
 *
 * Run from the Foundry console (F12 → Console) as the GM, with the character's
 * token selected (or the sheet open, or it falls back to the only agent).
 *
 * What it does: prints what the wizard is still objecting to, then clears
 * `system.creationComplete` so the character is treated as created.
 */
(async () => {
  // ── 1. Find the character ────────────────────────────────────────────
  const actor =
    canvas.tokens?.controlled?.[0]?.actor ??
    game.user.character ??
    game.actors.find(a => a.type === 'agent' && a.system?.creationComplete === false) ??
    game.actors.find(a => a.type === 'agent');
  if (!actor) return ui.notifications.error('No agent found — select the token first.');
  if (!actor.isOwner && !game.user.isGM) return ui.notifications.error(`You do not own ${actor.name}.`);

  const sys = actor.system;

  // ── 2. Diagnose (what the wizard is still complaining about) ─────────
  const keySkill = actor.items.find(i => i.type === 'subdivision')?.system.keySkill;
  const creationMax = key => (key === keySkill ? 4 : 3);
  const overCap = Object.entries(sys.skills ?? {})
    .filter(([k, v]) => v > creationMax(k))
    .map(([k, v]) => `${k} ${v}/${creationMax(k)}`);
  const talents = actor.items.filter(i => i.type === 'talent').length;

  const problems = [];
  if (!actor.name?.trim()) problems.push('no name');
  if (!sys.division) problems.push('no Division');
  if (!sys.subUnit) problems.push('no Sub-Unit');
  if (!sys.specialty) problems.push('no Specialty');
  if (sys.budget.attrRemaining !== 0)
    problems.push(
      `attributes ${sys.budget.attrRemaining > 0 ? 'unspent' : 'over'} by ${Math.abs(sys.budget.attrRemaining)}`,
    );
  if (sys.budget.skillRemaining !== 0)
    problems.push(
      `skills ${sys.budget.skillRemaining > 0 ? 'unspent' : 'over'} by ${Math.abs(sys.budget.skillRemaining)}`,
    );
  if (talents < 3) problems.push(`talents ${talents}/3`);
  if (!actor.items.some(i => i.type === 'anchor')) problems.push('no Anchor');
  if (!actor.items.some(i => i.type === 'darkSecret')) problems.push('no Dark Secret');
  if (overCap.length) problems.push(`skills above the creation cap: ${overCap.join(', ')}`);

  console.log('NEON RELIC | creation report', {
    actor: actor.name,
    creationComplete: sys.creationComplete,
    ageGroup: sys.ageGroup,
    keySkill,
    budget: sys.budget,
    skills: sys.skills,
    problems: problems.length ? problems : 'none',
  });

  // ── 3. Clear the flag ────────────────────────────────────────────────
  const attrSync = Object.fromEntries(
    Object.entries(sys.attributes ?? {}).map(([k, a]) => [`system.attributes.${k}.value`, a.max]),
  );
  const updates = { ...attrSync, 'system.creationComplete': true };

  if (!sys.clearanceLevel) {
    const subs = (await game.packs.get('neon-relic.subdivisions')?.getDocuments()) ?? [];
    const sub = subs.find(s => s.name === sys.subUnit);
    const ageMods = { young: -1, experienced: 0, senior: 1 };
    updates['system.clearanceLevel'] = Math.clamp((sub?.system.baseCL ?? 2) + (ageMods[sys.ageGroup] ?? 0), 1, 5);
  }

  await actor.update(updates);
  ui.notifications.info(`${actor.name}: creation complete — the wizard is dismissed.`);
  console.log(
    'NEON RELIC | creatorComplete now',
    actor.system.creationComplete,
    '| problems were:',
    problems.join('; ') || 'none',
  );
})();
