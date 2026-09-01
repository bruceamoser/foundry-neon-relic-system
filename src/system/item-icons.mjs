/**
 * Default icon per item type — every item type gets a unique system icon.
 * Kept dependency-free so it can be used by the build pipeline (gulp) as well
 * as the runtime item document.
 * @module system/item-icons
 */
export const ITEM_DEFAULT_ICONS = {
  weapon: 'systems/neon-relic/assets/icons/weapon-default.svg',
  armor: 'systems/neon-relic/assets/icons/armor-default.svg',
  gear: 'systems/neon-relic/assets/icons/gear-default.svg',
  talent: 'systems/neon-relic/assets/icons/talent-default.svg',
  artifact: 'systems/neon-relic/assets/icons/artifact-default.svg',
  upgrade: 'systems/neon-relic/assets/icons/facility-default.svg',
  consumable: 'systems/neon-relic/assets/icons/consumable-default.svg',
  criticalInjury: 'systems/neon-relic/assets/icons/critical-injury-default.svg',
  anchor: 'systems/neon-relic/assets/icons/anchor-default.svg',
  darkSecret: 'systems/neon-relic/assets/icons/dark-secret-default.svg',
  location: 'systems/neon-relic/assets/icons/location-default.svg',
  informationCard: 'systems/neon-relic/assets/icons/information-card-default.svg',
  playerCaseBrief: 'systems/neon-relic/assets/icons/player-case-brief-default.svg',
  daCaseBrief: 'systems/neon-relic/assets/icons/da-case-brief-default.svg',
  subdivision: 'systems/neon-relic/assets/icons/subdivision-default.svg',
  organization: 'systems/neon-relic/assets/icons/organization-default.svg',
  relicSheet: 'systems/neon-relic/assets/icons/relic-sheet-default.svg',
};

/**
 * Generic/default images Foundry assigns when no custom image is given.
 * Used to detect items that should have a per-type icon applied.
 */
export const GENERIC_ICONS = new Set(['', 'icons/svg/mystery-man.svg', 'icons/svg/item-bag.svg']);

/**
 * Determine whether an item image is a generic Foundry default (rather than a
 * system asset or a deliberately chosen custom image). Any empty image or a
 * core `icons/...` image is treated as generic.
 * @param {string|null|undefined} img
 * @returns {boolean}
 */
export function isGenericIcon(img) {
  return !img || img.startsWith('icons/');
}
