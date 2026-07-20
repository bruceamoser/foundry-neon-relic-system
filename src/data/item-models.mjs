/**
 * Data models for all item types in Neon Relic.
 * @module data/item-models
 */

const { SchemaField, NumberField, StringField, BooleanField, HTMLField, ArrayField } = foundry.data.fields;

const DIE_STEPS = ['d12', 'd10', 'd8', 'd6', 'd4', 'depleted'];
const DIE_CHOICES = ['d12', 'd10', 'd8', 'd6', 'd4'];

/* ------------------------------------------ */
/*  ArtifactDataModel                         */
/* ------------------------------------------ */

/**
 * TypeDataModel for Artifact items — occult objects with die chains,
 * emissions, containment profiles, and activation tracking.
 * @extends foundry.abstract.TypeDataModel
 */
export class ArtifactDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier: new NumberField({ required: true, integer: true, min: 1, max: 3, initial: 1 }),
      corruptionCost: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),

      // Artifact Die
      artifactDie: new SchemaField({
        current: new StringField({ initial: 'd20', blank: false }),
        starting: new StringField({ initial: 'd20', blank: false }),
      }),

      // Activation
      activationCondition: new StringField({ blank: true }),
      isActivatedThisCase: new BooleanField({ initial: false }),
      effect: new HTMLField({ blank: true }),

      // Fracture
      fractureCondition: new StringField({ blank: true }),

      // Emissions
      emission: new SchemaField({
        type: new StringField({ nullable: true, initial: null }),
        radius: new StringField({ blank: true }),
        trigger: new StringField({ blank: true }),
        corruptionAmount: new NumberField({ integer: true, min: 0, initial: 0 }),
        isSuppressed: new BooleanField({ initial: false }),
      }),

      // Containment
      containmentProfile: new SchemaField({
        type: new StringField({ blank: true }),
        isContained: new BooleanField({ initial: false }),
        truths: new SchemaField({
          triggerCondition: new StringField({ blank: true }),
          appetite: new StringField({ blank: true }),
          quiescenceCondition: new StringField({ blank: true }),
        }),
      }),

      // Active Artifact Pressure
      activePressure: new BooleanField({ initial: false }),

      // Decay Track (optional rule)
      decay: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        enabled: new BooleanField({ initial: false }),
      }),

      encumbrance: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      replicable: new BooleanField({ initial: false }),
      loreIdentified: new BooleanField({ initial: false }),
      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    this.corruptionCost = this.tier;
    this.encumbrance = this.tier + (this.activePressure ? 1 : 0);
  }
}

/* ------------------------------------------ */
/*  WeaponDataModel                           */
/* ------------------------------------------ */

/**
 * TypeDataModel for Weapon items — firearms, melee weapons, explosives.
 * @extends foundry.abstract.TypeDataModel
 */
export class WeaponDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      damage: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      range: new StringField({ initial: 'near', blank: false }),
      gearBonus: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      skill: new StringField({ initial: 'brawl', blank: false }),
      targetAttribute: new StringField({ initial: 'str', blank: false }),
      meleeType: new StringField({ nullable: true, initial: null }),
      traits: new SchemaField({
        reliable: new BooleanField({ initial: false }),
        highCapacity: new BooleanField({ initial: false }),
        fullAuto: new BooleanField({ initial: false }),
        stunned: new BooleanField({ initial: false }),
      }),
      ammoDie: new SchemaField({
        current: new StringField({ nullable: true, initial: null }),
        starting: new StringField({ nullable: true, initial: null }),
      }),
      linkedConsumableId: new StringField({ nullable: true, initial: null }),
      encumbrance: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      worn: new BooleanField({ initial: true }),
      cl: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 1 }),
      isBroken: new BooleanField({ initial: false }),
      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    this.isDegraded = this.gearBonus.value < this.gearBonus.max && this.gearBonus.value > 0;
    if (this.gearBonus.max > 0 && this.gearBonus.value === 0) {
      this.isBroken = true;
    }
  }
}

/* ------------------------------------------ */
/*  ArmorDataModel                            */
/* ------------------------------------------ */

