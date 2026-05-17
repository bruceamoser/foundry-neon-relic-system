/**
 * Stunt picker dialog — post-roll UI for selecting stunts with Stunt Points.
 * Shows skill-specific and generic stunts, enforces SP budget.
 * @module components/roll/stunt-picker
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

const SYSTEM_ID = 'neon-relic';

/**
 * Generic stunts available to any skill roll.
 */
const GENERIC_STUNTS = [
  { id: 'extraSuccess', cost: 1, name: 'NEONRELIC.Stunt.ExtraSuccess', effect: 'NEONRELIC.Stunt.ExtraSuccessEffect' },
  { id: 'assist', cost: 1, name: 'NEONRELIC.Stunt.Assist', effect: 'NEONRELIC.Stunt.AssistEffect' },
  {
    id: 'dramaticEffect',
    cost: 1,
    name: 'NEONRELIC.Stunt.DramaticEffect',
    effect: 'NEONRELIC.Stunt.DramaticEffectEffect',
  },
  { id: 'quickAction', cost: 2, name: 'NEONRELIC.Stunt.QuickAction', effect: 'NEONRELIC.Stunt.QuickActionEffect' },
  { id: 'momentum', cost: 2, name: 'NEONRELIC.Stunt.Momentum', effect: 'NEONRELIC.Stunt.MomentumEffect' },
  { id: 'recover', cost: 2, name: 'NEONRELIC.Stunt.Recover', effect: 'NEONRELIC.Stunt.RecoverEffect' },
];

/**
 * Skill-specific stunts keyed by skill ID.
 */
