/**
 * Core roll handler for the Year Zero Engine dice pool mechanic.
 * Builds pools, counts successes, handles pushing and opposed rolls.
 * @module components/roll/roll-handler
 */

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
 * Execute a YZE dice pool roll.
 * @param {object} pool - Pool from buildPool().
 * @param {object} [options]
 * @param {boolean} [options.isPush=false] - Whether this is a push roll.
 * @param {number[]} [options.previousRolls] - Previous roll results (for push).
 * @returns {Promise<NRRollResult>}
 */
export async function executeRoll(pool, options = {}) {
  const { isPush = false, previousRolls = [] } = options;

  // For a push, only re-roll non-6 base + skill dice; gear dice are locked
  const rolls = [];
  const gearRolls = [];

  if (isPush && previousRolls.length > 0) {
    // Separate previous results into categories
    const baseSkillCount = pool.baseDice + pool.skillDice;
    let idx = 0;

    // Re-roll base + skill dice (keep 6s)
    for (let i = 0; i < baseSkillCount && idx < previousRolls.length; i++, idx++) {
      if (previousRolls[idx] === 6) {
        rolls.push(6); // Keep successes
      } else {
        const r = Math.ceil(Math.random() * 6);
        rolls.push(r);
      }
    }

    // Gear dice are locked — keep previous results
    for (let i = 0; i < pool.gearDice && idx < previousRolls.length; i++, idx++) {
      const prev = previousRolls[idx];
      gearRolls.push(prev);
      rolls.push(prev);
    }
  } else {
    // Fresh roll — roll all dice
    const baseSkillCount = pool.baseDice + pool.skillDice;
    for (let i = 0; i < baseSkillCount; i++) {
      rolls.push(Math.ceil(Math.random() * 6));
    }
    for (let i = 0; i < pool.gearDice; i++) {
      const r = Math.ceil(Math.random() * 6);
      gearRolls.push(r);
      rolls.push(r);
    }
  }

  const successes = rolls.filter(r => r === 6).length;
  const ones = rolls.filter(r => r === 1).length;
  const gearOnes = gearRolls.filter(r => r === 1).length;

  // Can push if: not already a push, and at least one non-6 base/skill die exists
  const baseSkillDice = rolls.slice(0, pool.baseDice + pool.skillDice);
  const canPush = !isPush && baseSkillDice.some(r => r !== 6);

  return {
    successes,
    ones,
    gearOnes,
    rolls,
    gearRolls,
    canPush,
    isPush,
    pool,
  };
}

/**
 * Push a previous roll — re-rolls non-6 base/skill dice, locks gear dice.
 * Applies +1 Corruption to the actor.
 * @param {NRRollResult} previousResult - Result from executeRoll.
 * @param {Actor} actor - The actor pushing the roll.
 * @returns {Promise<NRRollResult>}
 */
export async function pushRoll(previousResult, actor) {
  const result = await executeRoll(previousResult.pool, {
    isPush: true,
    previousRolls: previousResult.rolls,
  });

  // +1 Corruption for pushing
  if (actor?.gainCorruption) {
    await actor.gainCorruption(1, game.i18n.localize('NEONRELIC.Roll.PushCorruption'));
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
 * @property {number[]} gearRolls - Gear die results only.
 * @property {boolean} canPush - Whether the roll can be pushed.
 * @property {boolean} isPush - Whether this was a pushed roll.
 * @property {object} pool - The dice pool used.
 */