/**
 * TypeDataModel for Armor items — degrades on pushes and stunts,
 * NOT on rolling 1s. Uses flat AR decrement.
 * @extends foundry.abstract.TypeDataModel
 */
export class ArmorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ar: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      encumbrance: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      worn: new BooleanField({ initial: true }),
      agilityPenalty: new NumberField({ required: true, integer: true, initial: 0 }),
      cl: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 1 }),
      isBroken: new BooleanField({ initial: false }),
      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    this.isDegraded = this.ar.value < this.ar.max && this.ar.value > 0;
    if (this.ar.max > 0 && this.ar.value === 0) {
      this.isBroken = true;
    }
  }
}

/* ------------------------------------------ */
/*  GearDataModel                             */
/* ------------------------------------------ */

/**
 * TypeDataModel for Gear items — tools, investigative tech, kits.
 * @extends foundry.abstract.TypeDataModel
 */
export class GearDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      gearBonus: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      encumbrance: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      worn: new BooleanField({ initial: true }),
      cl: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 1 }),
      isBroken: new BooleanField({ initial: false }),
      skillBonus: new StringField({ nullable: true, initial: null }),
      linkedConsumableId: new StringField({ nullable: true, initial: null }),
      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    this.isDegraded = this.gearBonus.value < this.gearBonus.max && this.gearBonus.value > 0;
    if (this.gearBonus.max > 0 && this.gearBonus.value === 0) {
      this.isBroken = true;
    }
  }
}

/* ------------------------------------------ */
/*  ConsumableDataModel                       */
/* ------------------------------------------ */

/**
 * TypeDataModel for Consumable items — supplies using the Resource Die mechanic.
 * @extends foundry.abstract.TypeDataModel
 */
export class ConsumableDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cl: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 1 }),
      currentDie: new StringField({ initial: 'd8', blank: false }),
      startingDie: new StringField({ initial: 'd8', blank: false }),
      consumableType: new StringField({ initial: 'supply', blank: false }),
      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    this.isDepleted = this.currentDie === 'depleted';
    this.dieStepIndex = DIE_STEPS.indexOf(this.currentDie);
  }
}

/* ------------------------------------------ */
/*  TalentDataModel                           */
/* ------------------------------------------ */

/**
 * TypeDataModel for Talent items — character abilities with per-session tracking.
 * @extends foundry.abstract.TypeDataModel
 */
export class TalentDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      talentType: new StringField({ initial: 'general', blank: false }),
      division: new StringField({ initial: '', blank: true }),
      subUnit: new StringField({ initial: '', blank: true }),
      frequency: new StringField({
        initial: 'at-will',
        blank: false,
        choices: ['at-will', 'per-session', 'per-case-file'],
      }),
      corruptionCost: new NumberField({ required: true, integer: true, min: 0, max: 2, initial: 0 }),
      corruptionThresholdMod: new NumberField({ required: true, integer: true, initial: 0 }),
      prerequisites: new HTMLField({ blank: true }),
      hasHealingTag: new BooleanField({ initial: false }),
      isOncePerSession: new BooleanField({ initial: false }),
      usesPerSession: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      }),
      usesPerCaseFile: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      }),
      conditionalModifier: new SchemaField({
        skill: new StringField({ nullable: true, initial: null }),
        bonus: new NumberField({ required: true, integer: true, initial: 0 }),
        condition: new StringField({ nullable: true, initial: null }),
      }),
      effect: new HTMLField({ blank: true }),
      description: new HTMLField({ blank: true }),
    };
  }
}

/* ------------------------------------------ */
/*  CriticalInjuryDataModel                   */
/* ------------------------------------------ */

/**
 * TypeDataModel for Critical Injury items — physical and mental d66 table results.
 * @extends foundry.abstract.TypeDataModel
 */
