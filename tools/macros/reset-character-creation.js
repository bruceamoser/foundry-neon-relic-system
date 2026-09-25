/* Neon Relic — start character creation over for one character.
 *
 * Mirrors the sheet's "Reset Character Creation" action: name, identity fields,
 * attributes and skills go back to defaults and the wizard is re-enabled.
 * Run from the Foundry console (F12) as the GM. ITEMs are not deleted here —
 * remove talents/anchor/dark-secret by hand if you want a clean slate.
 */
(async () => {
  const actor =
    canvas.tokens?.controlled?.[0]?.actor ?? game.user.character ?? game.actors.find(a => a.type === 'agent');
  if (!actor) return ui.notifications.error('No agent found — select the token first.');
  if (!game.user.isGM) return ui.notifications.error('GM only.');
  if (
    !(await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Reset Character Creation' },
      content: `<p>Clear <strong>${actor.name}</strong>'s creation data and re-enable the wizard?</p>`,
    }))
  )
    return;

  const CONFIG_NR = CONFIG.NEON_RELIC;
  const skillReset = Object.fromEntries(Object.keys(CONFIG_NR.skills).map(k => [`system.skills.${k}`, 0]));

  await actor.update({
    name: 'New Agent',
    'system.division': '',
    'system.subUnit': '',
    'system.specialty': '',
    'system.ageGroup': 'experienced',
    'system.age': 0,
    'system.sex': '',
    'system.countryOfOrigin': '',
    'system.attributes.str.max': 3,
    'system.attributes.str.value': 3,
    'system.attributes.agi.max': 3,
    'system.attributes.agi.value': 3,
    'system.attributes.wit.max': 3,
    'system.attributes.wit.value': 3,
    'system.attributes.emp.max': 3,
    'system.attributes.emp.value': 3,
    'system.creationComplete': false,
    ...skillReset,
  });

  ui.notifications.info(`${actor.name}: creation reset — open the sheet and launch the wizard.`);
})();
