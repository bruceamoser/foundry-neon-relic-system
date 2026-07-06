/**
 * Game systems — equipping phase, death states, downtime, conditions,
 * threat meter, rival cells, personnel, HQ defense, debrief.
 * @module components/game-systems
 */

// ─── Equipping Phase (#95) ─────────────────────────────────────

/**
 * Division requisition bonuses.
 */
export const DIVISION_BONUSES = {
  wayfinder: { key: 'wayfinder', label: 'NEONRELIC.Division.wayfinder', bonusItems: ['codex'] },
  recovery: { key: 'recovery', label: 'NEONRELIC.Division.recovery', bonusItems: ['satchel'] },
  keep: { key: 'keep', label: 'NEONRELIC.Division.keep', bonusItems: ['bracer'] },
};

/**
 * Calculate requisition budget for an agent based on Clearance Level.
 * @param {Actor} actor
 * @returns {{budget: number, divisionBonus: string[]}}
 */
export function getRequisitionBudget(actor) {
  const cl = actor.system?.clearanceLevel ?? 1;
  const budget = cl * 3;
  const division = actor.system?.division ?? '';
  const divisionBonus = DIVISION_BONUSES[division]?.bonusItems ?? [];
  return { budget, divisionBonus };
}

// ─── Death States (#96) ────────────────────────────────────────

/**
 * Death state progression.
 */
export const DEATH_STATES = {
  active: { key: 'active', label: 'NEONRELIC.Death.Active', canAct: true },
  broken: { key: 'broken', label: 'NEONRELIC.Death.Broken', canAct: false },
  dying: { key: 'dying', label: 'NEONRELIC.Death.Dying', canAct: false },
  dead: { key: 'dead', label: 'NEONRELIC.Death.Dead', canAct: false },
};

/**
 * Roll stabilization for a dying actor.
 * @param {Actor} actor
 * @param {Actor} healer - The actor attempting to stabilize.
 * @returns {Promise<{stabilized: boolean, successes: number}>}
 */
export async function rollStabilization(actor, healer) {
  const emp = healer.system?.attributes?.emp?.value ?? 0;
  const healSkill = healer.system?.skills?.heal?.value ?? 0;
  const pool = Math.max(1, emp + healSkill);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;
  const stabilized = successes >= 1;

  if (stabilized) {
    await actor.update({
      'system.conditions.broken': true,
      'system.conditions.dying': false,
    });
  }

  const speaker = ChatMessage.getSpeaker({ actor: healer });
  await ChatMessage.create({
    speaker,
    content: `<div class="stabilization">
      <strong>${game.i18n.localize('NEONRELIC.Death.Stabilize')}</strong>: ${actor.name}
      <br>[${results.join(', ')}] = ${successes}
      <br>${stabilized ? game.i18n.localize('NEONRELIC.Death.Stabilized') : game.i18n.localize('NEONRELIC.Death.StabilizeFailed')}
    </div>`,
  });

  return { stabilized, successes };
}

// ─── Between-Case Downtime (#97) ───────────────────────────────

/**
 * 5-phase downtime system.
 */
export const DOWNTIME_PHASES = [
  { phase: 1, key: 'recovery', label: 'NEONRELIC.Downtime.Recovery' },
  { phase: 2, key: 'requisition', label: 'NEONRELIC.Downtime.Requisition' },
  { phase: 3, key: 'training', label: 'NEONRELIC.Downtime.Training' },
  { phase: 4, key: 'projects', label: 'NEONRELIC.Downtime.Projects' },
  { phase: 5, key: 'briefing', label: 'NEONRELIC.Downtime.Briefing' },
];

// ─── Conditions System (#98) ───────────────────────────────────

/**
 * System conditions with Active Effect templates.
 */
