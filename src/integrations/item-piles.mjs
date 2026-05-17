/**
 * Item Piles module integration for Neon Relic.
 * Configures item types for loot/merchant/vault functionality.
 */

export function registerItemPiles() {
  Hooks.once('ready', () => {
    // Check if Item Piles module is active
    if (!game.modules.get('item-piles')?.active) return;
    console.log('neon-relic | Item Piles module detected, registering integration');

    // Register system-specific configuration
    if (game.itempiles) {
      game.itempiles.API.addSystemIntegration({
        // Version of the integration
        VERSION: '1.0.0',

        // Actor class type used for item piles
        ACTOR_CLASS_TYPE: 'npc',

        // Item quantity attribute path
        ITEM_QUANTITY_ATTRIBUTE: 'system.quantity',

        // Item price attribute path
        ITEM_PRICE_ATTRIBUTE: 'system.price',

        // Item filters — types that can be looted/traded
        ITEM_FILTERS: [{ path: 'type', filters: 'weapon,armor,gear,consumable,artifact' }],

        // Unstackable item types
        UNSTACKABLE_ITEM_TYPES: ['artifact', 'talent', 'criticalInjury'],

        // Currency configuration
        CURRENCIES: [
          {
            type: 'attribute',
            name: 'Requisition Points',
            img: 'systems/neon-relic/assets/icons/gear-default.svg',
            abbreviation: '{#}RP',
            data: { path: 'system.requisition' },
            primary: true,
            exchangeRate: 1,
          },
        ],
      });
    }
  });
}