const SKILL_STUNTS = {
  manipulate: [
    {
      id: 'boughtSilence',
      cost: 1,
      name: 'NEONRELIC.Stunt.BoughtSilence',
      effect: 'NEONRELIC.Stunt.BoughtSilenceEffect',
    },
    { id: 'readTheRoom', cost: 2, name: 'NEONRELIC.Stunt.ReadTheRoom', effect: 'NEONRELIC.Stunt.ReadTheRoomEffect' },
    { id: 'turnedAsset', cost: 3, name: 'NEONRELIC.Stunt.TurnedAsset', effect: 'NEONRELIC.Stunt.TurnedAssetEffect' },
  ],
  command: [
    { id: 'rally', cost: 1, name: 'NEONRELIC.Stunt.Rally', effect: 'NEONRELIC.Stunt.RallyEffect' },
    {
      id: 'coordinatedAction',
      cost: 2,
      name: 'NEONRELIC.Stunt.CoordinatedAction',
      effect: 'NEONRELIC.Stunt.CoordinatedActionEffect',
    },
    { id: 'holdTheLine', cost: 3, name: 'NEONRELIC.Stunt.HoldTheLine', effect: 'NEONRELIC.Stunt.HoldTheLineEffect' },
  ],
  psychoanalyze: [
    {
      id: 'pressurePoint',
      cost: 1,
      name: 'NEONRELIC.Stunt.PressurePoint',
      effect: 'NEONRELIC.Stunt.PressurePointEffect',
    },
    { id: 'decompress', cost: 2, name: 'NEONRELIC.Stunt.Decompress', effect: 'NEONRELIC.Stunt.DecompressEffect' },
    { id: 'fullRead', cost: 3, name: 'NEONRELIC.Stunt.FullRead', effect: 'NEONRELIC.Stunt.FullReadEffect' },
  ],
  firearms: [
    {
      id: 'suppressiveFire',
      cost: 1,
      name: 'NEONRELIC.Stunt.SuppressiveFire',
      effect: 'NEONRELIC.Stunt.SuppressiveFireEffect',
    },
    { id: 'calledShot', cost: 2, name: 'NEONRELIC.Stunt.CalledShot', effect: 'NEONRELIC.Stunt.CalledShotEffect' },
    { id: 'doubleTap', cost: 3, name: 'NEONRELIC.Stunt.DoubleTap', effect: 'NEONRELIC.Stunt.DoubleTapEffect' },
  ],
  brawl: [
    { id: 'knockdown', cost: 1, name: 'NEONRELIC.Stunt.Knockdown', effect: 'NEONRELIC.Stunt.KnockdownEffect' },
    { id: 'disarm', cost: 2, name: 'NEONRELIC.Stunt.Disarm', effect: 'NEONRELIC.Stunt.DisarmEffect' },
    { id: 'chokehold', cost: 3, name: 'NEONRELIC.Stunt.Chokehold', effect: 'NEONRELIC.Stunt.ChokeholdEffect' },
  ],
  stealth: [
    { id: 'ghostStep', cost: 1, name: 'NEONRELIC.Stunt.GhostStep', effect: 'NEONRELIC.Stunt.GhostStepEffect' },
    { id: 'vanish', cost: 2, name: 'NEONRELIC.Stunt.Vanish', effect: 'NEONRELIC.Stunt.VanishEffect' },
    { id: 'ambush', cost: 3, name: 'NEONRELIC.Stunt.Ambush', effect: 'NEONRELIC.Stunt.AmbushEffect' },
  ],
  mobility: [
    {
      id: 'quickReposition',
      cost: 1,
      name: 'NEONRELIC.Stunt.QuickReposition',
      effect: 'NEONRELIC.Stunt.QuickRepositionEffect',
    },
    { id: 'breakaway', cost: 2, name: 'NEONRELIC.Stunt.Breakaway', effect: 'NEONRELIC.Stunt.BreakawayEffect' },
    { id: 'acrobatics', cost: 3, name: 'NEONRELIC.Stunt.Acrobatics', effect: 'NEONRELIC.Stunt.AcrobaticsEffect' },
  ],
  observation: [
    { id: 'spotWeakness', cost: 1, name: 'NEONRELIC.Stunt.SpotWeakness', effect: 'NEONRELIC.Stunt.SpotWeaknessEffect' },
    { id: 'thoroughScan', cost: 2, name: 'NEONRELIC.Stunt.ThoroughScan', effect: 'NEONRELIC.Stunt.ThoroughScanEffect' },
    { id: 'perfectRead', cost: 3, name: 'NEONRELIC.Stunt.PerfectRead', effect: 'NEONRELIC.Stunt.PerfectReadEffect' },
  ],
  survival: [
    { id: 'forage', cost: 1, name: 'NEONRELIC.Stunt.Forage', effect: 'NEONRELIC.Stunt.ForageEffect' },
    { id: 'fieldRepair', cost: 2, name: 'NEONRELIC.Stunt.FieldRepair', effect: 'NEONRELIC.Stunt.FieldRepairEffect' },
    { id: 'improvise', cost: 3, name: 'NEONRELIC.Stunt.Improvise', effect: 'NEONRELIC.Stunt.ImproviseEffect' },
  ],
  investigation: [
    { id: 'leadFollow', cost: 1, name: 'NEONRELIC.Stunt.LeadFollow', effect: 'NEONRELIC.Stunt.LeadFollowEffect' },
    {
      id: 'crossReference',
      cost: 2,
      name: 'NEONRELIC.Stunt.CrossReference',
      effect: 'NEONRELIC.Stunt.CrossReferenceEffect',
    },
    { id: 'breakthrough', cost: 3, name: 'NEONRELIC.Stunt.Breakthrough', effect: 'NEONRELIC.Stunt.BreakthroughEffect' },
  ],
  driving: [
    {
      id: 'evasiveManeuver',
      cost: 1,
      name: 'NEONRELIC.Stunt.EvasiveManeuver',
      effect: 'NEONRELIC.Stunt.EvasiveManeuverEffect',
    },
    { id: 'pitManeuver', cost: 2, name: 'NEONRELIC.Stunt.PitManeuver', effect: 'NEONRELIC.Stunt.PitManeuverEffect' },
    { id: 'hairpinTurn', cost: 3, name: 'NEONRELIC.Stunt.HairpinTurn', effect: 'NEONRELIC.Stunt.HairpinTurnEffect' },
  ],
  tech: [
    { id: 'quickFix', cost: 1, name: 'NEONRELIC.Stunt.QuickFix', effect: 'NEONRELIC.Stunt.QuickFixEffect' },
    { id: 'overcharge', cost: 2, name: 'NEONRELIC.Stunt.Overcharge', effect: 'NEONRELIC.Stunt.OverchargeEffect' },
    { id: 'macgyver', cost: 3, name: 'NEONRELIC.Stunt.MacGyver', effect: 'NEONRELIC.Stunt.MacGyverEffect' },
  ],
  medicine: [
    { id: 'quickPatch', cost: 1, name: 'NEONRELIC.Stunt.QuickPatch', effect: 'NEONRELIC.Stunt.QuickPatchEffect' },
    { id: 'stabilize', cost: 2, name: 'NEONRELIC.Stunt.Stabilize', effect: 'NEONRELIC.Stunt.StabilizeEffect' },
    {
      id: 'surgicalPrecision',
      cost: 3,
      name: 'NEONRELIC.Stunt.SurgicalPrecision',
      effect: 'NEONRELIC.Stunt.SurgicalPrecisionEffect',
    },
  ],
};

