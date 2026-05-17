/**
 * Resource die and gear degradation systems.
 * Handles the step-down die chain, gear/armor degradation, and resource die rolls.
 * @module components/resource-die
 */

/**
 * Resource die step chain: d12 → d10 → d8 → d6 → d4 → Depleted (0).
 */
const STEP_CHAIN = [12, 10, 8, 6, 4, 0];

/**
 * Roll a resource die for an item and step down on 1-2.
 * @param {Item} item - The item with system.resourceDie.
 * @returns {Promise<{roll: Roll, result: number, steppedDown: boolean, newDie: number, depleted: boolean}>}
 */
export async function rollResourceDie(item) {
  const currentDie = item.system?.resourceDie ?? 6;
  if (currentDie <= 0) {
    return { roll: null, result: 0, steppedDown: false, newDie: 0, depleted: true };
  }

  const roll = new Roll(`1d${currentDie}`);
  await roll.evaluate();
  const result = roll.total;
  const steppedDown = result <= 2;
  let newDie = currentDie;
  let depleted = false;

  if (steppedDown) {
    const idx = STEP_CHAIN.indexOf(currentDie);
    newDie = idx >= 0 && idx < STEP_CHAIN.length - 1 ? STEP_CHAIN[idx + 1] : 0;
    depleted = newDie === 0;
    await item.update({ 'system.resourceDie': newDie });
  }

  // Chat message
  const speaker = ChatMessage.getSpeaker({ actor: item.actor });
  const statusKey = depleted
    ? 'NEONRELIC.ResourceDie.Depleted'
    : steppedDown
      ? 'NEONRELIC.ResourceDie.SteppedDown'
      : 'NEONRELIC.ResourceDie.OK';

  await ChatMessage.create({
    speaker,
    content: `<div class="resource-die-roll">
      <strong>${item.name}</strong>: d${currentDie} → ${result}
      <br>${game.i18n.localize(statusKey)}${steppedDown && !depleted ? ` (→ d${newDie})` : ''}
    </div>`,
  });

  return { roll, result, steppedDown, newDie, depleted };
}

/**
 * Degrade a weapon or tool — reduce gear bonus by 1.
 * Triggered when a gear die shows 1 on the initial roll (not pushes).
 * @param {Item} item - The weapon/gear item.
 * @returns {Promise<{newBonus: number, broken: boolean}>}
 */
export async function degradeGear(item) {
  const current = item.system?.gearBonus ?? 0;
  const newBonus = Math.max(0, current - 1);
  const broken = newBonus === 0;

  await item.update({ 'system.gearBonus': newBonus });

  const speaker = ChatMessage.getSpeaker({ actor: item.actor });
  await ChatMessage.create({
    speaker,
    content: `<div class="gear-degrade">
      <strong>${item.name}</strong>: ${game.i18n.localize('NEONRELIC.Gear.Degraded')}
      (${game.i18n.localize('NEONRELIC.Weapon.GearBonus')}: ${newBonus})
      ${broken ? `<br><em>${game.i18n.localize('NEONRELIC.Gear.BrokenUnusable')}</em>` : ''}
    </div>`,
  });

  return { newBonus, broken };
}

/**
 * Degrade armor — reduce AR by 1.
 * Triggered by pushing rolls while wearing the armor, or by stunts/critical injuries.
 * @param {Item} item - The armor item.
 * @returns {Promise<{newAR: number, broken: boolean}>}
 */
export async function degradeArmor(item) {
  const current = item.system?.armorRating ?? 0;
  const newAR = Math.max(0, current - 1);
  const broken = newAR === 0;

  await item.update({ 'system.armorRating': newAR });

  const speaker = ChatMessage.getSpeaker({ actor: item.actor });
  await ChatMessage.create({
    speaker,
    content: `<div class="armor-degrade">
      <strong>${item.name}</strong>: ${game.i18n.localize('NEONRELIC.Gear.ArmorDegraded')}
      (AR: ${newAR})
      ${broken ? `<br><em>${game.i18n.localize('NEONRELIC.Gear.BrokenUnusable')}</em>` : ''}
    </div>`,
  });

  return { newAR, broken };
}

/**
 * Step down a die by one step in the chain.
 * @param {number} currentDie - Current die size.
 * @returns {number} Next die size (0 = depleted).
 */
export function stepDown(currentDie) {
  const idx = STEP_CHAIN.indexOf(currentDie);
  if (idx < 0 || idx >= STEP_CHAIN.length - 1) return 0;
  return STEP_CHAIN[idx + 1];
}

/**
 * Step up a die by one step in the chain (for reload/repair).
 * @param {number} currentDie - Current die size.
 * @returns {number} Next die size (capped at d12).
 */
export function stepUp(currentDie) {
  const idx = STEP_CHAIN.indexOf(currentDie);
  if (idx <= 0) return STEP_CHAIN[0]; // Already at max or invalid
  return STEP_CHAIN[idx - 1];
}
