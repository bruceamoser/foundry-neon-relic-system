/**
 * Data models for all actor types in Neon Relic.
 * @module data/actor-models
 */

const { SchemaField, NumberField, StringField, BooleanField, HTMLField, ArrayField, SetField } = foundry.data.fields;

/* ------------------------------------------ */
/*  Helper: Attribute Pair                    */
/* ------------------------------------------ */

function attributeField(initial = 3) {
  return new SchemaField({
    value: new NumberField({ required: true, integer: true, min: 0, initial }),
    max: new NumberField({ required: true, integer: true, min: 0, initial }),
  });
}

/* ------------------------------------------ */
/*  AgentDataModel                            */
/* ------------------------------------------ */

/**
 * TypeDataModel for Agent (player character) actors.
 * @extends foundry.abstract.TypeDataModel
 */
export class AgentDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Core identity
      division: new StringField({ initial: 'recovery', blank: true }),
      subUnit: new StringField({ blank: true }),
      specialty: new StringField({ blank: true }),
      clearanceLevel: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 1 }),
      countryOfOrigin: new StringField({ blank: true }),

      // Attributes
      attributes: new SchemaField({
        str: attributeField(3),
        agi: attributeField(3),
        wit: attributeField(3),
        emp: attributeField(3),
      }),

      // Skills (13 skills, value 0–5)
      skills: new SchemaField({
        force: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        endure: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        brawl: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        firearms: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        sleightOfHand: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        sneak: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        tech: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        investigate: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        lore: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        psychoanalyze: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        manipulate: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        command: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        heal: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
      }),

      // Corruption
      corruption: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        threshold: new NumberField({ required: true, integer: true, min: 0, initial: 14 }),
        sessionHealing: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        healingTagUsed: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        thresholdDeadlineSession: new NumberField({ integer: true, initial: 0 }),
      }),

      // Encumbrance (derived values computed in prepareDerivedData)
      encumbrance: new SchemaField({
        current: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 6 }),
        overloaded: new NumberField({ required: true, integer: true, min: 0, initial: 9 }),
      }),

      // Conditions
      conditions: new SchemaField({
        isBroken: new BooleanField({ initial: false }),
        isDying: new BooleanField({ initial: false }),
        brokenAttribute: new StringField({ blank: true }),
      }),

      // Combat
      initiative: new SchemaField({
        cardValue: new NumberField({ integer: true, min: 1, max: 10, initial: 1 }),
        cardSuit: new StringField({ blank: true }),
      }),
      actions: new SchemaField({
        slow: new BooleanField({ initial: true }),
        fast: new BooleanField({ initial: true }),
      }),

      // Division item status
      divisionItem: new SchemaField({
        active: new BooleanField({ initial: false }),
        usedThisSession: new BooleanField({ initial: false }),
      }),

      // Session tracking
      sessionTracking: new SchemaField({
        anchorUsed: new BooleanField({ initial: false }),
        safeSceneUsed: new BooleanField({ initial: false }),
        conditionedMindUsed: new BooleanField({ initial: false }),
        bracerAbsorbed: new BooleanField({ initial: false }),
      }),

      // Fear tracking — entity types already passed Fear Check against
      knownEntities: new SetField(new StringField()),

      // Description
      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    // Corruption threshold = 10 + EMP max + modifiers from talents/injuries
    let thresholdMod = 0;
    if (this.parent?.items) {
      for (const item of this.parent.items) {
        if (item.type === 'talent' || item.type === 'criticalInjury') {
          thresholdMod += item.system.corruptionThresholdMod ?? 0;
        }
      }
    }
    this.corruption.threshold = 10 + this.attributes.emp.max + thresholdMod;

    // Encumbrance from owned items
    let enc = 0;
    if (this.parent?.items) {
      for (const item of this.parent.items) {
        enc += item.system.encumbrance ?? 0;
      }
    }
    this.encumbrance.current = enc;
    this.encumbrance.max = this.attributes.str.max * 2;
    this.encumbrance.overloaded = this.attributes.str.max * 3;
  }
}

/* ------------------------------------------ */
/*  NPCDataModel                              */
/* ------------------------------------------ */

/**
 * TypeDataModel for NPC actors — including supernatural entities,
 * faction operatives, and civilians.
 * @extends foundry.abstract.TypeDataModel
 */
