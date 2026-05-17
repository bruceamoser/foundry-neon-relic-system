/**
 * Dice So Nice (3D dice) integration for Neon Relic.
 * Registers a custom Neon Relic dice preset with green/dark theme.
 */

export function registerDiceSoNice() {
  Hooks.once('diceSoNiceReady', dice3d => {
    // Register the Neon Relic dice color set
    dice3d.addColorset({
      name: 'neon-relic',
      description: 'Neon Relic',
      category: 'Neon Relic',
      foreground: '#4ade80',
      background: '#0a0a0a',
      outline: '#1a5c1a',
      edge: '#166534',
      texture: 'none',
      material: 'plastic',
      font: 'Arial',
      fontScale: {},
      visibility: 'visible',
    });

    // Register the corruption dice color set (purple)
    dice3d.addColorset({
      name: 'neon-relic-corruption',
      description: 'Neon Relic Corruption',
      category: 'Neon Relic',
      foreground: '#c4b5fd',
      background: '#2d1b4e',
      outline: '#6b21a8',
      edge: '#4c1d95',
      texture: 'none',
      material: 'plastic',
      font: 'Arial',
      fontScale: {},
      visibility: 'visible',
    });

    // Register the artifact dice color set (gold)
    dice3d.addColorset({
      name: 'neon-relic-artifact',
      description: 'Neon Relic Artifact',
      category: 'Neon Relic',
      foreground: '#fef3c7',
      background: '#78350f',
      outline: '#f59e0b',
      edge: '#d97706',
      texture: 'none',
      material: 'metal',
      font: 'Arial',
      fontScale: {},
      visibility: 'visible',
    });

    // Set default system preset
    dice3d.addSystem({ id: 'neon-relic', name: 'Neon Relic' }, 'preferred');
  });
}
