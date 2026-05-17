/**
 * Corruption source automation — hooks and triggers for all corruption gain sources.
 * Centralizes corruption gain tracking across push, fear, artifact, scene-start, etc.
 * @module components/corruption-sources
 */

/**
 * Corruption source types for chat display and tracking.
 */
export const CORRUPTION_SOURCES = {
  push: 'Push',
  talent: 'Talent',
  artifact: 'Artifact',
  fearOnes: 'FearOnes',
  fearFailure: 'FearFailure',
  psychoanalyze: 'Psychoanalyze',
  panicGuilt: 'PanicGuilt',
  allyContamination: 'AllyContamination',
  personalPhase: 'PersonalPhase',
  artifactPressure: 'ArtifactPressure',
  cascade: 'Cascade',
};

/**
 * Apply corruption from a known source with chat notification.
 * @param {Actor} actor - The agent gaining corruption.
 * @param {number} amount - Amount of corruption to add.
 * @param {string} sourceKey - Key from CORRUPTION_SOURCES.
 * @param {object} [options={}]
 * @param {string} [options.detail] - Extra detail for chat (e.g., artifact name).
 * @returns {Promise<{newValue: number, stageChanged: boolean}>}
 */
export async function applyCorruption(actor, amount, sourceKey, { detail = '' } = {}) {
  if (amount <= 0) return { newValue: actor.system?.corruption?.value ?? 0, stageChanged: false };

  const current = actor.system?.corruption?.value ?? 0;
  const newValue = current + amount;
  const threshold = actor.system?.corruption?.threshold ?? 20;

  // Determine corruption stage before and after
  const oldStage = getCorruptionStage(current);
  const newStage = getCorruptionStage(newValue);
  const stageChanged = oldStage !== newStage;

  await actor.update({ 'system.corruption.value': newValue });

  // Chat notification
  const speaker = ChatMessage.getSpeaker({ actor });
  const sourceLabel = game.i18n.localize(`NEONRELIC.CorruptionSource.${sourceKey}`);
  let content = `<div class="corruption-gain">
    <strong>${game.i18n.localize('NEONRELIC.Corruption.Gained')}</strong>: +${amount} (${sourceLabel})`;

  if (detail) {
    content += ` — ${detail}`;
  }

  content += `<br>${game.i18n.localize('NEONRELIC.Corruption.Label')}: ${newValue} / ${threshold}`;

  if (stageChanged) {
    content += `<br><em>${game.i18n.localize('NEONRELIC.Corruption.StageChanged')}: ${game.i18n.localize(`NEONRELIC.Corruption.Stage.${newStage}`)}</em>`;
  }

  if (newValue >= threshold) {
    content += `<br><strong>${game.i18n.localize('NEONRELIC.Corruption.Catatonia')}</strong>`;
  }

  content += '</div>';
  await ChatMessage.create({ speaker, content });

  return { newValue, stageChanged };
}

/**
 * Get corruption stage based on current value.
 * @param {number} value
 * @returns {string} Stage key: clear, touched, marked, consumed, lost
 */
function getCorruptionStage(value) {
  if (value <= 0) return 'clear';
  if (value <= 3) return 'touched';
  if (value <= 6) return 'marked';
  if (value <= 9) return 'consumed';
  return 'lost';
}

/**
 * Process scene-start corruption sources for all agents in the scene.
 * Checks: ally contamination (stage 10-12), artifact pressure, cascade.
 * @param {Actor[]} actors - All agents in the current scene.
 * @returns {Promise<void>}
 */
export async function processSceneStartCorruption(actors) {
  for (const actor of actors) {
    if (actor.type !== 'agent') continue;

    // Ally contamination: if any agent in scene is at stage 10-12
    const hasContaminatedAlly = actors.some(a => {
      if (a.id === actor.id || a.type !== 'agent') return false;
      const corr = a.system?.corruption?.value ?? 0;
      return corr >= 10;
    });
    if (hasContaminatedAlly) {
      await applyCorruption(actor, 1, CORRUPTION_SOURCES.allyContamination);
    }

    // Active Artifact Pressure: encumbered + has activated artifact
    const activatedArtifacts = actor.items.filter(i => i.type === 'artifact' && i.system?.isActivatedThisCase);
    if (activatedArtifacts.length > 0) {
      const enc = actor.system?.encumbrance ?? {};
      const currentEnc = (enc.value ?? 0) + activatedArtifacts.length;
      const maxEnc = enc.max ?? 0;
      if (currentEnc > maxEnc) {
        await applyCorruption(actor, 1, CORRUPTION_SOURCES.artifactPressure);
      }
    }

    // Corruption Cascade: 3+ activated artifacts
    if (activatedArtifacts.length >= 3) {
      let cascadeTotal = 0;
      for (const artifact of activatedArtifacts) {
        cascadeTotal += artifact.system?.tier ?? 1;
      }
      await applyCorruption(actor, cascadeTotal, CORRUPTION_SOURCES.cascade);
    }
  }
}

/**
 * Register hooks for corruption source automation.
 * Call once during system init.
 */
export function registerCorruptionHooks() {
  // Scene-start corruption processing would be triggered by combat round advance
  // or DA-triggered scene transition — these are integrated via the combat system
  // and scene management rather than a global Hooks.on('sceneStart')
  console.log('neon-relic | Corruption source automation registered');
}
