/**
 * Data migration framework for Neon Relic.
 * Handles version upgrades and data schema changes.
 */

/** Current system data version */
const CURRENT_VERSION = '0.4.0';

/**
 * Migration registry — each entry runs once when upgrading past its version.
 */
const MIGRATIONS = [
  {
    version: '0.4.0',
    title: 'Add Total/Spent XP fields to agent experience',
    migrate: async () => {
      const agents = game.actors.filter(a => a.type === 'agent');
      let migrated = 0;
      for (const actor of agents) {
        const xp = actor.system.experience;
        if (xp.total === undefined || xp.spent === undefined) {
          await actor.update({
            'system.experience.total': xp.current ?? 0,
            'system.experience.spent': 0,
          });
          migrated++;
        }
      }
      console.log(`neon-relic | Migrated ${migrated} agents XP to three-track model (total/spent)`);
    },
  },
  {
    version: '0.3.0',
    title: 'Backfill CL field on consumable items',
    migrate: async () => {
      const consumables = game.items.filter(i => i.type === 'consumable' && i.system.cl === undefined);
      let migrated = 0;
      for (const item of consumables) {
        await item.update({ 'system.cl': 1 });
        migrated++;
      }
      console.log(`neon-relic | Migrated ${migrated} consumable items with CL=1 default`);
    },
  },
  {
    version: '0.2.0',
    title: 'Set creationComplete for pre-existing agents',
    migrate: async () => {
      const agents = game.actors.filter(a => a.type === 'agent');
      let migrated = 0;
      for (const actor of agents) {
        if (!actor.system.creationComplete && actor.system.division) {
          await actor.update({ 'system.creationComplete': true });
          migrated++;
        }
      }
      console.log(`neon-relic | Migrated ${migrated} pre-existing agents to creationComplete=true`);
    },
  },
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
