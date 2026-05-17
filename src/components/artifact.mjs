/**
 * Artifact activation workflow and artifact die chain.
 * Handles activation, artifact die step-down (d20→Fractured), cascade detection.
 * @module components/artifact
 */

/**
 * Artifact die chain: d20 → d12 → d10 → d8 → d6 → d4 → Fractured (0).
 * Steps down on rolling a 1 only (not 1-2 like resource dice).
 */
const ARTIFACT_DIE_CHAIN = [20, 12, 10, 8, 6, 4, 0];

/** Corruption cost per artifact tier. */
const TIER_CORRUPTION = { 1: 1, 2: 2, 3: 3 };

/**
 * Activate an artifact — full workflow.
 * @param {Item} artifactItem - The artifact item being activated.
 * @param {Actor} actor - The agent activating the artifact.
 * @returns {Promise<{activated: boolean, corruptionGained: number, dieResult: number|null, steppedDown: boolean, fractured: boolean, cascade: boolean}>}
 */
export async function activate(artifactItem, actor) {
  if (artifactItem.type !== 'artifact') return { activated: false };

  const tier = artifactItem.system?.tier ?? 1;
  const corruptionCost = TIER_CORRUPTION[tier] ?? 1;

  // 1. Apply corruption cost
  const currentCorruption = actor.system.corruption?.value ?? 0;
  await actor.update({ 'system.corruption.value': currentCorruption + corruptionCost });

  // 2. Roll artifact die
  const { dieResult, steppedDown, fractured, newDie } = await rollArtifactDie(artifactItem);

  // 3. Mark as activated this case
  await artifactItem.update({ 'system.isActivatedThisCase': true });

  // 4. Check for cascade (3+ activated artifacts on the same actor)
  const cascade = checkCascade(actor);

  // 5. Chat message
  const speaker = ChatMessage.getSpeaker({ actor });
  let content = `<div class="artifact-activation">
    <strong>${artifactItem.name}</strong> ${game.i18n.localize('NEONRELIC.Artifact.ActivatedVerb')}
    <br>${game.i18n.localize('NEONRELIC.Corruption.Gained')}: +${corruptionCost}`;

  if (dieResult !== null) {
    content += `<br>${game.i18n.localize('NEONRELIC.Artifact.DieRoll')}: d${artifactItem.system?.artifactDie ?? '?'} → ${dieResult}`;
    if (steppedDown) {
      content += ` (→ d${newDie})`;
    }
  }

  if (fractured) {
    content += `<br><strong>${game.i18n.localize('NEONRELIC.Artifact.Fractured')}</strong>`;
    if (artifactItem.system?.fractureCondition) {
      content += `: ${artifactItem.system.fractureCondition}`;
    }
  }

  if (cascade) {
    content += `<br><em>${game.i18n.localize('NEONRELIC.Artifact.CascadeWarning')}</em>`;
  }

  content += '</div>';
  await ChatMessage.create({ speaker, content });

  return { activated: true, corruptionGained: corruptionCost, dieResult, steppedDown, fractured, cascade };
}

/**
 * Roll the artifact die — steps down on 1 only.
 * @param {Item} artifactItem
 * @returns {Promise<{dieResult: number|null, steppedDown: boolean, fractured: boolean, newDie: number}>}
 */
export async function rollArtifactDie(artifactItem) {
  const currentDie = artifactItem.system?.artifactDie ?? 20;
  if (currentDie <= 0) {
    return { dieResult: null, steppedDown: false, fractured: true, newDie: 0 };
  }

  const roll = new Roll(`1d${currentDie}`);
  await roll.evaluate();
  const dieResult = roll.total;
  const steppedDown = dieResult === 1;
  let newDie = currentDie;
  let fractured = false;

  if (steppedDown) {
    const idx = ARTIFACT_DIE_CHAIN.indexOf(currentDie);
    newDie = idx >= 0 && idx < ARTIFACT_DIE_CHAIN.length - 1 ? ARTIFACT_DIE_CHAIN[idx + 1] : 0;
    fractured = newDie === 0;
    await artifactItem.update({ 'system.artifactDie': newDie });
  }

  return { dieResult, steppedDown, fractured, newDie };
}

/**
 * Check if an actor has 3+ activated artifacts (Corruption Cascade).
 * @param {Actor} actor
 * @returns {boolean}
 */
export function checkCascade(actor) {
  const activatedCount = actor.items.filter(i => i.type === 'artifact' && i.system?.isActivatedThisCase).length;
  return activatedCount >= 3;
}

/**
 * Calculate Active Artifact Pressure — extra encumbrance from activated artifacts.
 * Each activated artifact adds +1 Enc above base.
 * @param {Actor} actor
 * @returns {number} Extra encumbrance from artifact pressure.
 */
export function getArtifactPressure(actor) {
  return actor.items.filter(i => i.type === 'artifact' && i.system?.isActivatedThisCase).length;
}

/**
 * Reset all artifact activation flags at end of case.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function resetCaseActivations(actor) {
  const updates = actor.items
    .filter(i => i.type === 'artifact' && i.system?.isActivatedThisCase)
    .map(i => ({ _id: i.id, 'system.isActivatedThisCase': false }));
  if (updates.length) {
    await actor.updateEmbeddedDocuments('Item', updates);
  }
}
