/**
 * Central corruption logic — gain, heal, threshold computation, and session tracking.
 * @module components/corruption
 */

/**
 * Add corruption to an actor and check threshold.
 * @param {Actor} actor
 * @param {number} amount
 * @param {string} source - i18n key or localized source label.
 * @returns {Promise<{newValue: number, breached: boolean}>}
 */
export async function gainCorruption(actor, amount, source) {
  if (amount <= 0 || actor.type !== 'agent') return { newValue: actor.system.corruption?.value ?? 0, breached: false };

  const current = actor.system.corruption?.value ?? 0;
  const newValue = current + amount;
  const threshold = computeThreshold(actor);
  const breached = newValue > threshold;

  await actor.update({ 'system.corruption.value': newValue });

  // Chat message for corruption gain
  const speaker = ChatMessage.getSpeaker({ actor });
  const stageLabel = _corruptionStageLabel(newValue);
  await ChatMessage.create({
    speaker,
    content: `<div class="corruption-gain">
      <strong>${game.i18n.localize('NEONRELIC.Corruption.Gained')}</strong>:
      +${amount} (${source})
      <br>${game.i18n.localize('NEONRELIC.Corruption.Total')}: ${newValue} / ${threshold}
      <br>${game.i18n.localize('NEONRELIC.Corruption.Stage')}: ${stageLabel}
    </div>`,
  });

  if (breached) {
    await ChatMessage.create({
      speaker,
      content: `<div class="corruption-breach">
        <strong>${game.i18n.localize('NEONRELIC.Corruption.Breached')}</strong>:
        ${game.i18n.localize('NEONRELIC.Corruption.Catatonia')}
      </div>`,
    });
  }

  return { newValue, breached };
}

/**
 * Heal corruption from an actor, enforcing session caps.
 * @param {Actor} actor
 * @param {number} amount
 * @param {string} method - Healing method identifier.
 * @param {object} [options]
 * @param {boolean} [options.isFullRest=false] - Full Rest is exempt from session cap.
 * @param {boolean} [options.isHealingTag=false] - General healing-tagged talent (subject to 3/session cap).
 * @param {boolean} [options.isDivisionHealing=false] - Division healing talent (exempt from healing tag cap).
 * @returns {Promise<{healed: number, newValue: number, cappedBy: string|null}>}
 */
export async function healCorruption(actor, amount, method, options = {}) {
  const { isFullRest = false, isHealingTag = false } = options;

  if (amount <= 0 || actor.type !== 'agent')
    return { healed: 0, newValue: actor.system.corruption?.value ?? 0, cappedBy: null };

  const current = actor.system.corruption?.value ?? 0;
  let effectiveAmount = amount;
  let cappedBy = null;

  // Session cap enforcement (5 total from in-session sources)
  if (!isFullRest) {
    const sessionHealing = actor.system.corruption?.sessionHealing ?? 0;
    const remaining = Math.max(0, 5 - sessionHealing);
    if (remaining <= 0) {
      return { healed: 0, newValue: current, cappedBy: 'session' };
    }
    effectiveAmount = Math.min(effectiveAmount, remaining);
    if (effectiveAmount < amount) cappedBy = 'session';
  }

  // Healing tag cap enforcement (3/session for general healing talents)
  if (isHealingTag) {
    const tagUsed = actor.system.corruption?.healingTagUsed ?? 0;
    const tagRemaining = Math.max(0, 3 - tagUsed);
    if (tagRemaining <= 0) {
      return { healed: 0, newValue: current, cappedBy: 'healingTag' };
    }
    effectiveAmount = Math.min(effectiveAmount, tagRemaining);
    if (effectiveAmount < amount && !cappedBy) cappedBy = 'healingTag';
  }

  const healed = Math.min(effectiveAmount, current);
  const newValue = current - healed;

  const updates = { 'system.corruption.value': newValue };
  if (!isFullRest) {
    updates['system.corruption.sessionHealing'] = (actor.system.corruption?.sessionHealing ?? 0) + healed;
  }
  if (isHealingTag) {
    updates['system.corruption.healingTagUsed'] = (actor.system.corruption?.healingTagUsed ?? 0) + healed;
  }
  await actor.update(updates);

  // Chat message for healing
  const speaker = ChatMessage.getSpeaker({ actor });
  await ChatMessage.create({
    speaker,
    content: `<div class="corruption-heal">
      <strong>${game.i18n.localize('NEONRELIC.Corruption.Healed')}</strong>:
      −${healed} (${method})
      <br>${game.i18n.localize('NEONRELIC.Corruption.Total')}: ${newValue}
      ${cappedBy ? `<br><em>${game.i18n.localize('NEONRELIC.Corruption.CapReached')}</em>` : ''}
    </div>`,
  });

  return { healed, newValue, cappedBy };
}

