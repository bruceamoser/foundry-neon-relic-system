/**
 * YZE Combat module integration for Neon Relic.
 * Hooks into the yearzero-combat module for enhanced combat tracking.
 */

export function registerYZECombat() {
  Hooks.once('ready', () => {
    // Check if YZE Combat module is active
    if (!game.modules.get('yearzero-combat')?.active) return;
    console.log('neon-relic | YZE Combat module detected, registering integration');

    // Register Neon Relic initiative configuration
    if (game.yearzero?.combat) {
      game.yearzero.combat.register('neon-relic', {
        // Card-draw initiative (Ace=1 through 10)
        initiativeFormula: '1d10',
        initiativeDecimals: 0,
        // Support for slow/fast actions
        actionTypes: ['slow', 'fast'],
        // Custom initiative card labels
        cardLabels: {
          1: 'Ace',
          2: '2',
          3: '3',
          4: '4',
          5: '5',
          6: '6',
          7: '7',
          8: '8',
          9: '9',
          10: '10',
        },
      });
    }
  });
}
