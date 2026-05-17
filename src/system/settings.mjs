/**
 * System settings — optional rules toggles for the settings menu.
 * @module system/settings
 */

/**
 * Register all system settings.
 */
export function registerSettings() {
  // ─── Optional Rules (#60) ────────────────────────────────

  game.settings.register('neon-relic', 'artifactDecay', {
    name: 'NEONRELIC.Settings.ArtifactDecay',
    hint: 'NEONRELIC.Settings.ArtifactDecayHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register('neon-relic', 'rivalCells', {
    name: 'NEONRELIC.Settings.RivalCells',
    hint: 'NEONRELIC.Settings.RivalCellsHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register('neon-relic', 'autoCorruption', {
    name: 'NEONRELIC.Settings.AutoCorruption',
    hint: 'NEONRELIC.Settings.AutoCorruptionHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('neon-relic', 'fearChecks', {
    name: 'NEONRELIC.Settings.FearChecks',
    hint: 'NEONRELIC.Settings.FearChecksHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('neon-relic', 'gearDegradation', {
    name: 'NEONRELIC.Settings.GearDegradation',
    hint: 'NEONRELIC.Settings.GearDegradationHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // ─── Theme (#59) ────────────────────────────────────────

  game.settings.register('neon-relic', 'theme', {
    name: 'NEONRELIC.Settings.Theme',
    hint: 'NEONRELIC.Settings.ThemeHint',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      crt: 'NEONRELIC.Settings.ThemeCRT',
      clean: 'NEONRELIC.Settings.ThemeClean',
    },
    default: 'crt',
    onChange: value => applyTheme(value),
  });

  // ─── Session Tracking (#65) ─────────────────────────────

  game.settings.register('neon-relic', 'currentSession', {
    name: 'NEONRELIC.Settings.CurrentSession',
    scope: 'world',
    config: false,
    type: Number,
    default: 1,
  });

  game.settings.register('neon-relic', 'sessionResetDone', {
    name: 'NEONRELIC.Settings.SessionResetDone',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
  });
}

/**
 * Apply visual theme class to the document body.
 * @param {string} theme - 'crt' or 'clean'.
 */
export function applyTheme(theme) {
  document.body.classList.remove('neon-relic-crt', 'neon-relic-clean');
  document.body.classList.add(`neon-relic-${theme}`);
}

/**
 * Initialize theme on ready.
 */
export function initTheme() {
  const theme = game.settings.get('neon-relic', 'theme');
  applyTheme(theme);
}
