/**
 * Core roll handler for the Year Zero Engine dice pool mechanic.
 * Builds pools, counts successes, handles pushing and opposed rolls.
 * Uses Foundry's Roll class for auditable dice.
 * @module components/roll/roll-handler
 */

const CHAT_TEMPLATE = 'systems/neon-relic/templates/roll/roll-chatcard.hbs';

/**
 * Build a dice pool from an actor's stats.
 * @param {object} params
 * @param {number} params.attribute - Attribute value.
 * @param {number} params.skill - Skill value.
 * @param {number} [params.gearBonus=0] - Gear bonus dice.
 * @param {number} [params.modifier=0] - Flat modifier to total pool.
 * @returns {{baseDice: number, skillDice: number, gearDice: number, totalPool: number}}
 */
export function buildPool({ attribute = 0, skill = 0, gearBonus = 0, modifier = 0 } = {}) {
  const baseDice = Math.max(0, attribute);
  const skillDice = Math.max(0, skill);
  const gearDice = Math.max(0, gearBonus);
  const totalPool = Math.max(1, baseDice + skillDice + gearDice + modifier);
  return { baseDice, skillDice, gearDice, totalPool };
}

/**
 * Execute a YZE dice pool roll using Foundry's Roll class.
 * @param {object} pool - Pool from buildPool().
 * @param {object} [options]
 * @param {boolean} [options.isPush=false] - Whether this is a push roll.
 * @param {number[]} [options.previousRolls] - Previous roll results (for push).
 * @returns {Promise<NRRollResult>}
 */
export async function executeRoll(pool, options = {}) {
  const { isPush = false, previousRolls = [] } = options;

  const baseCount = pool.baseDice;
  const skillCount = pool.skillDice;
  const gearCount = pool.gearDice;

  const baseResults = [];
  const skillResults = [];
  const gearResults = [];

  if (isPush && previousRolls.length > 0) {
    // Push: re-roll non-6 base+skill dice, keep gear dice locked
    let idx = 0;
    for (let i = 0; i < baseCount && idx < previousRolls.length; i++, idx++) {
      if (previousRolls[idx] === 6) {
        baseResults.push(6);
      } else {
        const r = await new Roll('1d6').evaluate();
        baseResults.push(r.total);
      }
    }
    for (let i = 0; i < skillCount && idx < previousRolls.length; i++, idx++) {
      if (previousRolls[idx] === 6) {
        skillResults.push(6);
      } else {
        const r = await new Roll('1d6').evaluate();
        skillResults.push(r.total);
      }
    }
    for (let i = 0; i < gearCount && idx < previousRolls.length; i++, idx++) {
      gearResults.push(previousRolls[idx]);
    }
  } else {
    // Fresh roll
    if (baseCount > 0) {
      const r = await new Roll(`${baseCount}d6`).evaluate();
      baseResults.push(...r.dice[0].results.map(d => d.result));
    }
    if (skillCount > 0) {
      const r = await new Roll(`${skillCount}d6`).evaluate();
      skillResults.push(...r.dice[0].results.map(d => d.result));
    }
    if (gearCount > 0) {
      const r = await new Roll(`${gearCount}d6`).evaluate();
      gearResults.push(...r.dice[0].results.map(d => d.result));
    }
  }

  const allRolls = [...baseResults, ...skillResults, ...gearResults];
  const successes = allRolls.filter(r => r === 6).length;
  const ones = allRolls.filter(r => r === 1).length;
  const gearOnes = gearResults.filter(r => r === 1).length;

  const baseSkillDice = [...baseResults, ...skillResults];
  const canPush = !isPush && baseSkillDice.some(r => r !== 6);

  return {
    successes,
    ones,
    gearOnes,
    rolls: allRolls,
    baseResults,
    skillResults,
    gearResults,
    canPush,
    isPush,
    pool,
  };
}

/**
 * Send roll results to chat as a formatted message.
 * @param {NRRollResult} result - From executeRoll().
 * @param {object} context - Roll context for display.
 * @param {string} [context.attribute] - Attribute key.
 * @param {string} [context.skill] - Skill key.
 * @param {number} [context.difficulty] - Required successes.
 * @param {string} [context.notes] - Player notes.
 * @param {string} [context.actorId] - Actor ID.
 * @param {number} [context.stuntPoints] - Extra successes above difficulty.
 * @returns {Promise<ChatMessage>}
 */
