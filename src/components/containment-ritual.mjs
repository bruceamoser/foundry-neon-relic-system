/**
 * Containment ritual workflow — three ritual types, difficulty modifiers,
 * support actions, and backlash mechanics.
 * @module components/containment-ritual
 */

/**
 * Ritual type definitions.
 */
export const RITUAL_TYPES = {
  quiescence: {
    key: 'quiescence',
    label: 'NEONRELIC.Ritual.Quiescence',
    baseDiff: 2,
    loreMin: 1,
  },
  shielding: {
    key: 'shielding',
    label: 'NEONRELIC.Ritual.Shielding',
    baseDiff: 2,
    loreMin: 1,
  },
  banishment: {
    key: 'banishment',
    label: 'NEONRELIC.Ritual.Banishment',
    baseDiff: 3,
    loreMin: 3,
  },
};

/**
 * Backlash table (d6, on failure or push).
 */
const BACKLASH_TABLE = {
  1: { key: 'CorruptionSurge' },
  2: { key: 'BoundaryRupture' },
  3: { key: 'ClockAdvance' },
  4: { key: 'PsychicRecoil' },
  5: { key: 'AnchorShift' },
  6: { key: 'HostileBacklash' },
};

/**
 * Calculate total difficulty for a containment ritual.
 * @param {object} params
 * @param {string} params.ritualType - Key from RITUAL_TYPES.
 * @param {object} [params.modifiers={}] - Difficulty modifier flags.
 * @param {boolean} [params.modifiers.tier3] - Tier 3 artifact.
 * @param {boolean} [params.modifiers.activeArtifact] - Artifact is active.
 * @param {boolean} [params.modifiers.emitting] - Artifact is emitting.
 * @param {boolean} [params.modifiers.multiPerson] - Multi-person ritual.
 * @param {boolean} [params.modifiers.catastrophic] - Catastrophic multi-zone emission.
 * @param {boolean} [params.modifiers.hostile] - Hostile conditions.
 * @param {boolean} [params.modifiers.profileKnown] - Containment profile known.
 * @param {boolean} [params.modifiers.preparedVault] - Vault/lab available.
 * @param {boolean} [params.modifiers.noWayfinder] - Banishment without Wayfinder (Lore 2+ only).
 * @returns {number} Total difficulty.
 */
export function calculateDifficulty({ ritualType, modifiers = {} }) {
  const ritual = RITUAL_TYPES[ritualType];
  if (!ritual) return 99;

  let diff = ritual.baseDiff;

  if (modifiers.tier3) diff += 1;
  if (modifiers.activeArtifact) diff += 1;
  if (modifiers.emitting) diff += 1;
  if (modifiers.multiPerson) diff += 1;
  if (modifiers.catastrophic) diff += 2;
  if (modifiers.hostile) diff += 1;
  if (modifiers.profileKnown) diff -= 1;
  if (modifiers.preparedVault) diff -= 1;
  if (ritualType === 'banishment' && modifiers.noWayfinder) diff += 1;

  return Math.max(1, diff);
}

/**
 * Execute a containment ritual.
 * @param {Actor} leader - The ritual leader.
 * @param {object} params
 * @param {string} params.ritualType - Key from RITUAL_TYPES.
 * @param {object} [params.modifiers={}] - Difficulty modifiers.
 * @param {number} [params.supportDice=0] - Extra dice from support actions.
 * @param {boolean} [params.targetActive=false] - Whether target is active/manifest.
 * @returns {Promise<{success: boolean, successes: number, difficulty: number, backlash: object|null, pushed: boolean}>}
 */
export async function executeRitual(leader, { ritualType, modifiers = {}, supportDice = 0, targetActive = false }) {
  const ritual = RITUAL_TYPES[ritualType];
  if (!ritual) return { success: false, successes: 0, difficulty: 99, backlash: null, pushed: false };

  // Check Lore prerequisite
  const loreValue = leader.system?.skills?.lore?.value ?? 0;
  const loreMin = ritualType === 'banishment' && modifiers.noWayfinder ? 2 : ritual.loreMin;
  if (loreValue < loreMin) {
    const speaker = ChatMessage.getSpeaker({ actor: leader });
    await ChatMessage.create({
      speaker,
      content: `<div class="ritual-fail"><strong>${game.i18n.localize('NEONRELIC.Ritual.InsufficientLore')}</strong></div>`,
    });
    return { success: false, successes: 0, difficulty: 0, backlash: null, pushed: false };
  }

  const difficulty = calculateDifficulty({ ritualType, modifiers });

  // Build dice pool: WIT + Lore + support dice
  const wit = leader.system?.attributes?.wit?.value ?? 0;
  const pool = Math.max(1, wit + loreValue + supportDice);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;
  const success = successes >= difficulty;

  let backlash = null;
  if (!success) {
    backlash = await rollBacklash(leader);
  }

  // Push cost: +1 Corruption if target is active (even on success)
  if (targetActive) {
    const current = leader.system?.corruption?.value ?? 0;
    await leader.update({ 'system.corruption.value': current + 1 });
  }

  // Chat output
  const speaker = ChatMessage.getSpeaker({ actor: leader });
  let content = `<div class="containment-ritual">
    <strong>${game.i18n.localize(ritual.label)}</strong>
    <br>${game.i18n.localize('NEONRELIC.Roll.Dice')}: [${results.join(', ')}]
    <br>${game.i18n.localize('NEONRELIC.Roll.Successes')}: ${successes} / ${difficulty}`;

  if (success) {
    content += `<br><strong>${game.i18n.localize('NEONRELIC.Ritual.Success')}</strong>`;
  } else {
    content += `<br><strong>${game.i18n.localize('NEONRELIC.Ritual.Failure')}</strong>`;
  }

  if (targetActive) {
    content += `<br>${game.i18n.localize('NEONRELIC.Ritual.ActiveTargetCorruption')}`;
  }

  if (backlash) {
    content += `<br><em>${game.i18n.localize('NEONRELIC.Ritual.Backlash')}: ${game.i18n.localize(`NEONRELIC.Ritual.BacklashEffect.${backlash.key}`)}</em>`;
  }

  content += '</div>';
  await ChatMessage.create({ speaker, content });

  return { success, successes, difficulty, backlash, pushed: targetActive };
}

/**
 * Roll on the backlash table (d6).
 * @param {Actor} _leader - The ritual leader (for future effect application).
 * @returns {Promise<object>} Backlash result.
 */
async function rollBacklash(_leader) {
  const roll = new Roll('1d6');
  await roll.evaluate();
  return BACKLASH_TABLE[roll.total] ?? BACKLASH_TABLE[1];
}
