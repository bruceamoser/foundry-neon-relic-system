/**
 * Combat mechanics — melee maneuvers, cover, zones, damage routing,
 * ranged modifiers, dodge, and vehicle combat rules.
 * @module components/combat-mechanics
 */

// ─── Melee Maneuvers (#88) ─────────────────────────────────────

/**
 * Melee maneuver definitions.
 */
export const MELEE_MANEUVERS = {
  grapple: {
    key: 'grapple',
    label: 'NEONRELIC.Combat.Maneuver.Grapple',
    skill: 'brawl',
    opposed: 'brawl',
    effect: 'Target cannot move or act until grapple broken. Opposed Brawl/Force to escape.',
  },
  shove: {
    key: 'shove',
    label: 'NEONRELIC.Combat.Maneuver.Shove',
    skill: 'brawl',
    opposed: 'brawl',
    effect: 'Push target 1 zone. If into hazard, target takes appropriate damage.',
  },
  disarm: {
    key: 'disarm',
    label: 'NEONRELIC.Combat.Maneuver.Disarm',
    skill: 'brawl',
    opposed: 'brawl',
    effect: 'Target drops held weapon. Item lands in same zone.',
  },
  feint: {
    key: 'feint',
    label: 'NEONRELIC.Combat.Maneuver.Feint',
    skill: 'brawl',
    opposed: 'investigate',
    effect: 'On success, next attack against target gains +2 dice.',
  },
};

// ─── Cover System (#89) ────────────────────────────────────────

/**
 * Cover types with AR bonuses.
 */
export const COVER_TYPES = {
  none: { key: 'none', label: 'NEONRELIC.Combat.CoverType.None', arBonus: 0 },
  soft: { key: 'soft', label: 'NEONRELIC.Combat.CoverType.Soft', arBonus: 2 },
  hard: { key: 'hard', label: 'NEONRELIC.Combat.CoverType.Hard', arBonus: 4 },
};

/**
 * Get the effective AR for an actor considering cover.
 * @param {Actor} actor
 * @param {string} coverType - Key from COVER_TYPES.
 * @returns {number} Total AR (base + cover).
 */
export function getEffectiveAR(actor, coverType) {
  const baseAR = actor.system?.armorRating ?? 0;
  const coverBonus = COVER_TYPES[coverType]?.arBonus ?? 0;
  return baseAR + coverBonus;
}

// ─── Zone Features (#90) ───────────────────────────────────────

/**
 * Zone feature definitions affecting combat.
 */
export const ZONE_FEATURES = {
  cramped: {
    key: 'cramped',
    label: 'NEONRELIC.Combat.Zone.Cramped',
    effect: 'No ranged attacks beyond this zone. Melee only.',
  },
  rough: {
    key: 'rough',
    label: 'NEONRELIC.Combat.Zone.Rough',
    effect: 'Moving through costs an extra Fast Action.',
  },
  dark: {
    key: 'dark',
    label: 'NEONRELIC.Combat.Zone.Dark',
    effect: '-2 dice to ranged attacks, -1 to Investigate.',
  },
  open: {
    key: 'open',
    label: 'NEONRELIC.Combat.Zone.Open',
    effect: 'No cover available. Cannot take cover action.',
  },
  elevated: {
    key: 'elevated',
    label: 'NEONRELIC.Combat.Zone.Elevated',
    effect: '+2 to initiative card. +1 die to ranged attacks against lower zones.',
  },
};

/**
 * Get zone modifiers for a given set of features.
 * @param {string[]} features - Array of zone feature keys.
 * @returns {{rangedMod: number, meleeMod: number, moveCost: number, initiativeBonus: number}}
 */
export function getZoneModifiers(features) {
  let rangedMod = 0;
  const meleeMod = 0;
  let moveCost = 0;
  let initiativeBonus = 0;

  for (const f of features) {
    switch (f) {
      case 'dark':
        rangedMod -= 2;
        break;
      case 'elevated':
        rangedMod += 1;
        initiativeBonus += 2;
        break;
      case 'rough':
        moveCost += 1;
        break;
    }
  }

  return { rangedMod, meleeMod, moveCost, initiativeBonus };
}

