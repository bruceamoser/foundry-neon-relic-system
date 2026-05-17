/**
 * Data migration framework for Neon Relic.
 * Handles version upgrades and data schema changes.
 */

/** Current system data version */
const CURRENT_VERSION = '0.1.0';

/**
 * Migration registry — each entry runs once when upgrading past its version.
 */
const MIGRATIONS = [
  // Example migration for future use:
  // {
  //   version: '0.2.0',
  //   title: 'Add corruption stage field',
  //   migrate: async () => { ... }
  // },
];

/**
 * Check if data migration is needed and run pending migrations.
 * Called during the 'ready' hook.
 */
export async function migrateWorld() {
  if (!game.user.isGM) return;

  const currentVersion = game.settings.get('neon-relic', 'systemMigrationVersion') ?? '0.0.0';
  if (currentVersion === CURRENT_VERSION) return;

  ui.notifications.info(
    game.i18n.format('NEONRELIC.Migration.Start', {
      from: currentVersion,
      to: CURRENT_VERSION,
    }),
    { permanent: true },
  );

  // Run pending migrations in order
  for (const migration of MIGRATIONS) {
    if (foundry.utils.isNewerVersion(migration.version, currentVersion)) {
      console.log(`neon-relic | Running migration: ${migration.title} (${migration.version})`);
      try {
        await migration.migrate();
        console.log(`neon-relic | Migration ${migration.version} complete`);
      } catch (err) {
        console.error(`neon-relic | Migration ${migration.version} failed:`, err);
        ui.notifications.error(
          game.i18n.format('NEONRELIC.Migration.Error', {
            version: migration.version,
            error: err.message,
          }),
        );
        return; // Stop on failure
      }
    }
  }

  // Update version stamp
  await game.settings.set('neon-relic', 'systemMigrationVersion', CURRENT_VERSION);
  ui.notifications.info(game.i18n.localize('NEONRELIC.Migration.Complete'), {
    permanent: true,
  });
}

/**
 * Register the migration version setting.
 */
export function registerMigrationSetting() {
  game.settings.register('neon-relic', 'systemMigrationVersion', {
    name: 'System Migration Version',
    scope: 'world',
    config: false,
    type: String,
    default: '0.0.0',
  });
}