export const CONDITIONS = {
  broken: {
    key: 'broken',
    label: 'NEONRELIC.Condition.Broken',
    icon: 'icons/svg/falling.svg',
    changes: [],
  },
  dying: {
    key: 'dying',
    label: 'NEONRELIC.Condition.Dying',
    icon: 'icons/svg/skull.svg',
    changes: [],
  },
  grappled: {
    key: 'grappled',
    label: 'NEONRELIC.Condition.Grappled',
    icon: 'icons/svg/net.svg',
    changes: [],
  },
  prone: {
    key: 'prone',
    label: 'NEONRELIC.Condition.Prone',
    icon: 'icons/svg/falling.svg',
    changes: [{ key: 'system.modifiers.defense', mode: 2, value: -2 }],
  },
  terrified: {
    key: 'terrified',
    label: 'NEONRELIC.Condition.Terrified',
    icon: 'icons/svg/terror.svg',
    changes: [{ key: 'system.modifiers.willpower', mode: 2, value: -2 }],
  },
  stunned: {
    key: 'stunned',
    label: 'NEONRELIC.Condition.Stunned',
    icon: 'icons/svg/daze.svg',
    changes: [],
  },
};

/**
 * Apply a condition to an actor via Active Effects.
 * @param {Actor} actor
 * @param {string} conditionKey - Key from CONDITIONS.
 * @returns {Promise<ActiveEffect|null>}
 */
export async function applyCondition(actor, conditionKey) {
  const condition = CONDITIONS[conditionKey];
  if (!condition) return null;

  // Check for existing
  const existing = actor.effects.find(e => e.getFlag('neon-relic', 'conditionKey') === conditionKey);
  if (existing) return existing;

  const effectData = {
    name: game.i18n.localize(condition.label),
    icon: condition.icon,
    changes: condition.changes,
    flags: { 'neon-relic': { conditionKey } },
  };

  return actor.createEmbeddedDocuments('ActiveEffect', [effectData]).then(e => e[0]);
}

/**
 * Remove a condition from an actor.
 * @param {Actor} actor
 * @param {string} conditionKey
 * @returns {Promise<void>}
 */
export async function removeCondition(actor, conditionKey) {
  const existing = actor.effects.find(e => e.getFlag('neon-relic', 'conditionKey') === conditionKey);
  if (existing) await existing.delete();
}

// ─── Threat Meter (#99) ────────────────────────────────────────

/**
 * Compromise Events table (d6).
 */
export const COMPROMISE_EVENTS = [
  { roll: 1, result: 'NEONRELIC.Threat.Surveillance', effect: 'Agents are under surveillance for 1 shift.' },
  { roll: 2, result: 'NEONRELIC.Threat.Interference', effect: 'Rival cell interferes with next operation.' },
  { roll: 3, result: 'NEONRELIC.Threat.Leak', effect: 'Information leak — one org gains +2 countdown.' },
  { roll: 4, result: 'NEONRELIC.Threat.Ambush', effect: 'Ambush at next location. Extra enemies in first combat.' },
  { roll: 5, result: 'NEONRELIC.Threat.Betrayal', effect: 'An NPC ally is compromised or turns hostile.' },
  { roll: 6, result: 'NEONRELIC.Threat.Escalation', effect: 'Threat escalates. All org countdowns advance +1.' },
];

/**
 * Advance the threat meter and check for compromise.
 * @param {number} currentThreat
 * @param {number} threshold
 * @returns {Promise<{newThreat: number, compromised: boolean, event: object|null}>}
 */
export async function advanceThreat(currentThreat, threshold) {
  const newThreat = currentThreat + 1;
  const compromised = newThreat >= threshold;
  let event = null;

  if (compromised) {
    const roll = new Roll('1d6');
    await roll.evaluate();
    event = COMPROMISE_EVENTS[roll.total - 1];

    await ChatMessage.create({
      content: `<div class="threat-event">
        <strong>${game.i18n.localize('NEONRELIC.Threat.Compromised')}</strong>
        <br>${game.i18n.localize(event.result)}
        <br><em>${event.effect}</em>
      </div>`,
    });
  }

  return { newThreat, compromised, event };
}

// ─── Rival Cells (#100) ────────────────────────────────────────

/**
 * Rival cell action table (d6).
 */
