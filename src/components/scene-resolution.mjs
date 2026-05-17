/**
 * Scene resolution system — key activity rolls, 4 contribution types, 5 result bands.
 * @module components/scene-resolution
 */

/**
 * Contribution types for scene resolution.
 */
export const CONTRIBUTION_TYPES = {
  immediate: { key: 'immediate', label: 'NEONRELIC.Scene.Immediate' },
  shield: { key: 'shield', label: 'NEONRELIC.Scene.Shield' },
  position: { key: 'position', label: 'NEONRELIC.Scene.Position' },
  delayed: { key: 'delayed', label: 'NEONRELIC.Scene.Delayed' },
};

/**
 * Result bands for scene resolution.
 */
export const RESULT_BANDS = {
  cleanProgress: { key: 'cleanProgress', label: 'NEONRELIC.Scene.CleanProgress', minSuccesses: 3 },
  progressWithCost: { key: 'progressWithCost', label: 'NEONRELIC.Scene.ProgressWithCost', minSuccesses: 2 },
  partialProgress: { key: 'partialProgress', label: 'NEONRELIC.Scene.PartialProgress', minSuccesses: 1 },
  setbackWithSignal: { key: 'setbackWithSignal', label: 'NEONRELIC.Scene.SetbackWithSignal', minSuccesses: 0 },
  breach: { key: 'breach', label: 'NEONRELIC.Scene.Breach', minSuccesses: -1 },
};

/**
 * Determine result band based on successes vs difficulty.
 * @param {number} successes - Number of 6s rolled.
 * @param {number} difficulty - Target number of successes.
 * @returns {object} Result band definition.
 */
export function getResultBand(successes, difficulty) {
  const surplus = successes - difficulty;
  if (surplus >= 2) return RESULT_BANDS.cleanProgress;
  if (surplus >= 0) return RESULT_BANDS.progressWithCost;
  if (surplus >= -1) return RESULT_BANDS.partialProgress;
  if (surplus >= -2) return RESULT_BANDS.setbackWithSignal;
  return RESULT_BANDS.breach;
}

/**
 * Resolve a scene with key activity and contributions.
 * @param {Actor} keyActor - The actor making the key activity roll.
 * @param {object} params
 * @param {string} params.skill - Skill key for the key activity.
 * @param {number} params.difficulty - Target successes.
 * @param {object[]} [params.contributions=[]] - Array of {type, actorName, dice}.
 * @param {number} [params.shieldCount=0] - Number of shield contributions.
 * @returns {Promise<{successes: number, band: object, contributions: object[]}>}
 */
export async function resolveScene(keyActor, { skill, difficulty, contributions = [], shieldCount = 0 }) {
  // Calculate base pool: attribute + skill
  const skillData = keyActor.system?.skills?.[skill];
  const attrKey = skillData?.attribute;
  const attrValue = attrKey ? (keyActor.system?.attributes?.[attrKey]?.value ?? 0) : 0;
  const skillValue = skillData?.value ?? 0;
  let pool = attrValue + skillValue;

  // Add immediate contribution dice
  const immediateDice = contributions.filter(c => c.type === 'immediate').reduce((sum, c) => sum + (c.dice ?? 1), 0);
  pool += immediateDice;

  pool = Math.max(1, pool);

  // Roll
  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;

  // Determine result band (shield contributions improve effective result)
  const effectiveSuccesses = successes + Math.min(shieldCount, 1);
  const band = getResultBand(effectiveSuccesses, difficulty);

  // Chat output
  const speaker = ChatMessage.getSpeaker({ actor: keyActor });
  let content = `<div class="scene-resolution">
    <strong>${game.i18n.localize('NEONRELIC.Scene.Resolution')}</strong>
    <br>${game.i18n.localize('NEONRELIC.Roll.Dice')}: [${results.join(', ')}]
    <br>${game.i18n.localize('NEONRELIC.Roll.Successes')}: ${successes} / ${difficulty}`;

  if (immediateDice > 0) {
    content += `<br>${game.i18n.localize('NEONRELIC.Scene.Immediate')}: +${immediateDice} dice`;
  }

  if (shieldCount > 0) {
    content += `<br>${game.i18n.localize('NEONRELIC.Scene.Shield')}: ${shieldCount}`;
  }

  content += `<br><strong>${game.i18n.localize(band.label)}</strong>`;

  // List contributions
  for (const c of contributions) {
    const typeLabel = game.i18n.localize(CONTRIBUTION_TYPES[c.type]?.label ?? c.type);
    content += `<br>— ${c.actorName}: ${typeLabel}`;
  }

  content += '</div>';
  await ChatMessage.create({ speaker, content });

  return { successes, band, contributions };
}

/**
 * Create a delayed result record for tracking.
 * @param {object} params
 * @param {string} params.description - What will return.
 * @param {number} params.earliestShift - Earliest shift it can resolve.
 * @param {string} params.disruptCondition - What can prevent the payoff.
 * @returns {object}
 */
export function createDelayedResult({ description, earliestShift, disruptCondition }) {
  return {
    description,
    earliestShift,
    disruptCondition,
    resolved: false,
  };
}
