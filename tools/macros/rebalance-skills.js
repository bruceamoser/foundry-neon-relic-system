/* Neon Relic — rebalance an agent's skills to a target total (or an exact spread).
 *
 * `budget.skillSpent` is DERIVED (the sum of the 14 skill values), so the way to
 * correct it is to set the skills. XP is recomputed automatically:
 *   spent = max(0, skillSpent - ageGroupBudget) * 5 + max(0, talents - 3) * 6
 *
 * Fill WANT for an exact distribution, or leave it empty and set TARGET_TOTAL to
 * trim the biggest skills down until the sum matches. A dialog shows the diff
 * before anything is written.
 */
(async () => {
  const WANT = {}; // e.g. { firearms: 4, brawl: 3, investigate: 3, tech: 2, sneak: 2, command: 2, lore: 2 }
  const TARGET_TOTAL = 18;

  const actor =
    canvas.tokens?.controlled?.[0]?.actor ??
    game.user.character ??
    game.actors.find(a => a.type === 'agent' && a.system?.creationComplete === false) ??
    game.actors.find(a => a.type === 'agent');
  if (!actor) return ui.notifications.error('Select the character token first.');
  if (!actor.isOwner && !game.user.isGM) return ui.notifications.error(`You do not own ${actor.name}.`);

  const before = { ...actor.system.skills };
  const next = { ...before };

  const unknown = Object.keys(WANT).filter(k => !(k in before));
  if (unknown.length) return ui.notifications.error(`Unknown skill key(s): ${unknown.join(', ')}`);

  if (Object.keys(WANT).length) {
    Object.assign(next, WANT);
  } else {
    // Trim from the highest values down until the total matches the target.
    let total = Object.values(next).reduce((a, b) => a + b, 0);
    const order = Object.keys(next).sort((a, b) => next[b] - next[a]);
    let guard = 0;
    while (total > TARGET_TOTAL && guard++ < 500) {
      const key = order.find(k => next[k] > 0);
      if (!key) break;
      next[key] -= 1;
      total -= 1;
      order.sort((a, b) => next[b] - next[a]);
    }
    if (total > TARGET_TOTAL)
      ui.notifications.warn(`${actor.name}: could not reach ${TARGET_TOTAL} (floor is 0 per skill).`);
  }

  const sum = s => Object.values(s).reduce((a, b) => a + b, 0);
  const diff = Object.keys(next)
    .filter(k => next[k] !== before[k])
    .map(k => `${k}: ${before[k]} → <strong>${next[k]}</strong>`);

  const budget = actor.system.budget;
  const ageBudget = budget.skillTotal;
  const projectedSpent = Math.max(0, sum(next) - ageBudget) * 5;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: `${actor.name} — rebalance skills` },
    content:
      `<p>Total <strong>${sum(before)}</strong> → <strong>${sum(next)}</strong>` +
      ` (age-group budget ${ageBudget}, so ${Math.max(0, sum(next) - ageBudget)} point(s) XP-funded = ${projectedSpent} XP)</p>` +
      (diff.length ? `<p>${diff.join('<br>')}</p>` : '<p>No change.</p>'),
  });
  if (!ok) return;

  await actor.update(Object.fromEntries(Object.keys(next).map(k => [`system.skills.${k}`, next[k]])));

  const sys = actor.system;
  ui.notifications.info(
    `${actor.name}: skills total ${sys.budget.skillSpent} (XP spent ${sys.experience.spent}, remaining ${sys.experience.current}).`,
  );
  console.log('NEON RELIC | rebalanced', {
    actor: actor.name,
    skills: sys.skills,
    budget: sys.budget,
    xp: sys.experience,
  });
})();