export class CriticalInjuryDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      injuryType: new StringField({ initial: 'physical', blank: false }),
      d66Roll: new NumberField({ required: true, integer: true, min: 11, max: 66, initial: 11 }),
      effect: new HTMLField({ blank: true }),
      timeLimit: new StringField({ nullable: true, initial: null }),
      isLethal: new BooleanField({ initial: false }),
      isHealed: new BooleanField({ initial: false }),
      corruptionThresholdMod: new NumberField({ required: true, integer: true, initial: 0 }),
      insight: new HTMLField({ nullable: true }),
      description: new HTMLField({ blank: true }),
    };
  }
}

/* ------------------------------------------ */
/*  AnchorDataModel                           */
/* ------------------------------------------ */

/**
 * TypeDataModel for Anchor items — a character's personal grounding connection.
 * @extends foundry.abstract.TypeDataModel
 */
export class AnchorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      relationship: new HTMLField({ blank: true }),
      memory: new HTMLField({ blank: true }),
      uses: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 3 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 3 }),
      }),
      isLost: new BooleanField({ initial: false }),
      description: new HTMLField({ blank: true }),
    };
  }
}

/* ------------------------------------------ */
/*  DarkSecretDataModel                       */
/* ------------------------------------------ */

/**
 * TypeDataModel for Dark Secret items — hidden pasts that provide XP triggers.
 * @extends foundry.abstract.TypeDataModel
 */
export class DarkSecretDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ blank: true }),
      xpTrigger: new StringField({ blank: true }),
      divisionExamples: new HTMLField({ blank: true }),
      exposurePenalties: new SchemaField({
        standingLoss: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        factionConsequence: new StringField({ blank: true }),
      }),
    };
  }
}

/* ------------------------------------------ */
/*  UpgradeDataModel                          */
/* ------------------------------------------ */

/**
 * TypeDataModel for Upgrade items — HQ facilities purchasable with DP.
 * @extends foundry.abstract.TypeDataModel
 */
export class UpgradeDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier: new NumberField({ required: true, integer: true, min: 1, max: 3, initial: 1 }),
      dpCost: new NumberField({ required: true, integer: true, min: 0, initial: 2 }),
      standingRequirement: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      category: new StringField({ initial: 'facility', blank: false }),
      prerequisites: new ArrayField(new StringField()),
      isPurchased: new BooleanField({ initial: false }),
      effect: new HTMLField({ blank: true }),
      description: new HTMLField({ blank: true }),
    };
  }
}

/* ------------------------------------------ */
/*  LocationDataModel                         */
/* ------------------------------------------ */

/**
 * TypeDataModel for Location items — Operations Board and Case File locations.
 * @extends foundry.abstract.TypeDataModel
 */
export class LocationDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      locationId: new StringField({ blank: true }),
      caseId: new StringField({ blank: true }),
      availability: new StringField({ initial: 'open', blank: false }),
      availabilityCondition: new StringField({ blank: true }),
      npcsPresent: new HTMLField({ blank: true }),
      informationAvailable: new HTMLField({ blank: true }),
      organizationsPresent: new HTMLField({ blank: true }),
      positiveResult: new HTMLField({ blank: true }),
      negativeResult: new HTMLField({ blank: true }),
      milestoneChanges: new HTMLField({ blank: true }),
      daNotes: new HTMLField({ blank: true }),
      image: new StringField({ blank: true }),
      description: new HTMLField({ blank: true }),
    };
  }
}

/* ------------------------------------------ */
/*  InformationCardDataModel                  */
/* ------------------------------------------ */

/**
 * TypeDataModel for Information Card items — case file clues, evidence,
 * truths, and contacts with front/back reveal mechanic.
 * @extends foundry.abstract.TypeDataModel
 */
export class InformationCardDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cardId: new StringField({ initial: '', blank: true }),
      cardType: new StringField({ initial: 'supportingIntel', blank: false }),
      content: new HTMLField({ blank: true }),
      foundAt: new StringField({ blank: true }),
      knownBy: new StringField({ blank: true }),
      hqFallback: new NumberField({ initial: 0, integer: true, min: 0 }),
      daNotes: new HTMLField({ blank: true }),
      revealed: new BooleanField({ initial: false }),
      description: new HTMLField({ blank: true }),
    };
  }
}

