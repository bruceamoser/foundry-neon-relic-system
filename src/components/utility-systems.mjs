/**
 * Utility systems — crafting, repair, scavenging, artifact emissions, artifact decay.
 * @module components/utility-systems
 */

// ─── Improvised Crafting (#83) ─────────────────────────────────

/**
 * Craftable items with difficulty and required components.
 */
export const CRAFTABLE_ITEMS = {
  lockpick: { key: 'lockpick', label: 'NEONRELIC.Craft.Lockpick', difficulty: 1, components: 1 },
  splint: { key: 'splint', label: 'NEONRELIC.Craft.Splint', difficulty: 1, components: 1 },
  torch: { key: 'torch', label: 'NEONRELIC.Craft.Torch', difficulty: 1, components: 1 },
  smokeBomb: { key: 'smokeBomb', label: 'NEONRELIC.Craft.SmokeBomb', difficulty: 2, components: 2 },
  tripwire: { key: 'tripwire', label: 'NEONRELIC.Craft.Tripwire', difficulty: 2, components: 2 },
  shiv: { key: 'shiv', label: 'NEONRELIC.Craft.Shiv', difficulty: 1, components: 1 },
  signalMirror: { key: 'signalMirror', label: 'NEONRELIC.Craft.SignalMirror', difficulty: 1, components: 1 },
  caltrops: { key: 'caltrops', label: 'NEONRELIC.Craft.Caltrops', difficulty: 2, components: 2 },
  gasMask: { key: 'gasMask', label: 'NEONRELIC.Craft.GasMask', difficulty: 3, components: 3 },
  faradayCage: { key: 'faradayCage', label: 'NEONRELIC.Craft.FaradayCage', difficulty: 3, components: 3 },
};

/**
 * Crafting failure table (d6).
 */
export const CRAFTING_FAILURE_TABLE = [
  { roll: 1, result: 'NEONRELIC.Craft.Fail.Waste', effect: 'Components wasted, nothing created.' },
  { roll: 2, result: 'NEONRELIC.Craft.Fail.Fragile', effect: 'Item created but breaks after one use.' },
  { roll: 3, result: 'NEONRELIC.Craft.Fail.Slow', effect: 'Takes twice as long. Extra Fast Action needed.' },
  { roll: 4, result: 'NEONRELIC.Craft.Fail.Loud', effect: 'Noise alerts nearby enemies.' },
  { roll: 5, result: 'NEONRELIC.Craft.Fail.Injury', effect: 'Take 1 Physical damage from mishap.' },
  { roll: 6, result: 'NEONRELIC.Craft.Fail.Unstable', effect: 'Item works but with unpredictable side effect.' },
];

/**
 * Attempt to craft an improvised item.
 * @param {Actor} actor
 * @param {string} itemKey - Key from CRAFTABLE_ITEMS.
 * @returns {Promise<{success: boolean, failure: object|null}>}
 */
export async function attemptCraft(actor, itemKey) {
  const item = CRAFTABLE_ITEMS[itemKey];
  if (!item) return { success: false, failure: null };

  const wit = actor.system?.attributes?.wit?.value ?? 0;
  const tinker = actor.system?.skills?.tinker?.value ?? 0;
  const pool = Math.max(1, wit + tinker);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;

  const success = successes >= item.difficulty;
  let failure = null;

  if (!success) {
    const failRoll = new Roll('1d6');
    await failRoll.evaluate();
    failure = CRAFTING_FAILURE_TABLE[failRoll.total - 1];
  }

  const speaker = ChatMessage.getSpeaker({ actor });
  const label = game.i18n.localize(item.label);
  let content = `<div class="craft-result">
    <strong>${game.i18n.localize('NEONRELIC.Craft.Attempt')}</strong>: ${label}
    <br>[${results.join(', ')}] = ${successes} / ${item.difficulty}`;

  if (success) {
    content += `<br><em>${game.i18n.localize('NEONRELIC.Craft.Success')}</em>`;
  } else {
    content += `<br><strong>${game.i18n.localize('NEONRELIC.Craft.Failed')}</strong>`;
    if (failure) content += `<br>${game.i18n.localize(failure.result)}`;
  }

  content += '</div>';
  await ChatMessage.create({ speaker, content });

  return { success, failure };
}

// ─── Repair System (#84) ───────────────────────────────────────

