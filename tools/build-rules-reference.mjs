#!/usr/bin/env node
/**
 * Build Rules Reference — Convert AsciiDoc chapters to Foundry VTT journal HTML.
 *
 * Usage:
 *   node tools/build-rules-reference.mjs [--source <dir>] [--output <file>]
 *
 * Defaults:
 *   --source  ../neon-relic/docs/chapters
 *   --output  src/packs/rules-reference.yaml
 *
 * Reads all .adoc files from the source directory, converts each to HTML
 * using Asciidoctor.js, and emits a YAML pack file containing a single
 * JournalEntry with one JournalEntryPage per chapter.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import Asciidoctor from '@asciidoctor/core';

const asciidoctor = Asciidoctor();

/** Default paths relative to the repo root. */
const DEFAULTS = {
  source: resolve(import.meta.dirname, '../../neon-relic/docs/chapters'),
  output: resolve(import.meta.dirname, '../src/packs/rules-reference.yaml'),
};

/**
 * Parse CLI arguments.
 * @returns {{source: string, output: string}}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { ...DEFAULTS };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) opts.source = resolve(args[++i]);
    if (args[i] === '--output' && args[i + 1]) opts.output = resolve(args[++i]);
  }
  return opts;
}

/**
 * Read and convert all .adoc files in a directory.
 * @param {string} dir  Path to the chapters directory.
 * @returns {Promise<Array<{name: string, slug: string, html: string}>>}
 */
async function convertChapters(dir) {
  const files = (await readdir(dir)).filter(f => f.endsWith('.adoc')).sort();
  const pages = [];
  for (const file of files) {
    const content = await readFile(join(dir, file), 'utf-8');
    const doc = asciidoctor.load(content, { safe: 'safe', backend: 'html5' });
    const title = doc.getDoctitle() || basename(file, '.adoc').replace(/^\d+-/, '').replace(/-/g, ' ');
    const slug = basename(file, '.adoc');
    const html = doc.convert();
    pages.push({ name: title, slug, html });
  }
  return pages;
}

/**
 * Escape a string for safe inclusion in single-quoted YAML.
 * @param {string} str
 * @returns {string}
 */
function yamlEscape(str) {
  return str.replace(/'/g, "''");
}

/**
 * Build the YAML pack content.
 * @param {Array<{name: string, slug: string, html: string}>} pages
 * @returns {string}
 */
function buildYaml(pages) {
  const lines = [
    '# Rules Reference — Auto-generated from AsciiDoc chapters',
    '# Do not edit manually. Run: npm run build:rules',
    '---',
    '- _id: rules-reference',
    '  name: Rules Reference',
    '  type: journal',
    '  pages:',
  ];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    lines.push(`    - _id: rules-p${String(i + 1).padStart(2, '0')}`);
    lines.push(`      name: '${yamlEscape(page.name)}'`);
    lines.push(`      type: text`);
    lines.push(`      text:`);
    lines.push(`        format: 1`);
    lines.push(`        content: '${yamlEscape(page.html)}'`);
    lines.push(`      sort: ${(i + 1) * 100000}`);
  }
  return lines.join('\n') + '\n';
}

/* ── Main ───────────────────────────────────── */

async function main() {
  const opts = parseArgs();

  console.log(`[build-rules-reference] Source: ${opts.source}`);
  console.log(`[build-rules-reference] Output: ${opts.output}`);

  const pages = await convertChapters(opts.source);
  console.log(`[build-rules-reference] Converted ${pages.length} chapters.`);

  const yaml = buildYaml(pages);
  await writeFile(opts.output, yaml, 'utf-8');
  console.log(`[build-rules-reference] Wrote ${opts.output}`);
}

main().catch(err => {
  console.error('[build-rules-reference] Error:', err.message);
  process.exit(1);
});