export class NRStuntPicker extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'stunt-picker',
    classes: [SYSTEM_ID, 'stunt-picker'],
    position: {
      width: 400,
      height: 'auto',
    },
    window: {
      title: 'NEONRELIC.Stunt.PickerTitle',
    },
    actions: {
      toggleStunt: NRStuntPicker.#onToggleStunt,
      confirmStunts: NRStuntPicker.#onConfirm,
    },
  };

  /** @override */
  static PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/roll/stunt-picker.hbs`,
    },
  };

  /* ------------------------------------------ */

  /**
   * @param {object} options
   * @param {number} options.stuntPoints - Available SP.
   * @param {string} options.skill - The skill key rolled.
   * @param {Actor} [options.actor] - The actor who rolled.
   */
  constructor(options = {}) {
    super(options);
    this.stuntPoints = options.stuntPoints ?? 0;
    this.skill = options.skill ?? '';
    this.actor = options.actor ?? null;
    this._selected = new Set();
  }

  /* ------------------------------------------ */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const skillStunts = (SKILL_STUNTS[this.skill] ?? []).map(s => ({
      ...s,
      localName: game.i18n.localize(s.name),
      localEffect: game.i18n.localize(s.effect),
      selected: this._selected.has(s.id),
      affordable: s.cost <= this._remainingSP(s.id),
    }));

    const genericStunts = GENERIC_STUNTS.map(s => ({
      ...s,
      localName: game.i18n.localize(s.name),
      localEffect: game.i18n.localize(s.effect),
      selected: this._selected.has(s.id),
      affordable: s.cost <= this._remainingSP(s.id),
    }));

    context.stuntPoints = this.stuntPoints;
    context.spentSP = this._spentSP();
    context.remainingSP = this.stuntPoints - this._spentSP();
    context.skillStunts = skillStunts;
    context.genericStunts = genericStunts;
    context.hasSkillStunts = skillStunts.length > 0;
    context.skillLabel = game.i18n.localize(
      `NEONRELIC.Skill.${this.skill.charAt(0).toUpperCase() + this.skill.slice(1)}`,
    );
    context.canConfirm = this._selected.size > 0;

    return context;
  }

  /* ------------------------------------------ */

  _spentSP() {
    const allStunts = [...GENERIC_STUNTS, ...(SKILL_STUNTS[this.skill] ?? [])];
    let spent = 0;
    for (const s of allStunts) {
      if (this._selected.has(s.id)) spent += s.cost;
    }
    return spent;
  }

  _remainingSP(stuntId) {
    const allStunts = [...GENERIC_STUNTS, ...(SKILL_STUNTS[this.skill] ?? [])];
    let spent = 0;
    for (const s of allStunts) {
      if (this._selected.has(s.id) && s.id !== stuntId) spent += s.cost;
    }
    return this.stuntPoints - spent;
  }

  /* ------------------------------------------ */

  static #onToggleStunt(event, target) {
    const stuntId = target.dataset.stuntId;
    if (this._selected.has(stuntId)) {
      this._selected.delete(stuntId);
    } else {
      // Check budget
      const allStunts = [...GENERIC_STUNTS, ...(SKILL_STUNTS[this.skill] ?? [])];
      const stunt = allStunts.find(s => s.id === stuntId);
      if (stunt && stunt.cost <= this._remainingSP(stuntId)) {
        this._selected.add(stuntId);
      }
    }
    this.render();
  }

  static async #onConfirm() {
    const allStunts = [...GENERIC_STUNTS, ...(SKILL_STUNTS[this.skill] ?? [])];
    const chosen = allStunts.filter(s => this._selected.has(s.id));

    // Post to chat
    const content = chosen
      .map(
        s => `<li><strong>${game.i18n.localize(s.name)}</strong> (${s.cost} SP): ${game.i18n.localize(s.effect)}</li>`,
      )
      .join('');

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<h3>${game.i18n.localize('NEONRELIC.Stunt.ChatHeader')}</h3><ul>${content}</ul>`,
    });

    this.close();
  }

  /* ------------------------------------------ */

  /**
   * Open the stunt picker if SP > 0.
   * @param {object} params
   * @param {number} params.stuntPoints
   * @param {string} params.skill
   * @param {Actor} [params.actor]
   * @returns {NRStuntPicker|null}
   */
  static open({ stuntPoints, skill, actor } = {}) {
    if (stuntPoints <= 0) return null;
    const picker = new NRStuntPicker({ stuntPoints, skill, actor });
    picker.render(true);
    return picker;
  }
}
