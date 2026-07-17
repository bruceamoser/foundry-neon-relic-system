/**
 * Corruption stage effects — Active Effect management based on corruption level.
 * Applies/removes stage-specific mechanical modifiers as corruption changes.
 * @module components/corruption-stages
 */

/**
 * Corruption stage definitions with ranges and mechanical effects.
 */
export const CORRUPTION_STAGES = [
  {
    key: 'nosebleeds',
    min: 1,
    max: 3,
    label: 'NEONRELIC.CorruptionStage.Nosebleeds',
    effects: [], // Descriptive only
  },
  {
    key: 'hallucinations',
    min: 4,
    max: 6,
    label: 'NEONRELIC.CorruptionStage.Hallucinations',
    effects: [], // DA-triggered Wits check
  },
  {
    key: 'tremors',
    min: 7,
    max: 9,
    label: 'NEONRELIC.CorruptionStage.Tremors',
    effects: [
      { key: 'system.skills.deftHands.modifier', mode: 2, value: -1 },
      { key: 'system.skills.firearms.modifier', mode: 2, value: -1 },
    ],
  },
  {
    key: 'distortion',
    min: 10,
    max: 12,
    label: 'NEONRELIC.CorruptionStage.Distortion',
    effects: [], // Ally contamination handled by corruption-sources.mjs
  },
  {
    key: 'chronicFugue',
    min: 13,
    max: 14,
    label: 'NEONRELIC.CorruptionStage.ChronicFugue',
    effects: [], // d6 roll at scene start handled by hook
  },
  {
    key: 'collapse',
    min: 15,
    max: 99,
    label: 'NEONRELIC.CorruptionStage.Collapse',
    effects: [
      { key: 'system.skills.persuade.modifier', mode: 2, value: -1 },
      { key: 'system.skills.psychoanalyze.modifier', mode: 2, value: -1 },
      { key: 'system.skills.performance.modifier', mode: 2, value: -1 },
    ],
  },
];

/**
 * Get the corruption stage for a given corruption value.
 * @param {number} value - Current corruption value.
 * @returns {object|null} Stage definition or null if clean.
 */
export function getStageForValue(value) {
  if (value <= 0) return null;
  return CORRUPTION_STAGES.find(s => value >= s.min && value <= s.max) ?? null;
}

/**
 * Update Active Effects on an actor based on corruption stage change.
 * Removes old stage effect and applies new one.
 * @param {Actor} actor
 * @param {number} oldValue - Previous corruption value.
 * @param {number} newValue - New corruption value.
 * @returns {Promise<void>}
 */
export async function updateStageEffects(actor, oldValue, newValue) {
  const oldStage = getStageForValue(oldValue);
  const newStage = getStageForValue(newValue);

  if (oldStage?.key === newStage?.key) return;

  // Remove old stage effect
  if (oldStage) {
    const existing = actor.effects.find(e => e.getFlag('neon-relic', 'corruptionStage') === oldStage.key);
    if (existing) {
      await existing.delete();
    }
  }

  // Apply new stage effect
  if (newStage && newStage.effects.length > 0) {
    const changes = newStage.effects.map(e => ({
      key: e.key,
      mode: e.mode,
      value: e.value,
    }));

    await actor.createEmbeddedDocuments('ActiveEffect', [
      {
        name: game.i18n.localize(newStage.label),
        icon: `systems/neon-relic/assets/icons/corruption-${newStage.key}.webp`,
        changes,
        flags: { 'neon-relic': { corruptionStage: newStage.key } },
      },
    ]);
  }

  // Chat notification for stage transition
  if (newStage && newStage.key !== oldStage?.key) {
    const speaker = ChatMessage.getSpeaker({ actor });
    await ChatMessage.create({
      speaker,
      content: `<div class="corruption-stage-change">
        <strong>${game.i18n.localize('NEONRELIC.Corruption.StageChanged')}</strong>:
        ${game.i18n.localize(newStage.label)}
      </div>`,
    });
  }
}

/**
 * Roll Chronic Fugue check (stage 13-14) at scene start.
 * On d6 result of 1-2, DA controls character for 1 round.
 * @param {Actor} actor
 * @returns {Promise<{triggered: boolean, roll: number|null}>}
 */
export async function rollChronicFugue(actor) {
  const corruption = actor.system?.corruption?.value ?? 0;
  const stage = getStageForValue(corruption);
  if (!stage || stage.key !== 'chronicFugue') return { triggered: false, roll: null };

  const roll = new Roll('1d6');
  await roll.evaluate();
  const triggered = roll.total <= 2;

  const speaker = ChatMessage.getSpeaker({ actor });
  await ChatMessage.create({
    speaker,
    content: `<div class="chronic-fugue">
      <strong>${game.i18n.localize('NEONRELIC.CorruptionStage.ChronicFugue')}</strong>:
      d6 = ${roll.total}
      ${triggered ? `<br><em>${game.i18n.localize('NEONRELIC.CorruptionStage.FugueTriggered')}</em>` : ''}
    </div>`,
  });

  return { triggered, roll: roll.total };
}