/* ------------------------------------------ */
/*  PlayerCaseBriefDataModel                  */
/* ------------------------------------------ */

/**
 * TypeDataModel for Player Case Brief items — VC-18 Agent Briefing
 * with sections I–VIII and initial contacts NPC table.
 * @extends foundry.abstract.TypeDataModel
 */
export class PlayerCaseBriefDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      caseId: new StringField({ blank: true }),
      caseName: new StringField({ blank: true }),
      region: new StringField({ blank: true }),
      classification: new StringField({ initial: 'CLASSIFIED', blank: false }),
      situationSummary: new HTMLField({ blank: true }),
      primaryObjective: new HTMLField({ blank: true }),
      secondaryObjective: new HTMLField({ blank: true }),
      knownOrganizations: new HTMLField({ blank: true }),
      initialContacts: new ArrayField(
        new SchemaField({
          name: new StringField({ blank: true }),
          role: new StringField({ blank: true }),
          knownInfo: new StringField({ blank: true }),
        }),
      ),
      startingLeads: new HTMLField({ blank: true }),
      timelinePressure: new HTMLField({ blank: true }),
      constraints: new HTMLField({ blank: true }),
      regionalContacts: new HTMLField({ blank: true }),
      agentNotes: new HTMLField({ blank: true }),
      description: new HTMLField({ blank: true }),
    };
  }

  /** @override */
  prepareDerivedData() {
    if (!this.initialContacts || this.initialContacts.length < 6) {
      this.initialContacts = this.initialContacts ?? [];
      while (this.initialContacts.length < 6) {
        this.initialContacts.push({ name: '', role: '', knownInfo: '' });
      }
    }
  }
}

/* ------------------------------------------ */
/*  DACaseBriefDataModel                      */
/* ------------------------------------------ */

/**
 * TypeDataModel for DA Case Brief items — Director Agent master reference
 * document (VC-17) with spoiler-filled sections I–VIII matching the form layout.
 * @extends foundry.abstract.TypeDataModel
 */
export class DACaseBriefDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      caseId: new StringField({ blank: true }),
      caseName: new StringField({ blank: true }),
      relicTier: new NumberField({ required: true, integer: true, min: 1, max: 4, initial: 1 }),
      region: new StringField({ blank: true }),

      // I — Mystery Statement
      mysteryStatement: new HTMLField({ blank: true }),

      // II — The Real Situation
      realSituation: new HTMLField({ blank: true }),

      // III — Agent Objectives
      primaryObjective: new HTMLField({ blank: true }),
      secondaryObjective: new HTMLField({ blank: true }),

      // IV — Containment Truths Summary
      containmentTrigger: new HTMLField({ blank: true }),
      containmentAppetite: new HTMLField({ blank: true }),
      containmentQuiescence: new HTMLField({ blank: true }),

      // V — Key Actors & Factions
      keyActors: new HTMLField({ blank: true }),

      // VI — Resolution & Endgame
      bestCaseResolution: new HTMLField({ blank: true }),
      worstCaseResolution: new HTMLField({ blank: true }),

      // VII — Relic Milestones
      relicMilestones: new ArrayField(
        new SchemaField({
          day: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          description: new StringField({ blank: true }),
        }),
      ),

      // VIII — DA Notes
      daNotes: new HTMLField({ blank: true }),

      description: new HTMLField({ blank: true }),
    };
  }

  /** @override */
  prepareDerivedData() {
    if (!this.relicMilestones || this.relicMilestones.length < 6) {
      this.relicMilestones = this.relicMilestones ?? [];
      while (this.relicMilestones.length < 6) {
        this.relicMilestones.push({ day: 0, description: '' });
      }
    }
  }
}

/* ------------------------------------------ */
/*  SubdivisionDataModel                      */
/* ------------------------------------------ */

/**
 * TypeDataModel for Subdivision items — draggable items representing
 * a Covenant Wing, Paradigm, or Department within a Division.
 * @extends foundry.abstract.TypeDataModel
 */