export async function sendRollToChat(result, context = {}) {
  const attrConfig = CONFIG.NEON_RELIC?.attributes ?? {};
  const skillConfig = CONFIG.NEON_RELIC?.skills ?? {};

  const attributeLabel = context.attribute
    ? game.i18n.localize(attrConfig[context.attribute] ?? context.attribute)
    : '';
  const skillLabel = context.skill ? game.i18n.localize(skillConfig[context.skill]?.label ?? context.skill) : '';

  const difficulty = context.difficulty || 0;
  const stuntPoints = context.stuntPoints ?? Math.max(0, result.successes - difficulty);

  const isFailure = difficulty > 0 && result.successes < difficulty;
  const templateData = {
    actorId: context.actorId || '',
    attributeLabel,
    skillLabel,
    baseDice: result.baseResults.map(v => ({ value: v, success: v === 6 })),
    skillDice: result.skillResults.map(v => ({ value: v, success: v === 6 })),
    gearDice: result.gearResults.map(v => ({ value: v, success: v === 6 })),
    successes: result.successes,
    difficulty,
    stuntPoints,
    isSuccess: difficulty > 0 ? result.successes >= difficulty : null,
    isFailure,
    canPush: !result.isPush && result.canPush !== false,
    isPush: result.isPush,
    notes: context.notes || '',
    attributeKey: context.attribute || '',
    previousRolls: JSON.stringify(result.rolls),
    poolData: JSON.stringify(result.pool),
  };

  let content;
  try {
    content = await renderTemplate(CHAT_TEMPLATE, templateData);
  } catch (err) {
    console.error('neon-relic | Failed to render roll chat card:', err);
    // Fallback: plain text message
    const resultText = `${templateData.successes} successes`;
    const diffText =
      templateData.difficulty > 0
        ? ` (Difficulty ${templateData.difficulty} — ${templateData.isSuccess ? 'PASS' : 'FAIL'})`
        : '';
    content = `<div class='nr-roll-card'><p><strong>${templateData.attributeLabel}${templateData.skillLabel ? ` (${templateData.skillLabel})` : ''}</strong>: ${resultText}${diffText}</p></div>`;
  }

  const speaker = context.actorId
    ? ChatMessage.getSpeaker({ actor: game.actors.get(context.actorId) })
    : ChatMessage.getSpeaker();

  return ChatMessage.create({
    content,
    speaker,
    sound: CONFIG.sounds.dice,
  });
}

/**
 * Push a previous roll — re-rolls non-6 base/skill dice, locks gear dice.
 * Applies +1 Corruption and 1 attribute damage to the actor.
 * @param {NRRollResult} previousResult - Result from executeRoll.
 * @param {Actor} actor - The actor pushing the roll.
 * @param {string} [attributeKey] - Attribute key used for the roll (str/agi/wit/emp).
 * @returns {Promise<NRRollResult>}
 */
export async function pushRoll(previousResult, actor, attributeKey) {
  const result = await executeRoll(previousResult.pool, {
    isPush: true,
    previousRolls: previousResult.rolls,
  });

  // +1 Corruption for pushing
  if (actor?.gainCorruption) {
    await actor.gainCorruption(1, game.i18n.localize('NEONRELIC.Roll.PushCorruption'));
  }

  // −1 to the attribute being pushed
  if (actor?.applyDamage && attributeKey) {
    const attrToDamage = { str: 'physical', agi: 'hobbling', wit: 'horror', emp: 'trauma' };
    const damageType = attrToDamage[attributeKey] ?? 'physical';
    await actor.applyDamage(1, damageType);
  }

  return result;
}

/**
 * Resolve an opposed roll between two results.
 * @param {NRRollResult} attackerResult
 * @param {NRRollResult} defenderResult
 * @param {object} [options]
 * @param {boolean} [options.isDodge=false] - Dodge: defender wins ties.
 * @returns {{winner: string, netSuccesses: number, attackerSuccesses: number, defenderSuccesses: number}}
 */