// ─── Damage Type Routing (#91) ─────────────────────────────────

/**
 * Damage types and their target attributes.
 */
export const DAMAGE_TYPES = {
  physical: { key: 'physical', label: 'NEONRELIC.DamageType.Physical', attribute: 'str' },
  hobbling: { key: 'hobbling', label: 'NEONRELIC.DamageType.Hobbling', attribute: 'agi' },
  horror: { key: 'horror', label: 'NEONRELIC.DamageType.Horror', attribute: 'wit' },
  trauma: { key: 'trauma', label: 'NEONRELIC.DamageType.Trauma', attribute: 'emp' },
};

/**
 * Apply damage to an actor, routing to the correct attribute.
 * @param {Actor} actor
 * @param {number} amount - Raw damage amount.
 * @param {string} damageType - Key from DAMAGE_TYPES.
 * @param {number} [armorReduction=0] - AR already applied.
 * @returns {Promise<{finalDamage: number, attribute: string, newValue: number, broken: boolean}>}
 */
export async function applyTypedDamage(actor, amount, damageType, armorReduction = 0) {
  const type = DAMAGE_TYPES[damageType] ?? DAMAGE_TYPES.physical;
  const attr = type.attribute;
  const currentValue = actor.system?.attributes?.[attr]?.value ?? 0;

  const finalDamage = Math.max(0, amount - armorReduction);
  const newValue = Math.max(0, currentValue - finalDamage);
  const broken = newValue === 0;

  await actor.update({ [`system.attributes.${attr}.value`]: newValue });

  if (broken) {
    await actor.update({ 'system.conditions.broken': true });
  }

  return { finalDamage, attribute: attr, newValue, broken };
}

// ─── Ranged Attack Modifiers (#93) ─────────────────────────────

/**
 * Range bands and their modifiers.
 */
export const RANGE_BANDS = {
  engaged: { key: 'engaged', label: 'NEONRELIC.Combat.Range.Engaged', modifier: -2 },
  short: { key: 'short', label: 'NEONRELIC.Combat.Range.Short', modifier: 0 },
  medium: { key: 'medium', label: 'NEONRELIC.Combat.Range.Medium', modifier: -1 },
  long: { key: 'long', label: 'NEONRELIC.Combat.Range.Long', modifier: -2 },
  extreme: { key: 'extreme', label: 'NEONRELIC.Combat.Range.Extreme', modifier: -3 },
};

/**
 * Calculate total ranged attack modifier.
 * @param {object} params
 * @param {string} params.range - Range band key.
 * @param {boolean} [params.elevated=false] - Attacker is elevated.
 * @param {boolean} [params.inChase=false] - During a chase.
 * @param {boolean} [params.darkZone=false] - Target in dark zone.
 * @returns {number} Total modifier to dice pool.
 */
export function getRangedModifier({ range, elevated = false, inChase = false, darkZone = false }) {
  let mod = RANGE_BANDS[range]?.modifier ?? 0;
  if (elevated) mod += 1;
  if (inChase) mod -= 1;
  if (darkZone) mod -= 2;
  return mod;
}

// ─── Dodge Mechanic (#94) ──────────────────────────────────────

/**
 * Perform a dodge (Reactive Action).
 * Defender rolls AGI. Each success negates one attacker success.
 * Defender wins ties (if equal successes, attack is dodged).
 * @param {Actor} defender
 * @param {number} attackSuccesses - Attacker's successes to beat.
 * @returns {Promise<{dodged: boolean, dodgeSuccesses: number, remainingDamage: number}>}
 */
