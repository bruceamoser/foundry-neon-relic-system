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
import {
  ArtifactDataModel,
  WeaponDataModel,
  ArmorDataModel,
  GearDataModel,
  ConsumableDataModel,
  TalentDataModel,
  CriticalInjuryDataModel,
  AnchorDataModel,
  DarkSecretDataModel,
  UpgradeDataModel,
  LocationDataModel,
} from './data/item-models.mjs';

Hooks.once('init', () => {
  console.log('neon-relic | Initializing Neon Relic system');

  // Store system config on global CONFIG
  CONFIG.NEON_RELIC = NEON_RELIC;

  // Register actor data models
  CONFIG.Actor.dataModels.agent = AgentDataModel;
  CONFIG.Actor.dataModels.npc = NPCDataModel;
  CONFIG.Actor.dataModels.headquarters = HeadquartersDataModel;
  CONFIG.Actor.dataModels.mob = MobDataModel;
  CONFIG.Actor.dataModels.vehicle = VehicleDataModel;

  // Register item data models
  CONFIG.Item.dataModels.artifact = ArtifactDataModel;
  CONFIG.Item.dataModels.weapon = WeaponDataModel;
  CONFIG.Item.dataModels.armor = ArmorDataModel;
  CONFIG.Item.dataModels.gear = GearDataModel;
  CONFIG.Item.dataModels.consumable = ConsumableDataModel;
  CONFIG.Item.dataModels.talent = TalentDataModel;
  CONFIG.Item.dataModels.criticalInjury = CriticalInjuryDataModel;
  CONFIG.Item.dataModels.anchor = AnchorDataModel;
  CONFIG.Item.dataModels.darkSecret = DarkSecretDataModel;
  CONFIG.Item.dataModels.upgrade = UpgradeDataModel;
  CONFIG.Item.dataModels.location = LocationDataModel;

  // Register custom Handlebars helpers
  registerHandlebarsHelpers();

  // Preload shared template partials
  preloadHandlebarsTemplates();
});

Hooks.once('ready', () => {
  console.log('neon-relic | Neon Relic system ready');
});