export function resolveOpposed(attackerResult, defenderResult, options = {}) {
  const { isDodge = false } = options;
  const atk = attackerResult.successes;
  const def = defenderResult.successes;

  // Zero-zero tie: no effect
  if (atk === 0 && def === 0) {
    return { winner: 'none', netSuccesses: 0, attackerSuccesses: atk, defenderSuccesses: def };
  }

  let winner;
  if (atk > def) {
    winner = 'attacker';
  } else if (def > atk) {
    winner = 'defender';
  } else {
    // Tie: attacker wins EXCEPT dodge (defender wins on tie)
    winner = isDodge ? 'defender' : 'attacker';
  }

  const netSuccesses = Math.abs(atk - def);
  return { winner, netSuccesses, attackerSuccesses: atk, defenderSuccesses: def };
}

/**
 * Add help dice to a pool. Validates helper requirements.
 * @param {Actor} helperActor - The helper providing dice.
 * @param {string} skill - The skill being helped with.
 * @param {object} pool - The target pool (mutated).
 * @returns {{valid: boolean, diceAdded: number, reason: string}}
 */
export function addHelpDice(helperActor, skill, pool) {
  const skillValue = helperActor.system?.skills?.[skill] ?? 0;
  if (skillValue < 1) {
    return { valid: false, diceAdded: 0, reason: 'NEONRELIC.Help.NoSkill' };
  }

  // Add as skill dice (not base dice)
  pool.skillDice += skillValue;
  pool.totalPool += skillValue;
  return { valid: true, diceAdded: skillValue, reason: '' };
}

/**
 * @typedef {object} NRRollResult
 * @property {number} successes - Count of 6s rolled.
 * @property {number} ones - Count of 1s rolled (all dice).
 * @property {number} gearOnes - Count of 1s on gear dice specifically.
 * @property {number[]} rolls - All die results.
 * @property {number[]} baseResults - Base (attribute) die results.
 * @property {number[]} skillResults - Skill die results.
 * @property {number[]} gearResults - Gear die results.
 * @property {boolean} canPush - Whether the roll can be pushed.
 * @property {boolean} isPush - Whether this was a pushed roll.
 * @property {object} pool - The dice pool used.
 */

/* ------------------------------------------ */
/*  D66 Roll                                  */
/* ------------------------------------------ */

/**
 * Roll a D66 — two d6 dice read as tens and ones (11-66).
 * Used for critical injury tables, stunt tables, etc.
 * @returns {Promise<{tens: number, ones: number, total: number, roll: Roll}>}
 */
export async function rollD66() {
  const roll = new Roll('1d6 * 10 + 1d6');
  await roll.evaluate();
  const tens = roll.dice[0].results[0].result;
  const ones = roll.dice[1].results[0].result;
  return { tens, ones, total: tens * 10 + ones, roll };
}

/* ------------------------------------------ */
/*  Group Roll                                */
/* ------------------------------------------ */

/**
 * Execute a group roll — one designated leader rolls with their pool,
 * and each helper contributes +1 die per point in the relevant skill (min 1).
 * @param {object} params
 * @param {object} params.leaderPool - Pool from buildPool() for the leader.
 * @param {Actor[]} params.helpers - Array of helping actors.
 * @param {string} params.skill - The skill key used for the group roll.
 * @returns {Promise<{result: NRRollResult, helpDice: number, helperCount: number}>}
 */
export async function executeGroupRoll({ leaderPool, helpers = [], skill }) {
  let helpDice = 0;
  let helperCount = 0;

  for (const helper of helpers) {
    const skillValue = helper.system?.skills?.[skill] ?? 0;
    if (skillValue >= 1) {
      helpDice += skillValue;
      helperCount++;
    }
  }

  // Add help dice to the leader's pool
  const augmentedPool = { ...leaderPool };
  augmentedPool.skillDice += helpDice;
  augmentedPool.totalPool += helpDice;

  const result = await executeRoll(augmentedPool);
  return { result, helpDice, helperCount };
}
