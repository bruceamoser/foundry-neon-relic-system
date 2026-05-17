import fs from 'fs-extra';
import gulp from 'gulp';
import yaml from 'gulp-yaml';
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
      await fs.copy(
        file,
        `${distDirectory}/templates/${file.replace(`${sourceDirectory}/`, '').replace('templates/', '')}`,
      );
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
 * Placeholder — will be implemented when compendium content is created.
 */
async function buildPacks() {
  const packDir = `${sourceDirectory}/packs`;
  if (!fs.existsSync(packDir)) return;
  const files = await fs.readdir(packDir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  if (yamlFiles.length === 0) return;
  // LevelDB compilation will be added when packs have content
  console.log(`neon-relic | Found ${yamlFiles.length} pack source files (compilation pending)`);
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