export const RIVAL_ACTIONS = [
  { roll: 1, result: 'NEONRELIC.Rival.Scout', effect: 'Rival cell gathers intel on agents.' },
  { roll: 2, result: 'NEONRELIC.Rival.Acquire', effect: 'Rival cell acquires a minor artifact.' },
  { roll: 3, result: 'NEONRELIC.Rival.Sabotage', effect: 'Rival cell sabotages an agent resource.' },
  { roll: 4, result: 'NEONRELIC.Rival.Confront', effect: 'Rival cell confronts agents directly.' },
  { roll: 5, result: 'NEONRELIC.Rival.Alliance', effect: 'Rival cell offers temporary alliance.' },
  { roll: 6, result: 'NEONRELIC.Rival.Relic', effect: 'Rival cell claims the target relic.' },
];

// ─── Personnel Recruitment (#101) ──────────────────────────────

/**
 * Recruitable personnel types.
 */
export const PERSONNEL_TYPES = {
  analyst: { key: 'analyst', label: 'NEONRELIC.Personnel.Analyst', skill: 'investigate', cost: 2 },
  medic: { key: 'medic', label: 'NEONRELIC.Personnel.Medic', skill: 'heal', cost: 2 },
  mechanic: { key: 'mechanic', label: 'NEONRELIC.Personnel.Mechanic', skill: 'tinker', cost: 2 },
  guard: { key: 'guard', label: 'NEONRELIC.Personnel.Guard', skill: 'brawl', cost: 3 },
  occultist: { key: 'occultist', label: 'NEONRELIC.Personnel.Occultist', skill: 'lore', cost: 4 },
};

// ─── HQ Defense (#102) ─────────────────────────────────────────

/**
 * HQ assault phases.
 */
export const ASSAULT_PHASES = [
  { phase: 1, key: 'approach', label: 'NEONRELIC.HQDefense.Approach' },
  { phase: 2, key: 'breach', label: 'NEONRELIC.HQDefense.Breach' },
  { phase: 3, key: 'combat', label: 'NEONRELIC.HQDefense.Combat' },
  { phase: 4, key: 'vault', label: 'NEONRELIC.HQDefense.VaultDefense' },
];

// ─── Debrief Checklist (#103) ──────────────────────────────────

/**
 * Debrief XP questions.
 */
export const DEBRIEF_QUESTIONS = [
  { key: 'survived', label: 'NEONRELIC.Debrief.Survived', xp: 1 },
  { key: 'relic', label: 'NEONRELIC.Debrief.SecuredRelic', xp: 1 },
  { key: 'clue', label: 'NEONRELIC.Debrief.UncoveredClue', xp: 1 },
  { key: 'sacrifice', label: 'NEONRELIC.Debrief.MadeSacrifice', xp: 1 },
  { key: 'division', label: 'NEONRELIC.Debrief.ServedDivision', xp: 1 },
  { key: 'bond', label: 'NEONRELIC.Debrief.HonoredBond', xp: 1 },
];

/**
 * DP trigger conditions.
 */
export const DP_TRIGGERS = [
  { key: 'relicContained', label: 'NEONRELIC.Debrief.DP.RelicContained', dp: 2 },
  { key: 'noDeaths', label: 'NEONRELIC.Debrief.DP.NoDeaths', dp: 1 },
  { key: 'orgNeutralized', label: 'NEONRELIC.Debrief.DP.OrgNeutralized', dp: 1 },
  { key: 'lowThreat', label: 'NEONRELIC.Debrief.DP.LowThreat', dp: 1 },
  { key: 'bonusObjective', label: 'NEONRELIC.Debrief.DP.BonusObjective', dp: 1 },
];

/**
 * Calculate debrief rewards.
 * @param {boolean[]} questionAnswers - Array aligned to DEBRIEF_QUESTIONS.
 * @param {boolean[]} dpAnswers - Array aligned to DP_TRIGGERS.
 * @returns {{totalXP: number, totalDP: number}}
 */
export function calculateDebrief(questionAnswers, dpAnswers) {
  let totalXP = 0;
  let totalDP = 0;

  DEBRIEF_QUESTIONS.forEach((q, i) => {
    if (questionAnswers[i]) totalXP += q.xp;
  });

  DP_TRIGGERS.forEach((t, i) => {
    if (dpAnswers[i]) totalDP += t.dp;
  });

  return { totalXP, totalDP };
}
