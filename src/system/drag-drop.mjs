/**
 * Drag-and-drop support for Neon Relic.
 * Handles dropping items, actors, and macros on sheets and hotbar.
 */

/**
 * Handle item drops on actor sheets.
 * Validates item type is allowed on the target actor.
 * @param {NeonRelicActor} actor - Target actor.
 * @param {object} data - Drop data from the event.
 * @returns {Promise<NeonRelicItem|false>} Created item or false if rejected.
 */
export async function handleItemDrop(actor, data) {
  if (data.type !== 'Item') return false;
  const item = await Item.implementation.fromDropData(data);
  if (!item) return false;

  // Validate item type restrictions per actor type
  const restrictions = {
    agent: ['weapon', 'armor', 'gear', 'consumable', 'artifact', 'talent', 'criticalInjury', 'anchor', 'darkSecret'],
    npc: ['weapon', 'armor', 'gear', 'consumable', 'artifact', 'talent', 'criticalInjury'],
    mob: ['weapon', 'armor', 'gear'],
    vehicle: ['weapon', 'gear', 'upgrade'],
    headquarters: ['upgrade', 'location'],
  };

  const allowed = restrictions[actor.type] ?? [];
  if (!allowed.includes(item.type)) {
    ui.notifications.warn(game.i18n.format('NEONRELIC.Drop.InvalidType', { type: item.type, actor: actor.type }));
    return false;
  }

  // Create the item on the actor
  return actor.createEmbeddedDocuments('Item', [item.toObject()]);
}

/**
 * Handle creating a macro from a dropped item on the hotbar.
 * @param {object} data - Drop data from the event.
 * @param {number} slot - Hotbar slot number.
 * @returns {Promise<Macro|false>} Created macro or false.
 */
export async function handleHotbarDrop(data, slot) {
  if (data.type !== 'Item') return false;
  const item = await Item.implementation.fromDropData(data);
  if (!item) return false;

  // Create a macro that uses the item
  const macro = await Macro.create({
    name: item.name,
    type: 'script',
    img: item.img,
    command: `const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if (!actor) return ui.notifications.warn('Select a token.');
const item = actor.items.getName('${item.name.replace(/'/g, "\\'")}');
if (!item) return ui.notifications.warn('Item not found.');
item.sheet.render(true);`,
  });

  if (macro) game.user.assignHotbarMacro(macro, slot);
  return false; // Prevent default
}
