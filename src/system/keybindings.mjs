/**
 * Keyboard shortcuts for Neon Relic game actions.
 * Registers keybindings in the Foundry keybinding system.
 */

export function registerKeybindings() {
  game.keybindings.register('neon-relic', 'rollAttribute', {
    name: 'NEONRELIC.Keybinding.RollAttribute',
    hint: 'NEONRELIC.Keybinding.RollAttributeHint',
    editable: [{ key: 'KeyR', modifiers: ['Shift'] }],
    onDown: () => {
      const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
      if (!actor) return ui.notifications.warn('Select a token or assign a character.');
      actor.sheet._onRollAttribute?.({ currentTarget: { dataset: { attribute: 'str' } } });
    },
  });

  game.keybindings.register('neon-relic', 'openSheet', {
    name: 'NEONRELIC.Keybinding.OpenSheet',
    hint: 'NEONRELIC.Keybinding.OpenSheetHint',
    editable: [{ key: 'KeyC', modifiers: ['Shift'] }],
    onDown: () => {
      const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
      if (actor) actor.sheet.render(true);
    },
  });

  game.keybindings.register('neon-relic', 'shortRest', {
    name: 'NEONRELIC.Keybinding.ShortRest',
    hint: 'NEONRELIC.Keybinding.ShortRestHint',
    editable: [{ key: 'KeyH', modifiers: ['Shift'] }],
    onDown: () => {
      const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
      if (actor) actor.shortRest?.();
    },
  });
}