/**
 * Compute the corruption threshold for an actor.
 * Base: 10 + EMP (max value) + item/effect modifiers.
 * @param {Actor} actor
 * @returns {number}
 */
export function computeThreshold(actor) {
  if (actor.type !== 'agent') return Infinity;

  const emp = actor.system.attributes?.emp ?? 0;
  let base = 10 + emp;

  // Aggregate modifiers from owned items
  for (const item of actor.items) {
    const mod = item.system?.corruptionThresholdMod ?? 0;
    base += mod;
  }

  return base;
}

/**
 * Check if a threshold drop puts the actor over their new threshold.
 * Called when EMP decreases from damage or permanent loss.
 * @param {Actor} actor
 * @returns {Promise<{overThreshold: boolean, currentCorruption: number, newThreshold: number}>}
 */
export async function checkThresholdDrop(actor) {
  if (actor.type !== 'agent') return { overThreshold: false, currentCorruption: 0, newThreshold: Infinity };

  const currentCorruption = actor.system.corruption?.value ?? 0;
  const newThreshold = computeThreshold(actor);
  const overThreshold = currentCorruption > newThreshold;

  if (overThreshold) {
    const speaker = ChatMessage.getSpeaker({ actor });
    await ChatMessage.create({
      speaker,
      content: `<div class="corruption-threshold-drop">
        <strong>${game.i18n.localize('NEONRELIC.Corruption.ThresholdDrop')}</strong>:
        ${game.i18n.localize('NEONRELIC.Corruption.FearCheckRequired')}
      </div>`,
    });
  }

  return { overThreshold, currentCorruption, newThreshold };
}

/* ------------------------------------------ */
/*  Helpers                                   */
/* ------------------------------------------ */

function _corruptionStageLabel(value) {
  if (value <= 0) return game.i18n.localize('NEONRELIC.CorruptionStage.Clean');
  if (value <= 3) return game.i18n.localize('NEONRELIC.CorruptionStage.Touched');
  if (value <= 6) return game.i18n.localize('NEONRELIC.CorruptionStage.Marked');
  if (value <= 9) return game.i18n.localize('NEONRELIC.CorruptionStage.Consumed');
  return game.i18n.localize('NEONRELIC.CorruptionStage.Lost');
}

/* ------------------------------------------ */
/*  Corruption Burst                          */
/* ------------------------------------------ */

/**
 * Execute a Corruption Burst check. Used when directly confronting supernatural phenomena.
 * Wits-only roll (no skill). On failure: +Corruption equal to Burst Rating.
 * Any 1s rolled: +1 Corruption each.
 * @param {Actor} actor
 * @param {number} burstRating - Burst Rating (determines Difficulty)
 * @returns {Promise<{passed: boolean, successes: number, corruptionGained: number, panicResult: string|null}>}
 */
export async function corruptionBurst(actor, burstRating = 1) {
  const wits = actor.system.attributes?.wit?.value ?? actor.system.attributes?.wit ?? 0;
  const poolSize = Math.max(1, wits);
  const roll = await new Roll(`${poolSize}d6`).evaluate();
  const results = roll.dice[0].results.map(d => d.result);
  const successes = results.filter(r => r === 6).length;
  const ones = results.filter(r => r === 1).length;
  const passed = successes >= burstRating;

  let corruptionGained = ones; // +1 per 1 rolled
  let panicResult = null;

  if (!passed) {
    corruptionGained += burstRating; // +Burst Rating on failure
    panicResult = _rollPanic(burstRating);
  }

  if (corruptionGained > 0 && actor.gainCorruption) {
    await actor.gainCorruption(corruptionGained, game.i18n.localize('NEONRELIC.Corruption.BurstSource'));
  }

  return { passed, successes, corruptionGained, panicResult, results };
}

const PANIC_TABLE = [
  { range: [1, 1], result: 'Tremble', text: 'NEONRELIC.Burst.PanicTremble' },
  { range: [2, 2], result: 'Shriek', text: 'NEONRELIC.Burst.PanicShriek' },
  { range: [3, 3], result: 'Flee', text: 'NEONRELIC.Burst.PanicFlee' },
  { range: [4, 4], result: 'Freeze', text: 'NEONRELIC.Burst.PanicFreeze' },
  { range: [5, 5], result: 'Catatonic', text: 'NEONRELIC.Burst.PanicCatatonic' },
  { range: [6, 6], result: 'Fugue', text: 'NEONRELIC.Burst.PanicFugue' },
];

function _rollPanic(burstRating) {
  const d = Math.floor(Math.random() * 6); // 0-5 → 1-6
  const roll = d + 1;
  const entry = PANIC_TABLE.find(p => roll >= p.range[0] && roll <= p.range[1]);
  return entry?.result ?? 'Tremble';
}