export class NPCDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Core identity
      tier: new NumberField({ required: true, integer: true, min: 1, max: 4, initial: 1 }),
      description: new HTMLField({ blank: true }),

      // Attributes (value only — NPCs don't track max)
      attributes: new SchemaField({
        str: new NumberField({ required: true, integer: true, min: 0, initial: 3 }),
        agi: new NumberField({ required: true, integer: true, min: 0, initial: 3 }),
        wit: new NumberField({ required: true, integer: true, min: 0, initial: 3 }),
        emp: new NumberField({ required: true, integer: true, min: 0, initial: 3 }),
      }),

      // Skills (sparse — only skills the NPC has)
      skills: new SchemaField({}),

      // Combat
      armorRating: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      fearRating: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      escalatedFearRating: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      initiative: new SchemaField({
        cardValue: new NumberField({ integer: true, min: 1, max: 10, initial: 1 }),
      }),

      // Corruption
      corruptionStage: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
      corruptionExposure: new BooleanField({ initial: false }),

      // Social
      disposition: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 3 }),
      socialImmunities: new SchemaField({}),

      // Damage resistance/immunity
      damageResistance: new SchemaField({}),
      damageImmunity: new SchemaField({}),

      // Supernatural entity fields
      entityAnchor: new StringField({ blank: true }),
      reconstitutionTimer: new NumberField({ integer: true, min: 0, initial: 0 }),
      incorporeal: new BooleanField({ initial: false }),
      zoneLocked: new BooleanField({ initial: false }),
      artifactTetherRange: new NumberField({ integer: true, min: 0, initial: 0 }),
      corruptionCostOnContact: new NumberField({ integer: true, min: 0, initial: 0 }),
      dissolutionMethod: new StringField({ blank: true }),

      // Operations Board card data
      organization: new StringField({ blank: true }),
      secret: new StringField({ blank: true }),
      goal: new StringField({ blank: true }),
      artifactConnection: new StringField({ blank: true }),
      startingKnowledge: new StringField({ blank: true }),
      gainedKnowledge: new StringField({ blank: true }),
      locations: new ArrayField(new StringField()),
      positiveResult: new StringField({ blank: true }),
      negativeResult: new StringField({ blank: true }),

      // Tags
      tags: new ArrayField(new StringField()),

      // Shared initiative
      sharedInitiative: new BooleanField({ initial: false }),

      // Simplified view toggle
      useSimplifiedView: new BooleanField({ initial: false }),

      // Broken state
      isBroken: new BooleanField({ initial: false }),
    };
  }
}

/* ------------------------------------------ */
/*  HeadquartersDataModel                     */
/* ------------------------------------------ */

/**
 * TypeDataModel for Headquarters (HQ) actors — tracks Standing,
 * Development Points, upgrades, personnel, Threat, and vault state.
 * @extends foundry.abstract.TypeDataModel
 */
export class HeadquartersDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      standing: new NumberField({ required: true, integer: true, min: 0, max: 20, initial: 0 }),
      dp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      threat: new NumberField({ required: true, integer: true, min: 0, max: 6, initial: 0 }),

      // Cell members — Actor UUIDs
      cellMembers: new ArrayField(new StringField()),

      // Facility upgrades
      upgrades: new ArrayField(
        new SchemaField({
          upgradeId: new StringField(),
          purchased: new BooleanField({ initial: false }),
        }),
      ),

      // Personnel
      personnel: new ArrayField(
        new SchemaField({
          personnelId: new StringField(),
          usedThisCase: new BooleanField({ initial: false }),
          isCompromised: new BooleanField({ initial: false }),
        }),
      ),

      // Vault
      vault: new SchemaField({
        storedArtifacts: new ArrayField(new StringField()), // Max 3
        casesSinceConsecration: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),

      // Compromise log
      compromiseLog: new ArrayField(
        new SchemaField({
          caseNumber: new NumberField({ integer: true }),
          event: new StringField(),
          outcome: new StringField(),
        }),
      ),

      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    // Standing rank from score
    const s = this.standing;
    if (s >= 20) this.standingRank = 'covenantElite';
    else if (s >= 15) this.standingRank = 'honored';
    else if (s >= 10) this.standingRank = 'trusted';
    else if (s >= 5) this.standingRank = 'acknowledged';
    else this.standingRank = 'unknown';

    // Cell-wide CL floor from standing rank
    const clByRank = { unknown: 1, acknowledged: 1, trusted: 2, honored: 3, covenantElite: 4 };
    this.cellWideCL = clByRank[this.standingRank] ?? 1;

    // Vault re-consecration needed every 3 cases
    this.needsReconsecration = this.vault.casesSinceConsecration >= 3;
  }
}

/* ------------------------------------------ */
/*  MobDataModel                              */
/* ------------------------------------------ */

/**
 * TypeDataModel for Mob actors — groups of enemies acting as a single unit.
 * @extends foundry.abstract.TypeDataModel
 */
export class MobDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      memberCount: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 3 }),
      memberHP: new NumberField({ required: true, integer: true, initial: 3 }),
      sharedPool: new NumberField({ required: true, integer: true, min: 0, initial: 9 }),
      bestPool: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      bonusDice: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
      initiativeCard: new NumberField({ integer: true, nullable: true }),
      templateNPC: new StringField({ blank: true }),
      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    this.sharedPool = this.memberCount * 3;
    this.bonusDice = Math.min(this.memberCount - 1, 3);
    this.activeMemberCount = Math.ceil(this.sharedPool / 3);
    this.totalPool = this.bestPool + this.bonusDice;
  }
}

/* ------------------------------------------ */
/*  VehicleDataModel                          */
/* ------------------------------------------ */

/**
 * TypeDataModel for Vehicle actors — wear tracking and stat management.
 * @extends foundry.abstract.TypeDataModel
 */
export class VehicleDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      speed: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      ar: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      reliability: new NumberField({ required: true, integer: true, min: 0, initial: 4 }),
      handling: new NumberField({ required: true, integer: true, initial: 0 }),
      capacity: new NumberField({ required: true, integer: true, min: 0, initial: 4 }),
      noise: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      wear: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      sneakModifier: new NumberField({ required: true, integer: true, initial: 0 }),
      crew: new SchemaField({
        driver: new StringField({ nullable: true, initial: null }),
        passengers: new ArrayField(new StringField()),
      }),
      cargo: new ArrayField(new StringField()),
      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    this.problemThreshold = Math.floor(this.reliability / 2);
    this.stopsThreshold = this.reliability;
    this.hasProblem = this.wear >= this.problemThreshold;
    this.isStopped = this.wear >= this.stopsThreshold;
  }
}
