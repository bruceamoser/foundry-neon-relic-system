/**
 * Linked-document resolution utilities.
 *
 * Neon Relic mission content is authored in compendium packs and imported into
 * the world by the content installers, which keep document IDs stable. Stored
 * link UUIDs (case board card lists, information web links, dropped docs) often
 * reference the compendium original — at runtime those must prefer the imported
 * world copy so that clicking a link opens (and edits/updates target) the world
 * document. When the content has not been imported the compendium document is
 * used as-is.
 * @module system/document-links
 */

/**
 * Resolve a document UUID, preferring the world copy when the resolved document
 * lives in a compendium and an imported copy exists (same document ID).
 * @param {string} uuid
 * @returns {Promise<foundry.abstract.Document|null>}
 */
export async function resolveLinkedDoc(uuid) {
  const doc = await fromUuid(uuid).catch(() => null);
  if (!doc || !doc.pack || doc.isEmbedded) return doc;
  const world = game.collections.get(doc.documentName)?.get(doc.id);
  return world ?? doc;
}

/**
 * Resolve a UUID to the preferred (world-first) UUID string. Falls back to the
 * original UUID when the document cannot be resolved.
 * @param {string} uuid
 * @returns {Promise<string>}
 */
export async function resolveLinkedUuid(uuid) {
  const doc = await resolveLinkedDoc(uuid);
  return doc?.uuid ?? uuid;
}