/**
 * Repair difficulty tiers.
 */
export const REPAIR_TIERS = {
  minor: { key: 'minor', label: 'NEONRELIC.Repair.Minor', difficulty: 1 },
  moderate: { key: 'moderate', label: 'NEONRELIC.Repair.Moderate', difficulty: 2 },
  major: { key: 'major', label: 'NEONRELIC.Repair.Major', difficulty: 3 },
};

/**
 * Attempt a repair using Tinker + parts resource die.
 * @param {Actor} actor
 * @param {Item} gearItem - The gear item to repair.
 * @param {string} tier - Key from REPAIR_TIERS.
 * @returns {Promise<{success: boolean, partsUsed: boolean}>}
 */
export async function attemptRepair(actor, gearItem, tier) {
  const repairTier = REPAIR_TIERS[tier] ?? REPAIR_TIERS.minor;
  const wit = actor.system?.attributes?.wit?.value ?? 0;
  const tinker = actor.system?.skills?.tinker?.value ?? 0;
  const pool = Math.max(1, wit + tinker);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;

  const success = successes >= repairTier.difficulty;

  if (success && gearItem) {
    // Restore gear die one step up
    const { stepUp } = await import('./resource-die.mjs');
    await stepUp(gearItem);
  }

  const speaker = ChatMessage.getSpeaker({ actor });
  const tierLabel = game.i18n.localize(repairTier.label);
  const content = `<div class="repair-result">
    <strong>${game.i18n.localize('NEONRELIC.Repair.Attempt')}</strong>: ${tierLabel}
    <br>[${results.join(', ')}] = ${successes} / ${repairTier.difficulty}
    <br>${success ? game.i18n.localize('NEONRELIC.Repair.Success') : game.i18n.localize('NEONRELIC.Repair.Failed')}
  </div>`;
  await ChatMessage.create({ speaker, content });

  return { success, partsUsed: true };
}

// ─── Artifact Emission System (#85) ────────────────────────────

/**
 * Emission types.
 */
export const EMISSION_TYPES = {
  aura: {
    key: 'aura',
    label: 'NEONRELIC.Emission.Aura',
    description: 'Continuous effect on all within zone. Passive, always on.',
  },
  pulse: {
    key: 'pulse',
    label: 'NEONRELIC.Emission.Pulse',
    description: 'Periodic burst every d6 rounds affecting all in zone.',
  },
  burst: {
    key: 'burst',
    label: 'NEONRELIC.Emission.Burst',
    description: 'Single massive discharge. High damage, then dormant.',
  },
};

/**
 * Process artifact emission for a given artifact item.
 * @param {Item} artifactItem
 * @param {Actor[]} affectedActors - Actors in emission zone.
 * @returns {Promise<{type: string, affectedCount: number}>}
 */
export async function processEmission(artifactItem, affectedActors) {
  const emissionType = artifactItem.system?.emissionType ?? 'aura';
  const emissionDamage = artifactItem.system?.emissionDamage ?? 1;
  const emissionDamageType = artifactItem.system?.emissionDamageType ?? 'horror';

  const { applyTypedDamage } = await import('./combat-mechanics.mjs');

  for (const actor of affectedActors) {
    await applyTypedDamage(actor, emissionDamage, emissionDamageType);
  }

  const label = game.i18n.localize(EMISSION_TYPES[emissionType]?.label ?? emissionType);
  await ChatMessage.create({
    content: `<div class="artifact-emission">
      <strong>${artifactItem.name}</strong>: ${label}
      <br>${game.i18n.localize('NEONRELIC.Emission.Affected')}: ${affectedActors.length} ${affectedActors.length === 1 ? 'target' : 'targets'}
    </div>`,
  });

  return { type: emissionType, affectedCount: affectedActors.length };
}

// ─── Scavenging System (#86) ───────────────────────────────────

/**
 * Location scavenging tables.
 */
export const SCAVENGE_LOCATIONS = {
  urban: { key: 'urban', label: 'NEONRELIC.Scavenge.Urban', baseDifficulty: 1 },
  industrial: { key: 'industrial', label: 'NEONRELIC.Scavenge.Industrial', baseDifficulty: 2 },
  residential: { key: 'residential', label: 'NEONRELIC.Scavenge.Residential', baseDifficulty: 1 },
  wilderness: { key: 'wilderness', label: 'NEONRELIC.Scavenge.Wilderness', baseDifficulty: 2 },
  military: { key: 'military', label: 'NEONRELIC.Scavenge.Military', baseDifficulty: 3 },
};

