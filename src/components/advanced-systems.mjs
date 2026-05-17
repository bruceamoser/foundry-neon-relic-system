/**
 * Advanced game systems — HQ upgrades, case file, social conflict,
 * chase, tail, travel, mob combat.
 * @module components/advanced-systems
 */

// ─── HQ Upgrade Tree (#41) ────────────────────────────────────

/**
 * HQ facility tiers.
 */
export const FACILITY_TIERS = {
  basic: { key: 'basic', label: 'NEONRELIC.HQ.Tier.Basic', standingRequired: 0 },
  improved: { key: 'improved', label: 'NEONRELIC.HQ.Tier.Improved', standingRequired: 5 },
  advanced: { key: 'advanced', label: 'NEONRELIC.HQ.Tier.Advanced', standingRequired: 10 },
};

/**
 * Check if a facility upgrade is available.
 * @param {Actor} hqActor
 * @param {string} targetTier - Key from FACILITY_TIERS.
 * @returns {{available: boolean, reason: string}}
 */
export function checkUpgradeAvailability(hqActor, targetTier) {
  const tier = FACILITY_TIERS[targetTier];
  if (!tier) return { available: false, reason: 'Invalid tier.' };

  const standing = hqActor.system?.standing ?? 0;
  if (standing < tier.standingRequired) {
    return { available: false, reason: `Requires Standing ${tier.standingRequired}. Current: ${standing}.` };
  }

  return { available: true, reason: '' };
}

// ─── Case File JournalEntry (#42) ──────────────────────────────

/**
 * Shift grid structure for a case file.
 */
export const MAX_SHIFTS = 12;

/**
 * Create a case file shift entry.
 * @param {number} shiftNumber
 * @param {string} [period='day']
 * @returns {object}
 */
export function createShiftEntry(shiftNumber, period = 'day') {
  return {
    shift: shiftNumber,
    period,
    events: [],
    resolved: false,
  };
}

/**
 * Initialize a full shift grid.
 * @param {number} totalShifts
 * @returns {object[]}
 */
export function initializeShiftGrid(totalShifts = MAX_SHIFTS) {
  const periods = ['day', 'evening', 'night'];
  const grid = [];
  for (let i = 1; i <= totalShifts; i++) {
    grid.push(createShiftEntry(i, periods[(i - 1) % 3]));
  }
  return grid;
}

// ─── Social Conflict (#44) ────────────────────────────────────

/**
 * NPC disposition levels.
 */
export const DISPOSITIONS = {
  hostile: { key: 'hostile', label: 'NEONRELIC.Social.Hostile', modifier: -3 },
  unfriendly: { key: 'unfriendly', label: 'NEONRELIC.Social.Unfriendly', modifier: -1 },
  neutral: { key: 'neutral', label: 'NEONRELIC.Social.Neutral', modifier: 0 },
  friendly: { key: 'friendly', label: 'NEONRELIC.Social.Friendly', modifier: 1 },
  allied: { key: 'allied', label: 'NEONRELIC.Social.Allied', modifier: 3 },
};

/**
 * Social stunts available when rolling extra successes.
 */
export const SOCIAL_STUNTS = [
  { key: 'shiftDisposition', label: 'NEONRELIC.Social.Stunt.Shift', cost: 1 },
  { key: 'extractInfo', label: 'NEONRELIC.Social.Stunt.Extract', cost: 1 },
  { key: 'createOpening', label: 'NEONRELIC.Social.Stunt.Opening', cost: 2 },
  { key: 'deepRead', label: 'NEONRELIC.Social.Stunt.DeepRead', cost: 2 },
  { key: 'turnWitness', label: 'NEONRELIC.Social.Stunt.Turn', cost: 3 },
];

/**
 * Roll a social interaction (Psychoanalyze or Persuade).
 * @param {Actor} actor
 * @param {string} skill - 'psychoanalyze' or 'persuade'.
 * @param {string} disposition - Key from DISPOSITIONS.
 * @returns {Promise<{successes: number, shifted: boolean}>}
 */
export async function rollSocial(actor, skill, disposition) {
  const emp = actor.system?.attributes?.emp?.value ?? 0;
  const skillVal = actor.system?.skills?.[skill]?.value ?? 0;
  const mod = DISPOSITIONS[disposition]?.modifier ?? 0;
  const pool = Math.max(1, emp + skillVal + mod);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;

  const speaker = ChatMessage.getSpeaker({ actor });
  await ChatMessage.create({
    speaker,
    content: `<div class="social-roll">
      <strong>${game.i18n.localize('NEONRELIC.Social.Roll')}</strong>
      <br>[${results.join(', ')}] = ${successes} ${game.i18n.localize('NEONRELIC.Roll.Successes')}
      <br>${game.i18n.localize('NEONRELIC.Social.Disposition')}: ${game.i18n.localize(DISPOSITIONS[disposition]?.label ?? disposition)}
    </div>`,
  });

  return { successes, shifted: successes >= 2 };
}

