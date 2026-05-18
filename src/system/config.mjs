/**
 * System configuration constants for Neon Relic.
 * @module system/config
 */

export const NEON_RELIC = {};

/**
 * Attributes and their abbreviations.
 */
NEON_RELIC.attributes = {
  str: 'NEONRELIC.Attribute.Str',
  agi: 'NEONRELIC.Attribute.Agi',
  wit: 'NEONRELIC.Attribute.Wit',
  emp: 'NEONRELIC.Attribute.Emp',
};

/**
 * Skills and their linked attributes.
 */
NEON_RELIC.skills = {
  force: { label: 'NEONRELIC.Skill.Force', attribute: 'str' },
  endure: { label: 'NEONRELIC.Skill.Endure', attribute: 'str' },
  brawl: { label: 'NEONRELIC.Skill.Brawl', attribute: 'str' },
  firearms: { label: 'NEONRELIC.Skill.Firearms', attribute: 'agi' },
  sleightOfHand: { label: 'NEONRELIC.Skill.SleightOfHand', attribute: 'agi' },
  sneak: { label: 'NEONRELIC.Skill.Sneak', attribute: 'agi' },
  tech: { label: 'NEONRELIC.Skill.Tech', attribute: 'wit' },
  investigate: { label: 'NEONRELIC.Skill.Investigate', attribute: 'wit' },
  lore: { label: 'NEONRELIC.Skill.Lore', attribute: 'wit' },
  psychoanalyze: { label: 'NEONRELIC.Skill.Psychoanalyze', attribute: 'emp' },
  manipulate: { label: 'NEONRELIC.Skill.Manipulate', attribute: 'emp' },
  command: { label: 'NEONRELIC.Skill.Command', attribute: 'emp' },
  heal: { label: 'NEONRELIC.Skill.Heal', attribute: 'wit' },
};

/**
 * Divisions within The Verdant Covenant.
 */
NEON_RELIC.divisions = {
  wayfinder: 'NEONRELIC.Division.wayfinder',
  recovery: 'NEONRELIC.Division.recovery',
  keep: 'NEONRELIC.Division.keep',
};

/**
 * Sex options for agent creation.
 */
NEON_RELIC.sexOptions = {
  male: 'NEONRELIC.Sex.Male',
  female: 'NEONRELIC.Sex.Female',
  other: 'NEONRELIC.Sex.Other',
};

/**
 * Age groups for agent creation.
 */
NEON_RELIC.ageGroups = {
  young: 'NEONRELIC.AgeGroup.Young',
  experienced: 'NEONRELIC.AgeGroup.Experienced',
  senior: 'NEONRELIC.AgeGroup.Senior',
};

/**
 * Damage types and their target attributes.
 */
NEON_RELIC.damageTypes = {
  physical: { label: 'NEONRELIC.DamageType.Physical', attribute: 'str' },
  exhaustion: { label: 'NEONRELIC.DamageType.Exhaustion', attribute: 'agi' },
  horror: { label: 'NEONRELIC.DamageType.Horror', attribute: 'wit' },
  trauma: { label: 'NEONRELIC.DamageType.Trauma', attribute: 'emp' },
};

/**
 * Resource die steps (d4 through d12).
 */
NEON_RELIC.dieSteps = [4, 6, 8, 10, 12];

/**
 * Corruption stage thresholds.
 */
NEON_RELIC.corruptionStages = {
  clean: { min: 0, max: 0, label: 'NEONRELIC.CorruptionStage.Clean' },
  touched: { min: 1, max: 3, label: 'NEONRELIC.CorruptionStage.Touched' },
  marked: { min: 4, max: 6, label: 'NEONRELIC.CorruptionStage.Marked' },
  consumed: { min: 7, max: 9, label: 'NEONRELIC.CorruptionStage.Consumed' },
  lost: { min: 10, max: Infinity, label: 'NEONRELIC.CorruptionStage.Lost' },
};

/**
 * Actor types registered in system.json.
 */
NEON_RELIC.actorTypes = ['agent', 'npc', 'mob', 'vehicle', 'headquarters'];

/**
 * Item types registered in system.json.
 */
NEON_RELIC.itemTypes = [
  'weapon',
  'armor',
  'gear',
  'consumable',
  'artifact',
  'talent',
  'criticalInjury',
  'anchor',
  'darkSecret',
  'upgrade',
  'location',
  'subdivision',
];
