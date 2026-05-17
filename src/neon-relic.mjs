/**
 * Neon Relic — Foundry VTT System
 * An occult investigation TTRPG set in an alternate 1980s.
 * Built on the Year Zero Engine (dice-pool variant).
 */

import { registerHandlebarsHelpers, preloadHandlebarsTemplates } from './system/handlebars.mjs';

Hooks.once('init', () => {
  console.log('neon-relic | Initializing Neon Relic system');

  // Register custom Handlebars helpers
  registerHandlebarsHelpers();

  // Preload shared template partials
  preloadHandlebarsTemplates();
});

Hooks.once('ready', () => {
  console.log('neon-relic | Neon Relic system ready');
});
