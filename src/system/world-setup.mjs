/**
 * World Setup Dialog — first-run dialog that imports starter content
 * from compendium packs into a new world.
 * @module system/world-setup
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

const SYSTEM_ID = 'neon-relic';

/**
 * Content categories available for import.
 * @type {Array<{id: string, label: string, pack: string, checked: boolean}>}
 */
const IMPORT_CATEGORIES = [
  { id: 'rules', label: 'NEONRELIC.WorldSetup.Rules', pack: 'rules-reference', checked: true },
  { id: 'tables', label: 'NEONRELIC.WorldSetup.RollTables', pack: 'roll-tables', checked: true },
  { id: 'macros', label: 'NEONRELIC.WorldSetup.Macros', pack: 'macros', checked: true },
  { id: 'subdivisions', label: 'NEONRELIC.WorldSetup.Subdivisions', pack: 'subdivisions', checked: true },
  {
    id: 'sample',
    label: 'NEONRELIC.WorldSetup.SampleCase',
    pack: ['sample-case', 'sample-case-npcs', 'sample-case-items'],
    checked: false,
  },
];

/**
 * World Setup application window.
 */
export class WorldSetupApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'world-setup',
    classes: [SYSTEM_ID, 'world-setup'],
    position: { width: 480, height: 'auto' },
    window: { title: 'NEONRELIC.WorldSetup.Title', resizable: false },
    actions: {
      importContent: WorldSetupApp.#onImport,
      skipSetup: WorldSetupApp.#onSkip,
    },
  };

  /** @override */
  static PARTS = {
    setup: { template: `systems/${SYSTEM_ID}/templates/world-setup.hbs` },
  };

  /** @override */
  async _prepareContext() {
    return {
      categories: IMPORT_CATEGORIES.map(c => ({
        ...c,
        label: game.i18n.localize(c.label),
      })),
    };
  }

  /* ------------------------------------------ */
  /*  Action Handlers                            */
  /* ------------------------------------------ */

  /**
   * Import selected content packs.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onImport(_event, _target) {
    const form = this.element.querySelector('form');
    const checkboxes = form.querySelectorAll('input[name="category"]:checked');
    const selectedIds = [...checkboxes].map(cb => cb.value);
    const selected = IMPORT_CATEGORIES.filter(c => selectedIds.includes(c.id));

    if (!selected.length) {
      ui.notifications.warn(game.i18n.localize('NEONRELIC.WorldSetup.NoneSelected'));
      return;
    }

    // Disable buttons during import
    const buttons = this.element.querySelectorAll('button');
    buttons.forEach(b => (b.disabled = true));

    console.log(
      `neon-relic | World setup: importing ${selected.length} categories: ${selected.map(c => c.id).join(', ')}`,
    );
    let totalImported = 0;
    for (const category of selected) {
      const packNames = Array.isArray(category.pack) ? category.pack : [category.pack];
      for (const packName of packNames) {
        const packId = `${SYSTEM_ID}.${packName}`;
        const pack = game.packs.get(packId);
        if (!pack) {
          console.warn(`neon-relic | Pack ${packId} not found, skipping`);
          continue;
        }
        try {
          // Filter out phantom entries with null _id (LevelDB index artifact)
          const index = await pack.getIndex();
          const validIds = index.filter(e => e._id).map(e => e._id);
          console.log(
            `neon-relic | Pack ${packId}: ${index.contents.length} index entries, ${validIds.length} valid IDs`,
          );
          const allDocs = await pack.getDocuments();
          const validDocs = allDocs.filter(d => d.id && validIds.includes(d.id));
          console.log(
            `neon-relic | Pack ${packId}: ${allDocs.length} documents loaded, ${validDocs.length} valid after filter`,
          );

          // Skip documents that already exist in the world collection
          const collectionMap = {
            JournalEntry: 'journal',
            RollTable: 'tables',
            Macro: 'macros',
            Actor: 'actors',
            Item: 'items',
          };
          const collectionName = collectionMap[pack.metadata.type] ?? 'items';
          const collection = game[collectionName];
          const existingIds = new Set(collection?.map(d => d.id) ?? []);
          const newDocs = validDocs.filter(d => !existingIds.has(d.id));
          if (newDocs.length < validDocs.length) {
            console.log(
              `neon-relic | Pack ${packId}: ${validDocs.length - newDocs.length} documents already exist, importing ${newDocs.length} new`,
            );
          }
          if (newDocs.length === 0) continue;

          const cls = pack.documentClass;
          const created = await cls.create(
            newDocs.map(d => d.toObject()),
            { keepId: true },
          );
          const count = Array.isArray(created) ? created.length : created ? 1 : 0;
          totalImported += count;
          console.log(`neon-relic | Imported ${count} documents from ${packId}`);
        } catch (err) {
          console.error(`neon-relic | Failed to import ${packId}:`, err);
          ui.notifications.error(game.i18n.format('NEONRELIC.WorldSetup.ImportError', { pack: packName }));
        }
      }
    }

    // Set flag and close
    console.log(`neon-relic | World setup: import complete — ${totalImported} total documents imported`);
    await game.settings.set(SYSTEM_ID, 'worldInitialized', true);

    // Completion message
    ChatMessage.create({
      content: game.i18n.format('NEONRELIC.WorldSetup.Complete', { count: totalImported }),
      whisper: [game.user.id],
    });

    ui.notifications.info(game.i18n.localize('NEONRELIC.WorldSetup.Done'));
    this.close();
  }

  /**
   * Skip setup without importing.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static async #onSkip(_event, _target) {
    await game.settings.set(SYSTEM_ID, 'worldInitialized', true);
    this.close();
  }
}

/**
 * Check if world setup is needed and show dialog.
 * Called from Hooks.once('ready').
 */
export function checkWorldSetup() {
  if (!game.user.isGM) {
    console.log('neon-relic | World setup: skipped (not GM)');
    return;
  }
  const initialized = game.settings.get(SYSTEM_ID, 'worldInitialized');
  console.log(`neon-relic | World setup: worldInitialized = ${initialized}`);
  if (initialized) {
    // Auto-recovery: if flag is set but no journals exist, the previous import
    // likely failed or the world was reset. Clear the flag and re-show the dialog.
    const journalCount = game.journal?.size ?? 0;
    if (journalCount === 0) {
      console.warn('neon-relic | World setup: worldInitialized=true but 0 journals found — resetting flag');
      game.settings.set(SYSTEM_ID, 'worldInitialized', false);
      new WorldSetupApp().render({ force: true });
      return;
    }
    return;
  }
  console.log('neon-relic | World setup: showing setup dialog');
  new WorldSetupApp().render({ force: true });
}

/**
 * Register world setup settings.
 */
export function registerWorldSetupSettings() {
  // Hidden flag — tracks whether first-run setup has been completed
  game.settings.register(SYSTEM_ID, 'worldInitialized', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
  });

  // Menu button to re-run setup
  game.settings.register(SYSTEM_ID, 'rerunWorldSetup', {
    name: 'NEONRELIC.WorldSetup.RerunName',
    hint: 'NEONRELIC.WorldSetup.RerunHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: value => {
      if (value && game.user.isGM) {
        // Reset the flag and show dialog
        game.settings.set(SYSTEM_ID, 'rerunWorldSetup', false);
        game.settings.set(SYSTEM_ID, 'worldInitialized', false);
        new WorldSetupApp().render({ force: true });
      }
    },
  });
}