// ─── Chase Track (#45) ────────────────────────────────────────

/**
 * Chase positions (5-position track).
 */
export const CHASE_POSITIONS = [
  { position: 1, label: 'NEONRELIC.Chase.Caught' },
  { position: 2, label: 'NEONRELIC.Chase.Close' },
  { position: 3, label: 'NEONRELIC.Chase.Medium' },
  { position: 4, label: 'NEONRELIC.Chase.Far' },
  { position: 5, label: 'NEONRELIC.Chase.Escaped' },
];

/**
 * Chase maneuvers.
 */
export const CHASE_MANEUVERS = {
  accelerate: { key: 'accelerate', label: 'NEONRELIC.Chase.Accelerate', skill: 'drive', shift: 1 },
  brake: { key: 'brake', label: 'NEONRELIC.Chase.Brake', skill: 'drive', shift: -1 },
  shortcut: { key: 'shortcut', label: 'NEONRELIC.Chase.Shortcut', skill: 'investigate', shift: 2 },
  block: { key: 'block', label: 'NEONRELIC.Chase.Block', skill: 'drive', shift: 0 },
};

/**
 * Resolve a chase maneuver.
 * @param {Actor} actor
 * @param {string} maneuverKey - Key from CHASE_MANEUVERS.
 * @param {number} currentPosition
 * @returns {Promise<{newPosition: number, success: boolean}>}
 */
export async function resolveChaseManeuver(actor, maneuverKey, currentPosition) {
  const maneuver = CHASE_MANEUVERS[maneuverKey];
  if (!maneuver) return { newPosition: currentPosition, success: false };

  const skillVal = actor.system?.skills?.[maneuver.skill]?.value ?? 0;
  const attrKey = actor.system?.skills?.[maneuver.skill]?.attribute ?? 'agi';
  const attrVal = actor.system?.attributes?.[attrKey]?.value ?? 0;
  const pool = Math.max(1, attrVal + skillVal);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;
  const success = successes >= 1;

  const shift = success ? maneuver.shift : 0;
  const newPosition = Math.max(1, Math.min(5, currentPosition + shift));

  const speaker = ChatMessage.getSpeaker({ actor });
  await ChatMessage.create({
    speaker,
    content: `<div class="chase-maneuver">
      <strong>${game.i18n.localize(maneuver.label)}</strong>
      <br>[${results.join(', ')}] = ${successes}
      <br>${game.i18n.localize('NEONRELIC.Chase.Position')}: ${newPosition}/5
    </div>`,
  });

  return { newPosition, success };
}

// ─── Tail Detection (#46) ──────────────────────────────────────

/**
 * Road Event table (d6).
 */
export const ROAD_EVENTS = [
  { roll: 1, result: 'NEONRELIC.Travel.Road.Breakdown', effect: 'Vehicle problem — roll breakdown check.' },
  { roll: 2, result: 'NEONRELIC.Travel.Road.Detour', effect: 'Road blocked, must detour. Lose 1 shift.' },
  { roll: 3, result: 'NEONRELIC.Travel.Road.Encounter', effect: 'Encounter with locals — social check.' },
  { roll: 4, result: 'NEONRELIC.Travel.Road.Weather', effect: 'Bad weather. -1 to all Drive rolls this shift.' },
  { roll: 5, result: 'NEONRELIC.Travel.Road.Shortcut', effect: 'Shortcut found. Save half a shift.' },
  { roll: 6, result: 'NEONRELIC.Travel.Road.Tail', effect: 'Tail detected. Begin chase or evasion.' },
];

/**
 * Roll tail detection.
 * @param {Actor} actor
 * @returns {Promise<{detected: boolean, successes: number}>}
 */
export async function rollTailDetection(actor) {
  const wit = actor.system?.attributes?.wit?.value ?? 0;
  const investigate = actor.system?.skills?.investigate?.value ?? 0;
  const pool = Math.max(1, wit + investigate);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;
  const detected = successes >= 1;

  const speaker = ChatMessage.getSpeaker({ actor });
  await ChatMessage.create({
    speaker,
    content: `<div class="tail-detection">
      <strong>${game.i18n.localize('NEONRELIC.Travel.TailCheck')}</strong>
      <br>[${results.join(', ')}] = ${successes}
      <br>${detected ? game.i18n.localize('NEONRELIC.Travel.TailDetected') : game.i18n.localize('NEONRELIC.Travel.NoTail')}
    </div>`,
  });

  return { detected, successes };
}

