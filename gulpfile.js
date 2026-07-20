import fs from 'fs-extra';
import gulp from 'gulp';
import yaml from 'gulp-yaml';
import YAML from 'js-yaml';
import crypto from 'node:crypto';
import { ClassicLevel } from 'classic-level';
import esBuild from './esbuild.config.js';

/* ------------------------------------------ */
/*  Configuration                             */
/* ------------------------------------------ */

const sourceDirectory = './src';
const distDirectory = './dist';
const templateExt = 'hbs';
const langGlob = `${sourceDirectory}/lang/**/*.{yml,yaml}`;
const staticFiles = ['system.json', 'assets', 'fonts'];

/* ------------------------------------------ */
/*  Build                                     */
/* ------------------------------------------ */

/**
 * Builds the distributable JavaScript and CSS via esbuild.
 */
async function buildSource({ watch } = {}) {
  await esBuild({ watch });
}

/* ------------------------------------------ */

/**
 * Copies all Handlebars template files to dist.
 */
async function pipeTemplates() {
  const { glob } = await import('glob');
  const templateFiles = await glob(`${sourceDirectory}/**/*.${templateExt}`);
  if (templateFiles && templateFiles.length > 0) {
    for (const file of templateFiles) {
      // Normalize to forward slashes and strip src/ and templates/ prefixes.
      const normalized = file.replace(/\\/g, '/');
      const relPath = normalized.replace(/^\.?\/?src\/templates\//, '');
      await fs.copy(file, `${distDirectory}/templates/${relPath}`);
    }
  }
}

/* ------------------------------------------ */

/**
 * Compiles YAML translation files to JSON.
 */
function pipeTranslations() {
  return gulp
    .src(langGlob)
    .pipe(yaml({ safe: true }))
    .pipe(gulp.dest(`${distDirectory}/lang`));
}

/* ------------------------------------------ */

/**
 * Copies static files (system.json, assets, fonts) to dist.
 */
async function pipeStatics() {
  for (const file of staticFiles) {
    if (fs.existsSync(`static/${file}`)) {
      await fs.copy(`static/${file}`, `${distDirectory}/${file}`);
    }
  }
}

/* ------------------------------------------ */

/**
 * Compiles YAML pack source files to LevelDB compendium packs.
 */
async function buildPacks() {
  const packDir = `${sourceDirectory}/packs`;
  if (!fs.existsSync(packDir)) return;
  const files = await fs.readdir(packDir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  if (yamlFiles.length === 0) return;

  const outputDir = `${distDirectory}/packs`;
  await fs.ensureDir(outputDir);

  // Map YAML type values to Foundry document types and LevelDB key prefixes.
  const ITEM_TYPES = new Set([
    'weapon',
    'armor',
    'gear',
    'consumable',
    'artifact',
    'talent',
    'criticalInjury',
    'anchor',
    'darkSecret',
    'upgrade',
    'location',
    'informationCard',
    'playerCaseBrief',
    'daCaseBrief',
    'subdivision',
    'organization',
  ]);
  const ACTOR_TYPES = new Set(['agent', 'npc', 'mob', 'vehicle', 'headquarters']);

  for (const file of yamlFiles) {
    const raw = await fs.readFile(`${packDir}/${file}`, 'utf8');
    const documents = YAML.load(raw);
    if (!Array.isArray(documents) || documents.length === 0) continue;

    const packName = file.replace(/\.(yaml|yml)$/, '');
    const packPath = `${outputDir}/${packName}`;

    // Clean and create LevelDB directory.
    await fs.remove(packPath);
    const db = new ClassicLevel(packPath, { keyEncoding: 'utf8', valueEncoding: 'json' });

    let count = 0;
    for (const doc of documents) {
      const entries = _transformDocument(doc, ITEM_TYPES, ACTOR_TYPES);
      if (!entries) {
        console.warn(`neon-relic | Unknown type "${doc.type}" in ${file}, skipping`);
        continue;
      }
      // _transformDocument returns an array of {key, data} entries
      for (const entry of entries) {
        await db.put(entry.key, entry.data);
      }
      count++;
    }

    // Force compaction from WAL (.log) to SST (.ldb) before closing.
    // Without this, Foundry may create phantom index entries when reading
    // un-compacted LevelDB data.
    await db.compactRange('\x00', '\xff');
    await db.close();
    console.log(`neon-relic | Compiled ${count} entries → packs/${packName}`);
  }
}

/* ------------------------------------------ */
/*  ID Generation                             */
/* ------------------------------------------ */

// Characters used by Foundry's randomID()
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a deterministic 16-character Foundry-compatible ID from a slug.
 * Uses SHA-256 hash to map arbitrary slugs to the Base62 alphabet Foundry expects.
 * @param {string} slug - Human-readable ID from YAML (e.g. "macro001").
 * @returns {string} 16-character alphanumeric ID.
 */
function toFoundryId(slug) {
  const hash = crypto.createHash('sha256').update(slug).digest();
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += ID_CHARS[hash[i] % ID_CHARS.length];
  }
  return id;
}

/**
 * Transform a YAML source document into Foundry-native LevelDB entries.
 * Returns an array of {key, data} entries. For journals, this includes
 * separate entries for pages (Foundry V14 requirement).
 * @param {object} doc - Parsed YAML document.
 * @param {Set} itemTypes - Set of Item sub-types.
 * @param {Set} actorTypes - Set of Actor sub-types.
 * @returns {Array<{key: string, data: object}>|null}
 */
function _transformDocument(doc, itemTypes, actorTypes) {
  const id = toFoundryId(doc._id);

  if (itemTypes.has(doc.type)) {
    return [
      {
        key: `!items!${id}`,
        data: {
          _id: id,
          name: doc.name,
          type: doc.type,
          img: doc.img || '',
          system: doc.system || {},
          effects: doc.effects || [],
          flags: doc.flags || {},
          folder: doc.folder || null,
          sort: doc.sort || 0,
          ownership: doc.ownership || { default: 0 },
          _stats: doc._stats || {},
        },
      },
    ];
  }

  if (actorTypes.has(doc.type)) {
    return [
      {
        key: `!actors!${id}`,
        data: {
          _id: id,
          name: doc.name,
          type: doc.type,
          img: doc.img || '',
          system: doc.system || {},
          items: doc.items || [],
          effects: doc.effects || [],
          flags: doc.flags || {},
          folder: doc.folder || null,
          sort: doc.sort || 0,
          ownership: doc.ownership || { default: 0 },
          prototypeToken: doc.prototypeToken || {},
          _stats: doc._stats || {},
        },
      },
    ];
  }

  if (doc.type === 'macro') {
    return [
      {
        key: `!macros!${id}`,
        data: {
          _id: id,
          name: doc.name,
          type: doc.system?.macroType || 'script',
          img: doc.img || 'icons/svg/dice-target.svg',
          command: doc.system?.script || '',
          flags: doc.flags || {},
          folder: doc.folder || null,
          sort: doc.sort || 0,
          ownership: doc.ownership || { default: 0 },
          _stats: doc._stats || {},
        },
      },
    ];
  }

  if (doc.type === 'rollTable') {
    const results = (doc.system?.entries || []).map((e, i) => ({
      _id: toFoundryId(`${doc._id}r${String(i + 1).padStart(3, '0')}`),
      type: 0,
      text: e.result,
      range: e.range,
      weight: 1,
      drawn: false,
      flags: {},
    }));

    // Foundry V14: table results are stored as separate LevelDB entries
    // (similar to journal pages), referenced by ID in the parent document.
    const entries = [
      {
        key: `!tables!${id}`,
        data: {
          _id: id,
          name: doc.name,
          img: doc.img || 'icons/svg/d20-grey.svg',
          formula: doc.system?.formula || '1d6',
          replacement: true,
          displayRoll: true,
          results: results.map(r => r._id),
          flags: doc.flags || {},
          folder: doc.folder || null,
          sort: doc.sort || 0,
          ownership: doc.ownership || { default: 0 },
          _stats: doc._stats || {},
        },
      },
    ];

    // Add each result as a separate LevelDB entry
    for (const result of results) {
      entries.push({
        key: `!tables.results!${id}.${result._id}`,
        data: result,
      });
    }

    return entries;
  }

  if (doc.type === 'journalEntry' || doc.type === 'JournalEntry') {
    let pages;
    if (Array.isArray(doc.pages)) {
      // New format: explicit pages array (rules-reference, etc.)
      pages = doc.pages.map((p, i) => ({
        _id: toFoundryId(`${doc._id}p${String(i + 1).padStart(3, '0')}`),
        name: p.name,
        type: p.type || 'text',
        text: { content: p.text?.content || '', format: 1 },
        sort: i * 100000,
        flags: {},
        ownership: { default: -1 },
        _stats: {},
      }));
    } else {
      // Legacy format: single page from system.summary
      pages = [
        {
          _id: toFoundryId(`${doc._id}p001`),
          name: doc.name,
          type: 'text',
          text: { content: doc.system?.summary || '', format: 1 },
          sort: 0,
          flags: {},
          ownership: { default: -1 },
          _stats: {},
        },
      ];
    }

    // Foundry V14: pages are stored as separate LevelDB entries AND referenced
    // by ID in the journal document's pages array.
    const entries = [
      {
        key: `!journal!${id}`,
        data: {
          _id: id,
          name: doc.name,
          pages: pages.map(p => p._id),
          flags: doc.flags || {},
          folder: doc.folder || null,
          sort: doc.sort || 0,
          ownership: doc.ownership || { default: 0 },
          _stats: doc._stats || {},
        },
      },
    ];

    // Add each page as a separate entry
    for (const page of pages) {
      entries.push({
        key: `!journal.pages!${id}.${page._id}`,
        data: page,
      });
    }

    return entries;
  }

  return null;
}

/* ------------------------------------------ */
/*  Clean                                     */
/* ------------------------------------------ */

/**
 * Removes the dist directory.
 */
async function cleanDist() {
  if (fs.existsSync(distDirectory)) {
    await fs.remove(distDirectory);
  }
}

/* ------------------------------------------ */
/*  Watch                                     */
/* ------------------------------------------ */

/**
 * Watches for source changes and rebuilds incrementally.
 */
function buildWatch() {
  buildSource({ watch: true });
  gulp.watch(`${sourceDirectory}/**/*.${templateExt}`, { ignoreInitial: false }, pipeTemplates);
  gulp.watch(langGlob, { ignoreInitial: false }, pipeTranslations);
  gulp.watch(
    staticFiles.map(file => `static/${file}`),
    { ignoreInitial: false },
    pipeStatics,
  );
}

/* ------------------------------------------ */
/*  Export                                    */
/* ------------------------------------------ */

const build = gulp.parallel(buildSource, pipeTemplates, pipeTranslations, pipeStatics, buildPacks);

export { cleanDist as clean };
export { build };
export { buildWatch as watch };
export default build;
