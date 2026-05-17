/**
 * Handlebars helpers and template partial registration for Neon Relic.
 * @module system/handlebars
 */

/**
 * Register all custom Handlebars helpers.
 */
export function registerHandlebarsHelpers() {
  // String helpers
  Handlebars.registerHelper('concat', (a, b) => `${a}${b}`);

  // Comparison helpers
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('neq', (a, b) => a !== b);
  Handlebars.registerHelper('gt', (a, b) => a > b);
  Handlebars.registerHelper('gte', (a, b) => a >= b);
  Handlebars.registerHelper('lt', (a, b) => a < b);
  Handlebars.registerHelper('lte', (a, b) => a <= b);

  // Logical helpers
  Handlebars.registerHelper('or', (...args) => {
    // Remove the Handlebars options object (last argument)
    args.pop();
    return args.some(Boolean);
  });
  Handlebars.registerHelper('and', (...args) => {
    args.pop();
    return args.every(Boolean);
  });

  // Iteration helpers
  Handlebars.registerHelper('times', (n, block) => {
    let result = '';
    for (let i = 0; i < n; i++) {
      result += block.fn(i);
    }
    return result;
  });

  Handlebars.registerHelper('range', (start, end) => {
    const arr = [];
    for (let i = start; i <= end; i++) {
      arr.push(i);
    }
    return arr;
  });

  // Game mechanic helpers
  Handlebars.registerHelper('dieIcon', dieStep => {
    const icons = {
      4: 'fa-dice-d4',
      6: 'fa-dice-d6',
      8: 'fa-dice-d8',
      10: 'fa-dice-d10',
      12: 'fa-dice-d12',
    };
    return icons[dieStep] || 'fa-dice-d6';
  });

  Handlebars.registerHelper('corruptionStage', value => {
    if (value <= 0) return game.i18n.localize('NEONRELIC.CorruptionStage.Clean');
    if (value <= 3) return game.i18n.localize('NEONRELIC.CorruptionStage.Touched');
    if (value <= 6) return game.i18n.localize('NEONRELIC.CorruptionStage.Marked');
    if (value <= 9) return game.i18n.localize('NEONRELIC.CorruptionStage.Consumed');
    return game.i18n.localize('NEONRELIC.CorruptionStage.Lost');
  });

  Handlebars.registerHelper('attributeBar', (current, max) => {
    if (!max || max <= 0) return 0;
    return Math.clamp((current / max) * 100, 0, 100);
  });

  // Localization helpers
  Handlebars.registerHelper('localize', key => game.i18n.localize(key));
  Handlebars.registerHelper('localizeFormat', (key, data) => game.i18n.format(key, data));

  // Form helpers
  Handlebars.registerHelper('checked', value => (value ? 'checked' : ''));
  Handlebars.registerHelper('selected', (a, b) => (a === b ? 'selected' : ''));
  Handlebars.registerHelper('disabled', value => (value ? 'disabled' : ''));

  // HTML enrichment
  Handlebars.registerHelper('enrichHTML', text => {
    return TextEditor.enrichHTML(text, { async: false });
  });
}

/**
 * Preload shared Handlebars template partials.
 * @returns {Promise}
 */
export async function preloadHandlebarsTemplates() {
  const templatePaths = [
    'systems/neon-relic/templates/partials/attribute-box.hbs',
    'systems/neon-relic/templates/partials/skill-row.hbs',
    'systems/neon-relic/templates/partials/resource-die.hbs',
    'systems/neon-relic/templates/partials/corruption-track.hbs',
    'systems/neon-relic/templates/partials/condition-badge.hbs',
    'systems/neon-relic/templates/partials/item-row.hbs',
    'systems/neon-relic/templates/partials/roll-button.hbs',
    'systems/neon-relic/templates/item/item-header.hbs',
    'systems/neon-relic/templates/item/item-body.hbs',
    'systems/neon-relic/templates/item/weapon.hbs',
    'systems/neon-relic/templates/item/armor.hbs',
    'systems/neon-relic/templates/item/gear.hbs',
    'systems/neon-relic/templates/item/consumable.hbs',
    'systems/neon-relic/templates/item/artifact.hbs',
    'systems/neon-relic/templates/item/talent.hbs',
    'systems/neon-relic/templates/item/criticalInjury.hbs',
    'systems/neon-relic/templates/item/anchor.hbs',
    'systems/neon-relic/templates/item/darkSecret.hbs',
    'systems/neon-relic/templates/item/upgrade.hbs',
    'systems/neon-relic/templates/item/location.hbs',
    'systems/neon-relic/templates/actor/agent/agent-header.hbs',
    'systems/neon-relic/templates/actor/agent/agent-summary.hbs',
    'systems/neon-relic/templates/actor/agent/agent-attributes.hbs',
    'systems/neon-relic/templates/actor/agent/agent-combat.hbs',
    'systems/neon-relic/templates/actor/agent/agent-gear.hbs',
    'systems/neon-relic/templates/actor/agent/agent-talents.hbs',
    'systems/neon-relic/templates/actor/agent/agent-corruption.hbs',
    'systems/neon-relic/templates/actor/agent/agent-biography.hbs',
    'systems/neon-relic/templates/actor/npc/npc-header.hbs',
    'systems/neon-relic/templates/actor/npc/npc-stats.hbs',
    'systems/neon-relic/templates/actor/npc/npc-entity.hbs',
    'systems/neon-relic/templates/actor/npc/npc-card.hbs',
  ];
  return loadTemplates(templatePaths);
}