export async function performDodge(defender, attackSuccesses) {
  const agi = defender.system?.attributes?.agi?.value ?? 0;
  const pool = Math.max(1, agi);

  const roll = new Roll(`${pool}d6`);
  await roll.evaluate();
  const results = roll.dice[0]?.results?.map(r => r.result) ?? [];
  const dodgeSuccesses = results.filter(r => r === 6).length;

  // Defender wins ties
  const dodged = dodgeSuccesses >= attackSuccesses;
  const remainingDamage = dodged ? 0 : Math.max(0, attackSuccesses - dodgeSuccesses);

  const speaker = ChatMessage.getSpeaker({ actor: defender });
  await ChatMessage.create({
    speaker,
    content: `<div class="dodge-result">
      <strong>${game.i18n.localize('NEONRELIC.Combat.Dodge')}</strong>:
      [${results.join(', ')}] = ${dodgeSuccesses} ${game.i18n.localize('NEONRELIC.Roll.Successes')}
      ${dodged ? `<br><em>${game.i18n.localize('NEONRELIC.Combat.DodgeSuccess')}</em>` : `<br>${game.i18n.localize('NEONRELIC.Combat.DodgeFail')}`}
    </div>`,
  });

  return { dodged, dodgeSuccesses, remainingDamage };
}

// ─── Vehicle Combat (#92) ──────────────────────────────────────

/**
 * Apply damage to a vehicle, accounting for vehicle AR.
 * Damage reduces reliability first, then causes wear problems.
 * @param {Actor} vehicle
 * @param {number} damage
 * @returns {Promise<{finalDamage: number, newWear: number, problem: boolean, stopped: boolean}>}
 */
export async function applyVehicleDamage(vehicle, damage) {
  const ar = vehicle.system?.ar ?? 0;
  const finalDamage = Math.max(0, damage - ar);

  if (finalDamage <= 0) return { finalDamage: 0, newWear: vehicle.system?.wear ?? 0, problem: false, stopped: false };

  const currentWear = vehicle.system?.wear ?? 0;
  const newWear = currentWear + finalDamage;

  const problemThreshold = vehicle.system?.problemThreshold ?? 3;
  const stopsThreshold = vehicle.system?.stopsThreshold ?? 6;
  const problem = newWear >= problemThreshold;
  const stopped = newWear >= stopsThreshold;

  await vehicle.update({ 'system.wear': newWear });

  const speaker = ChatMessage.getSpeaker({ actor: vehicle });
  let content = `<div class="vehicle-damage">
    <strong>${vehicle.name}</strong>: ${game.i18n.localize('NEONRELIC.Combat.VehicleDamage')} ${finalDamage}
    <br>${game.i18n.localize('NEONRELIC.Vehicle.Wear')}: ${newWear}`;

  if (stopped) {
    content += `<br><strong>${game.i18n.localize('NEONRELIC.Vehicle.Stopped')}</strong>`;
  } else if (problem) {
    content += `<br><em>${game.i18n.localize('NEONRELIC.Vehicle.Problem')}</em>`;
  }

  content += '</div>';
  await ChatMessage.create({ speaker, content });

  return { finalDamage, newWear, problem, stopped };
}

/**
 * Roll vehicle breakdown check on problem threshold.
 * @param {Actor} vehicle
 * @returns {Promise<{breakdown: boolean, roll: number}>}
 */
export async function rollBreakdown(vehicle) {
  const reliability = vehicle.system?.reliability ?? 6;
  const roll = new Roll('1d6');
  await roll.evaluate();
  const breakdown = roll.total > reliability;

  const speaker = ChatMessage.getSpeaker({ actor: vehicle });
  await ChatMessage.create({
    speaker,
    content: `<div class="vehicle-breakdown">
      <strong>${vehicle.name}</strong>: ${game.i18n.localize('NEONRELIC.Combat.BreakdownCheck')}
      d6 = ${roll.total} vs Reliability ${reliability}
      ${breakdown ? `<br><strong>${game.i18n.localize('NEONRELIC.Combat.BreakdownOccurred')}</strong>` : ''}
    </div>`,
  });

  return { breakdown, roll: roll.total };
}
