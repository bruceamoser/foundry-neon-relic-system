/**
 * Fear Check procedure, panic table, and fear rating mechanics.
 * @module components/fear-check
 */

/**
 * Panic table results (d6).
 * @type {Object<number, {key: string}>}
 */
const PANIC_TABLE = {
  1: { key: 'Fight' },
  2: { key: 'Flight' },
  3: { key: 'Freeze' },
  4: { key: 'Denial' },
  5: { key: 'Compulsion' },
  6: { key: 'Fugue' },
};

/**
 * Perform a Fear Check for an agent.
 * Roll dice = current Wits (no skill, no gear, no help, cannot push).
 * @param {Actor} actor - The agent making the check.
 * @param {object} [options={}]
 * @param {string} [options.entityName] - Name of the fear source for display.
 * @param {number} [options.bonusDice=0] - Extra dice (e.g., MJ-12 training).
 * @returns {Promise<{passed: boolean, successes: number, ones: number, corruptionGained: number, witsDamage: number, panicResult: object|null}>}
 */
export async function fearCheck(actor, { entityName = '', bonusDice = 0 } = {}) {
  // Immunity: Broken, unconscious, or in-Fugue skip fear checks
  const conditions = actor.system?.conditions ?? {};
  if (conditions.broken || conditions.dying) {
    return { passed: true, successes: 0, ones: 0, corruptionGained: 0, witsDamage: 0, panicResult: null };
  }

  const wits = actor.system?.attributes?.wit?.value ?? 0;
  const diceCount = Math.max(1, wits + bonusDice);

  // Roll dice pool (d6s)
  const roll = new Roll(`${diceCount}d6`);
  await roll.evaluate();

  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;
  const ones = results.filter(r => r === 1).length;
  const passed = successes > 0;

  let corruptionGained = 0;
  let witsDamage = 0;
  let panicResult = null;

  // Any 1s = +1 Corruption (regardless of pass/fail)
  if (ones > 0) {
    corruptionGained += 1;
  }

  // Failure: +1 Corruption, 1 Wits damage, roll panic table
  if (!passed) {
    corruptionGained += 1;
    witsDamage = 1;

    // Apply Wits damage
    const currentWit = actor.system?.attributes?.wit?.value ?? 0;
    await actor.update({ 'system.attributes.wit.value': Math.max(0, currentWit - 1) });

    // Roll panic table
    const panicRoll = new Roll('1d6');
    await panicRoll.evaluate();
    const panicValue = panicRoll.total;
    panicResult = { value: panicValue, ...PANIC_TABLE[panicValue] };
  }

  // Apply corruption
  if (corruptionGained > 0) {
    const currentCorruption = actor.system?.corruption?.value ?? 0;
    await actor.update({ 'system.corruption.value': currentCorruption + corruptionGained });
  }

  // Chat output
  const speaker = ChatMessage.getSpeaker({ actor });
  let content = `<div class="fear-check">
    <strong>${game.i18n.localize('NEONRELIC.Fear.FearCheck')}</strong>`;

  if (entityName) {
    content += ` (${entityName})`;
  }

  content += `<br>${game.i18n.localize('NEONRELIC.Roll.Dice')}: [${results.join(', ')}]`;
  content += `<br>${game.i18n.localize('NEONRELIC.Roll.Successes')}: ${successes}`;

  if (passed) {
    content += `<br><strong>${game.i18n.localize('NEONRELIC.Fear.Passed')}</strong>`;
  } else {
    content += `<br><strong>${game.i18n.localize('NEONRELIC.Fear.Failed')}</strong>`;
    content += `<br>${game.i18n.localize('NEONRELIC.Fear.WitsDamage')}: ${witsDamage}`;
  }

  if (ones > 0) {
    content += `<br>${game.i18n.localize('NEONRELIC.Fear.OnesCorruption')}`;
  }

  if (corruptionGained > 0) {
    content += `<br>${game.i18n.localize('NEONRELIC.Corruption.Gained')}: +${corruptionGained}`;
  }

  if (panicResult) {
    content += `<br><em>${game.i18n.localize('NEONRELIC.Fear.PanicTable')}: ${game.i18n.localize(`NEONRELIC.Fear.Panic.${panicResult.key}`)}</em>`;
    content += `<br>${game.i18n.localize(`NEONRELIC.Fear.PanicEffect.${panicResult.key}`)}`;
  }

  content += '</div>';
  await ChatMessage.create({ speaker, content });

  // Add entity to known entities if passed
  if (passed && entityName) {
    const known = actor.system?.knownEntities ?? [];
    if (!known.includes(entityName)) {
      await actor.update({ 'system.knownEntities': [...known, entityName] });
    }
  }

  return { passed, successes, ones, corruptionGained, witsDamage, panicResult };
}

/**
 * Check if an actor needs a fear check against an entity.
 * @param {Actor} actor
 * @param {string} entityName
 * @param {boolean} [escalated=false] - Whether entity has escalated FR.
 * @returns {boolean}
 */
export function needsFearCheck(actor, entityName, escalated = false) {
  if (escalated) return true;
  const known = actor.system?.knownEntities ?? [];
  return !known.includes(entityName);
}