/**
 * Scavenge find table (d6).
 */
export const SCAVENGE_FINDS = [
  { roll: 1, result: 'NEONRELIC.Scavenge.Find.Nothing', value: 0 },
  { roll: 2, result: 'NEONRELIC.Scavenge.Find.Junk', value: 1 },
  { roll: 3, result: 'NEONRELIC.Scavenge.Find.Parts', value: 2 },
  { roll: 4, result: 'NEONRELIC.Scavenge.Find.Supplies', value: 3 },
  { roll: 5, result: 'NEONRELIC.Scavenge.Find.Gear', value: 4 },
  { roll: 6, result: 'NEONRELIC.Scavenge.Find.Rare', value: 5 },
];

/**
 * Attempt scavenging at a location.
 * @param {Actor} actor
 * @param {string} locationType - Key from SCAVENGE_LOCATIONS.
 * @returns {Promise<{success: boolean, find: object|null}>}
 */
export async function attemptScavenge(actor, locationType) {
  const location = SCAVENGE_LOCATIONS[locationType] ?? SCAVENGE_LOCATIONS.urban;
  const wit = actor.system?.attributes?.wit?.value ?? 0;
  const investigate = actor.system?.skills?.investigate?.value ?? 0;
  const pool = Math.max(1, wit + investigate);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;

  const success = successes >= location.baseDifficulty;
  let find = null;

  if (success) {
    const findRoll = new Roll('1d6');
    await findRoll.evaluate();
    find = SCAVENGE_FINDS[findRoll.total - 1];
  }

  const speaker = ChatMessage.getSpeaker({ actor });
  const locLabel = game.i18n.localize(location.label);
  let content = `<div class="scavenge-result">
    <strong>${game.i18n.localize('NEONRELIC.Scavenge.Attempt')}</strong>: ${locLabel}
    <br>[${results.join(', ')}] = ${successes} / ${location.baseDifficulty}`;

  if (success && find) {
    content += `<br>${game.i18n.localize('NEONRELIC.Scavenge.Found')}: ${game.i18n.localize(find.result)}`;
  } else {
    content += `<br>${game.i18n.localize('NEONRELIC.Scavenge.NothingFound')}`;
  }

  content += '</div>';
  await ChatMessage.create({ speaker, content });

  return { success, find };
}

// ─── Artifact Decay Track (#87) ────────────────────────────────

/**
 * Artifact decay stages (optional 0-5 track).
 */
export const DECAY_STAGES = [
  { stage: 0, label: 'NEONRELIC.Decay.Pristine', effect: 'No degradation.' },
  { stage: 1, label: 'NEONRELIC.Decay.Tarnished', effect: 'Minor cosmetic signs.' },
  { stage: 2, label: 'NEONRELIC.Decay.Worn', effect: '-1 die to artifact activation rolls.' },
  { stage: 3, label: 'NEONRELIC.Decay.Cracked', effect: 'Emissions become unpredictable.' },
  { stage: 4, label: 'NEONRELIC.Decay.Fractured', effect: 'Activation costs +1 Corruption.' },
  { stage: 5, label: 'NEONRELIC.Decay.Shattered', effect: 'Artifact is destroyed. Cannot be used.' },
];

/**
 * Advance artifact decay by one stage.
 * @param {Item} artifactItem
 * @returns {Promise<{newStage: number, destroyed: boolean}>}
 */
export async function advanceDecay(artifactItem) {
  const currentStage = artifactItem.system?.decayStage ?? 0;
  const newStage = Math.min(5, currentStage + 1);
  const destroyed = newStage >= 5;

  await artifactItem.update({ 'system.decayStage': newStage });

  const stageInfo = DECAY_STAGES[newStage];
  await ChatMessage.create({
    content: `<div class="artifact-decay">
      <strong>${artifactItem.name}</strong>: ${game.i18n.localize(stageInfo.label)}
      <br><em>${stageInfo.effect}</em>
      ${destroyed ? `<br><strong>${game.i18n.localize('NEONRELIC.Decay.Destroyed')}</strong>` : ''}
    </div>`,
  });

  return { newStage, destroyed };
}
