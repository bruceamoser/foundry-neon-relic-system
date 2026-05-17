/**
 * Neon Relic — Foundry VTT System
 * An occult investigation TTRPG set in an alternate 1980s.
 * Built on the Year Zero Engine (dice-pool variant).
 */

import { NEON_RELIC } from './system/config.mjs';
import { registerHandlebarsHelpers, preloadHandlebarsTemplates } from './system/handlebars.mjs';
import {
  AgentDataModel,
  NPCDataModel,
  HeadquartersDataModel,
  MobDataModel,
  VehicleDataModel,
} from './data/actor-models.mjs';

Hooks.once('init', () => {
  console.log('neon-relic | Initializing Neon Relic system');

  // Store system config on global CONFIG
  CONFIG.NEON_RELIC = NEON_RELIC;

  // Register data models
  CONFIG.Actor.dataModels.agent = AgentDataModel;
  CONFIG.Actor.dataModels.npc = NPCDataModel;
  CONFIG.Actor.dataModels.headquarters = HeadquartersDataModel;
  CONFIG.Actor.dataModels.mob = MobDataModel;
  CONFIG.Actor.dataModels.vehicle = VehicleDataModel;

  // Register custom Handlebars helpers
  registerHandlebarsHelpers();

  // Preload shared template partials
  preloadHandlebarsTemplates();
});

Hooks.once('ready', () => {
  console.log('neon-relic | Neon Relic system ready');
});