/**
 * Attempt tail loss.
 * @param {Actor} actor
 * @returns {Promise<{lost: boolean, successes: number}>}
 */
export async function attemptTailLoss(actor) {
  const agi = actor.system?.attributes?.agi?.value ?? 0;
  const drive = actor.system?.skills?.drive?.value ?? 0;
  const pool = Math.max(1, agi + drive);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const successes = results.filter(r => r === 6).length;
  const lost = successes >= 2;

  const speaker = ChatMessage.getSpeaker({ actor });
  await ChatMessage.create({
    speaker,
    content: `<div class="tail-loss">
      <strong>${game.i18n.localize('NEONRELIC.Travel.TailLoss')}</strong>
      <br>[${results.join(', ')}] = ${successes}
      <br>${lost ? game.i18n.localize('NEONRELIC.Travel.TailLost') : game.i18n.localize('NEONRELIC.Travel.TailPersists')}
    </div>`,
  });

  return { lost, successes };
}

// ─── Travel System (#47) ──────────────────────────────────────

/**
 * Route types with travel modifiers.
 */
export const ROUTE_TYPES = {
  highway: { key: 'highway', label: 'NEONRELIC.Travel.Route.Highway', shiftsModifier: 0, eventChance: 1 },
  backroad: { key: 'backroad', label: 'NEONRELIC.Travel.Route.Backroad', shiftsModifier: 1, eventChance: 2 },
  offroad: { key: 'offroad', label: 'NEONRELIC.Travel.Route.Offroad', shiftsModifier: 2, eventChance: 3 },
  urban: { key: 'urban', label: 'NEONRELIC.Travel.Route.Urban', shiftsModifier: 0, eventChance: 2 },
};

/**
 * Atmospheric conditions affecting travel.
 */
export const WEATHER_CONDITIONS = {
  clear: { key: 'clear', label: 'NEONRELIC.Travel.Weather.Clear', modifier: 0 },
  rain: { key: 'rain', label: 'NEONRELIC.Travel.Weather.Rain', modifier: -1 },
  fog: { key: 'fog', label: 'NEONRELIC.Travel.Weather.Fog', modifier: -2 },
  storm: { key: 'storm', label: 'NEONRELIC.Travel.Weather.Storm', modifier: -3 },
};

/**
 * Roll for road events during travel.
 * @param {string} routeType - Key from ROUTE_TYPES.
 * @returns {Promise<{eventOccurred: boolean, event: object|null}>}
 */
export async function rollRoadEvent(routeType) {
  const route = ROUTE_TYPES[routeType] ?? ROUTE_TYPES.highway;

  // Event chance: roll d6, event occurs if result <= eventChance
  const chanceRoll = new Roll('1d6');
  await chanceRoll.evaluate();
  const eventOccurred = chanceRoll.total <= route.eventChance;

  let event = null;
  if (eventOccurred) {
    const eventRoll = new Roll('1d6');
    await eventRoll.evaluate();
    event = ROAD_EVENTS[eventRoll.total - 1];

    await ChatMessage.create({
      content: `<div class="road-event">
        <strong>${game.i18n.localize('NEONRELIC.Travel.RoadEvent')}</strong>
        <br>${game.i18n.localize(event.result)}
        <br><em>${event.effect}</em>
      </div>`,
    });
  }

  return { eventOccurred, event };
}

// ─── Mob Combat (#48) ─────────────────────────────────────────

/**
 * Calculate mob attack pool.
 * Mobs use a shared pool with bonus dice per extra member.
 * @param {Actor} mobActor
 * @returns {{pool: number, bonusDice: number}}
 */
export function getMobAttackPool(mobActor) {
  const basePool = mobActor.system?.attackPool ?? 4;
  const memberCount = mobActor.system?.memberCount ?? 1;
  const bonusDice = Math.max(0, memberCount - 1);
  const pool = basePool + bonusDice;
  return { pool, bonusDice };
}

/**
 * Reduce mob members when damage is taken.
 * @param {Actor} mobActor
 * @param {number} casualties
 * @returns {Promise<{newCount: number, eliminated: boolean}>}
 */
export async function reduceMobMembers(mobActor, casualties) {
  const currentCount = mobActor.system?.memberCount ?? 1;
  const newCount = Math.max(0, currentCount - casualties);
  const eliminated = newCount <= 0;

  await mobActor.update({ 'system.memberCount': newCount });

  if (eliminated) {
    const speaker = ChatMessage.getSpeaker({ actor: mobActor });
    await ChatMessage.create({
      speaker,
      content: `<div class="mob-eliminated">
        <strong>${mobActor.name}</strong>: ${game.i18n.localize('NEONRELIC.Mob.Eliminated')}
      </div>`,
    });
  }

  return { newCount, eliminated };
}