export class SubdivisionDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      division: new StringField({ initial: 'recovery', blank: false }),
      talentKey: new StringField({ blank: true }),
      keySkill: new StringField({ initial: 'firearms', blank: false }),
      baseCL: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 2 }),
      specialties: new ArrayField(
        new SchemaField({
          key: new StringField({ blank: false }),
          label: new StringField({ blank: false }),
          description: new StringField({ blank: true }),
        }),
      ),
      startingGear: new ArrayField(
        new SchemaField({
          name: new StringField({ blank: false }),
          type: new StringField({ initial: 'gear', blank: false }),
          pack: new StringField({ blank: true }),
        }),
      ),
      divisionItemName: new StringField({ blank: true }),
      description: new HTMLField({ blank: true }),
    };
  }
}

/* ------------------------------------------ */
/*  RelicSheetDataModel (VC-16)               */
/* ------------------------------------------ */

/**
 * TypeDataModel for Relic Sheet (VC-16) — DA-facing case file document
 * for the central artifact that drives a case. Distinct from the Artifact
 * item type used by players.
 * @extends foundry.abstract.TypeDataModel
 */
export class RelicSheetDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Relic Identity
      relicName: new StringField({ blank: true }),
      tier: new NumberField({ required: true, integer: true, min: 1, max: 4, initial: 1 }),
      category: new StringField({ initial: 'object', blank: false }),
      riskTag: new StringField({ blank: true }),
      corruptionCost: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      artifactDie: new StringField({ initial: 'd20', blank: false }),
      emissionType: new StringField({ blank: true }),
      mundaneAppearance: new StringField({ blank: true }),

      // Intelligence Reads
      surfaceRead: new HTMLField({ blank: true }),
      operationalRead: new HTMLField({ blank: true }),
      coldArchiveRead: new HTMLField({ blank: true }),

      // Activation & Effect
      activationCondition: new HTMLField({ blank: true }),
      mechanicalEffect: new HTMLField({ blank: true }),

      // Fracture
      fractureCondition: new HTMLField({ blank: true }),

      // Containment Profile
      containmentProfile: new HTMLField({ blank: true }),

      // Containment Truth Checklist (up to 8)
      containmentTruths: new ArrayField(
        new SchemaField({
          id: new StringField({ blank: true }),
          description: new StringField({ blank: true }),
          checked: new BooleanField({ initial: false }),
        }),
      ),

      // Relic Image
      relicImage: new StringField({ blank: true }),

      // DA Notes
      daNotes: new HTMLField({ blank: true }),

      // Cross-reference
      caseId: new StringField({ blank: true }),

      description: new HTMLField({ blank: true }),
    };
  }

  /* ------------------------------------------ */

  /** @override */
  prepareDerivedData() {
    // Ensure at least 8 containment truth rows exist for the template grid
    if (!this.containmentTruths || this.containmentTruths.length < 8) {
      this.containmentTruths = this.containmentTruths ?? [];
      while (this.containmentTruths.length < 8) {
        this.containmentTruths.push({ id: '', description: '', checked: false });
      }
    }
  }
}

/* ------------------------------------------ */
/*  OrganizationDataModel                     */
/* ------------------------------------------ */

/**
 * TypeDataModel for Organization Reference items — DA-only faction tracker
 * (VC-20) with activation conditions, linked effects, and player-facing signs.
 * Supports NPC drag-drop linking. Cross-referenced by NPC Cards, Location
 * sheets, and DA Case Brief via O#.
 * @extends foundry.abstract.TypeDataModel
 */
export class OrganizationDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      organizationId: new StringField({ initial: '', blank: true }),
      organizationName: new StringField({ initial: '', blank: true }),
      caseId: new StringField({ blank: true }),
      isActive: new BooleanField({ initial: true }),
      isDormant: new BooleanField({ initial: false }),
      activationCondition: new HTMLField({ blank: true }),
      linkedEffects: new HTMLField({ blank: true }),
      playerFacingSigns: new HTMLField({ blank: true }),
      npcUuids: new ArrayField(new StringField({ blank: true })),
      description: new HTMLField({ blank: true }),
    };
  }
}
