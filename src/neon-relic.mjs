/**
 * Neon Relic — Foundry VTT System
 * An occult investigation TTRPG set in an alternate 1980s.
 * Built on the Year Zero Engine (dice-pool variant).
 */

import { NEON_RELIC } from './system/config.mjs';
import { registerHandlebarsHelpers, preloadHandlebarsTemplates } from './system/handlebars.mjs';
import { NeonRelicActor } from './actor/actor-document.mjs';
import { NeonRelicItem } from './item/item-document.mjs';
import { pushRoll } from './components/roll/roll-handler.mjs';
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
  InformationCardDataModel,
  PlayerCaseBriefDataModel,
  DACaseBriefDataModel,
  SubdivisionDataModel,
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
import { registerWorldSetupSettings, checkWorldSetup } from './system/world-setup.mjs';

Hooks.once('init', () => {
  console.log('neon-relic | Initializing Neon Relic system');

  // Store system config on global CONFIG
  CONFIG.NEON_RELIC = NEON_RELIC;

  // Register system settings
  registerSettings();
  registerMigrationSetting();
  registerWorldSetupSettings();

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
  CONFIG.Item.dataModels.informationCard = InformationCardDataModel;
  CONFIG.Item.dataModels.playerCaseBrief = PlayerCaseBriefDataModel;
  CONFIG.Item.dataModels.daCaseBrief = DACaseBriefDataModel;
  CONFIG.Item.dataModels.subdivision = SubdivisionDataModel;

  // Register custom Handlebars helpers
  registerHandlebarsHelpers();

  // Register item sheets
  foundry.documents.collections.Items.unregisterSheet('core', foundry.applications.sheets.ItemSheetV2);
  foundry.documents.collections.Items.registerSheet('neon-relic', NRItemSheet, {
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Item',
  });

  // Register actor sheets
  foundry.documents.collections.Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);
  foundry.documents.collections.Actors.registerSheet('neon-relic', AgentSheet, {
    types: ['agent'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Agent',
  });
  foundry.documents.collections.Actors.registerSheet('neon-relic', NPCSheet, {
    types: ['npc'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.NPC',
  });
  foundry.documents.collections.Actors.registerSheet('neon-relic', MobSheet, {
    types: ['mob'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Mob',
  });
  foundry.documents.collections.Actors.registerSheet('neon-relic', HeadquartersSheet, {
    types: ['headquarters'],
    makeDefault: true,
    label: 'NEONRELIC.Sheet.Headquarters',
  });
  foundry.documents.collections.Actors.registerSheet('neon-relic', VehicleSheet, {
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

  // Register keybindings and text enrichers
  registerKeybindings();
  registerTextEnrichers();
});

Hooks.on('renderChatMessageHTML', (message, html, _data) => {
  // Handle push roll button clicks in chat cards
  html.querySelectorAll('[data-action="pushRoll"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const actorId = btn.dataset.actorId;
      const attributeKey = btn.dataset.attribute;
      const previousRolls = JSON.parse(btn.dataset.previousRolls || '[]');
      const pool = JSON.parse(btn.dataset.pool || '{}');
      const actor = game.actors.get(actorId);

      if (!actor) {
        ui.notifications.warn('Actor not found for push roll.');
        return;
      }

      // Reconstruct previous result
      const previousResult = {
        successes: previousRolls.filter(r => r === 6).length,
        rolls: previousRolls,
        pool,
        canPush: false,
        isPush: false,
      };

      // Execute the push
      const newResult = await pushRoll(previousResult, actor, attributeKey);

      // Re-render chat card with new result
      const attrConfig = CONFIG.NEON_RELIC?.attributes ?? {};

      // Try to find the original skill from the card header
      const headerEl = html.querySelector('.nr-roll-card__header h3');
      const headerText = headerEl?.textContent ?? '';

      const templateData = {
        actorId,
        attributeLabel: game.i18n.localize(attrConfig[attributeKey] ?? attributeKey),
        skillLabel: '', // derived from header if needed
        baseDice: newResult.baseResults.map(v => ({ value: v, success: v === 6 })),
        skillDice: newResult.skillResults.map(v => ({ value: v, success: v === 6 })),
        gearDice: newResult.gearResults.map(v => ({ value: v, success: v === 6 })),
        successes: newResult.successes,
        difficulty: 0,
        stuntPoints: 0,
        isSuccess: null,
        isFailure: false,
        canPush: false,
        isPush: true,
        notes: '',
        attributeKey,
        previousRolls: JSON.stringify(newResult.rolls),
        poolData: JSON.stringify(newResult.pool),
      };

      // Preserve the original skill label from the card
      // Parse "SkillName (ATTR)" format from the header
      const match = headerText.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        templateData.skillLabel = match[1];
      }

      const CHAT_TEMPLATE = 'systems/neon-relic/templates/roll/roll-chatcard.hbs';
      let newContent;
      try {
        newContent = await foundry.applications.handlebars.renderTemplate(CHAT_TEMPLATE, templateData);
      } catch (err) {
        console.error('neon-relic | Failed to render push roll chat card:', err);
        return;
      }

      await message.update({ content: newContent });
    });
  });
});

Hooks.once('ready', () => {
  console.log('neon-relic | Neon Relic system ready');

  // Register tours (must be in ready hook — Tour reads core settings)
  registerTours();

  // Apply visual theme
  initTheme();

  // Register socket listeners
  registerSocketListeners();

  // Clear session reset flag for new session
  clearSessionResetFlag();

  // Run data migrations if needed
  migrateWorld();

  // Check for first-run world setup
  checkWorldSetup();
});
