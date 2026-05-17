/**
 * Neon Relic — Foundry VTT System
 * An occult investigation TTRPG set in an alternate 1980s.
 * Built on the Year Zero Engine (dice-pool variant).
 */

import { NEON_RELIC } from './system/config.mjs';
import { registerHandlebarsHelpers, preloadHandlebarsTemplates } from './system/handlebars.mjs';
import { NeonRelicActor } from './actor/actor-document.mjs';
import { NeonRelicItem } from './item/item-document.mjs';
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
import { NRItemSheet } from './item/item-sheet.mjs';
import { AgentSheet } from './actor/agent/agent-sheet.mjs';
import { NPCSheet } from './actor/npc/npc-sheet.mjs';
import { MobSheet } from './actor/mob/mob-sheet.mjs';
import { HeadquartersSheet } from './actor/headquarters/hq-sheet.mjs';
import { VehicleSheet } from './actor/vehicle/vehicle-sheet.mjs';
import { NeonRelicCombat } from './combat/combat.mjs';
import { NeonRelicCombatant } from './combat/combatant.mjs';
import { registerSettings, initTheme } from './system/settings.mjs';
import { registerSocketListeners } from './system/sockets.mjs';
import { clearSessionResetFlag } from './system/session-tracker.mjs';
import { configureTokenDefaults } from './system/token-defaults.mjs';
import { registerDiceSoNice } from './integrations/dice-so-nice.mjs';
import { registerYZECombat } from './integrations/yze-combat.mjs';
import { registerItemPiles } from './integrations/item-piles.mjs';
import { registerKeybindings } from './system/keybindings.mjs';
import { registerTours } from './system/tours.mjs';
import { registerTextEnrichers } from './system/enrichers.mjs';
import { registerMigrationSetting, migrateWorld } from './system/migration.mjs';

Hooks.once('init', () => {
  console.log('neon-relic | Initializing Neon Relic system');

  // Store system config on global CONFIG
  CONFIG.NEON_RELIC = NEON_RELIC;

  // Register system settings
  registerSettings();
  registerMigrationSetting();

  // Register document classes
  CONFIG.Actor.documentClass = NeonRelicActor;
  CONFIG.Item.documentClass = NeonRelicItem;
  CONFIG.Combat.documentClass = NeonRelicCombat;
  CONFIG.Combatant.documentClass = NeonRelicCombatant;

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

  // Register item sheets
  Items.unregisterSheet('core', foundry.applications.sheets.ItemSheetV2);
  Items.registerSheet('neon-relic', NRItemSheet, {
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Item',
  });

  // Register actor sheets
  Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);
  Actors.registerSheet('neon-relic', AgentSheet, {
    types: ['agent'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Agent',
  });
  Actors.registerSheet('neon-relic', NPCSheet, {
    types: ['npc'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.NPC',
  });
  Actors.registerSheet('neon-relic', MobSheet, {
    types: ['mob'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Mob',
  });
  Actors.registerSheet('neon-relic', HeadquartersSheet, {
    types: ['headquarters'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Headquarters',
  });
  Actors.registerSheet('neon-relic', VehicleSheet, {
    types: ['vehicle'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Vehicle',
  });

  // Preload shared template partials
  preloadHandlebarsTemplates();

  // Configure token defaults for all actor types
  configureTokenDefaults();

  // Register module integrations
  registerDiceSoNice();
  registerYZECombat();
  registerItemPiles();

  // Register keybindings, tours, and text enrichers
  registerKeybindings();
  registerTours();
  registerTextEnrichers();
});

Hooks.once('ready', () => {
  console.log('neon-relic | Neon Relic system ready');

  // Apply visual theme
  initTheme();

  // Register socket listeners
  registerSocketListeners();

  // Clear session reset flag for new session
  clearSessionResetFlag();

  // Run data migrations if needed
  migrateWorld();
});
