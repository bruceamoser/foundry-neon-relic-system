/**
 * Token default configuration for all actor types.
 * Applied when creating new tokens on the canvas.
 */
export function configureTokenDefaults() {
  // Agent tokens — player characters
  CONFIG.Actor.dataModels.agent.schema.prototypeToken = {
    displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
    displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    bar1: { attribute: 'attributes.str.value' },
    bar2: { attribute: 'corruption.value' },
    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    actorLink: true,
    sight: { enabled: true, range: 30 },
  };

  // NPC tokens — non-player characters
  CONFIG.Actor.dataModels.npc.schema.prototypeToken = {
    displayName: CONST.TOKEN_DISPLAY_MODES.OWNER,
    displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    bar1: { attribute: 'attributes.str.value' },
    disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
    actorLink: false,
  };

  // Mob tokens — groups of combatants
  CONFIG.Actor.dataModels.mob.schema.prototypeToken = {
    displayName: CONST.TOKEN_DISPLAY_MODES.OWNER,
    displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    bar1: { attribute: 'members' },
    disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
    actorLink: false,
  };

  // Vehicle tokens
  CONFIG.Actor.dataModels.vehicle.schema.prototypeToken = {
    displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
    displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    bar1: { attribute: 'armorRating' },
    disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
    actorLink: false,
    width: 2,
    height: 2,
  };

  // Headquarters tokens
  CONFIG.Actor.dataModels.headquarters.schema.prototypeToken = {
    displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
    displayBars: CONST.TOKEN_DISPLAY_MODES.NONE,
    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    actorLink: true,
    width: 3,
    height: 3,
  };
}
