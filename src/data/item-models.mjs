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
      availability: new StringField({ initial: 'open', blank: false }),
      availabilityCondition: new StringField({ blank: true }),
      npcsPresent: new HTMLField({ blank: true }),
      informationAvailable: new HTMLField({ blank: true }),
      organizationsPresent: new HTMLField({ blank: true }),
      positiveResult: new HTMLField({ blank: true }),
      negativeResult: new HTMLField({ blank: true }),
      milestoneChanges: new HTMLField({ blank: true }),
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
      revealed: new BooleanField({ initial: false }),
      description: new HTMLField({ blank: true }),
    };
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
