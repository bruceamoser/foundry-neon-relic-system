/**
 * Talent Picker Dialog — filtered by slot type.
 * Shows available talents for a specific slot and allows selection.
 * @module actor/agent/talent-picker
 */

const SYSTEM_ID = 'neon-relic';
const TEMPLATE = `systems/${SYSTEM_ID}/templates/actor/agent/wizard/talent-picker.hbs`;

/**
 * Map talentType values to i18n key suffixes.
 */
const TALENT_TYPE_KEYS = {
  general: 'General',
  division: 'Division',
  subunit: 'SubUnit',
  background: 'Background',
};

/**
 * Open a talent picker dialog for a specific slot.
 * @param {object} options
 * @param {'division'|'subunit'|'background'} options.slotType  Which slot to pick for.
 * @param {string} options.division  The agent's division key (e.g. 'wayfinder').
 * @param {string} options.talentKey  The agent's sub-unit talent key (e.g. 'research').
 * @param {string} options.subUnitName  The agent's sub-unit display name (e.g. 'Research Wing').
 * @returns {Promise<Item|null>}  The selected compendium talent item, or null if cancelled.
 */
export async function openTalentPicker({ slotType, division, talentKey, subUnitName }) {
  const pack = game.packs.get('neon-relic.talents');
  if (!pack) {
    ui.notifications.error('Talents compendium not found.');
    return null;
  }

  const allTalents = await pack.getDocuments();
  let filtered = [];
  let hint = '';

  const divisionLabel = game.i18n.localize(CONFIG.NEON_RELIC.divisions[division] ?? '') || division;

  if (slotType === 'division') {
    filtered = allTalents.filter(t => {
      const tt = t.system.talentType;
      if (tt === 'general') return true;
      if (tt === 'division') return !t.system.division || t.system.division === division;
      return false;
    });
    hint = game.i18n.format('NEONRELIC.Wizard.Talents.PickerHintSlot1', { division: divisionLabel });
  } else if (slotType === 'subunit') {
    filtered = allTalents.filter(t => {
      if (t.system.talentType !== 'subunit') return false;
      return t.system.subUnit === talentKey;
    });
    hint = game.i18n.format('NEONRELIC.Wizard.Talents.PickerHintSlot2', { subUnit: subUnitName });
  } else if (slotType === 'background') {
    filtered = allTalents.filter(t => t.system.talentType === 'background');
    hint = game.i18n.localize('NEONRELIC.Wizard.Talents.PickerHintSlot3');
  }

  // Sort alphabetically within groups; division talents first, then general
  filtered.sort((a, b) => {
    if (slotType === 'division') {
      const aIsDivision = a.system.talentType === 'division' ? 0 : 1;
      const bIsDivision = b.system.talentType === 'division' ? 0 : 1;
      if (aIsDivision !== bIsDivision) return aIsDivision - bIsDivision;
    }
    return a.name.localeCompare(b.name);
  });

  const talentData = filtered.map(t => ({
    uuid: t.uuid,
    name: t.name,
    img: t.img,
    effect: t.system.effect ? _truncate(t.system.effect, 120) : '',
    corruptionCost: t.system.corruptionCost || 0,
    typeLabel: game.i18n.localize(
      `NEONRELIC.TalentType.${TALENT_TYPE_KEYS[t.system.talentType] ?? t.system.talentType}`,
    ),
  }));

  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    talents: talentData,
    hint,
  });

  return new Promise(resolve => {
    const dlg = new foundry.applications.api.DialogV2({
      window: {
        title: game.i18n.localize('NEONRELIC.Wizard.Talents.PickerTitle'),
        icon: 'fa-solid fa-bolt',
      },
      classes: [SYSTEM_ID, 'talent-picker-dialog'],
      position: { width: 480, height: 520 },
      content,
      buttons: [
        {
          action: 'cancel',
          label: game.i18n.localize('Cancel'),
          icon: 'fas fa-times',
        },
      ],
      close: () => resolve(null),
    });

    dlg.render(true);

    // After render, attach click and search handlers
    dlg.addEventListener('render', () => {
      const el = dlg.element;

      // Click a talent to select it
      el.querySelectorAll('.talent-entry').forEach(entry => {
        entry.addEventListener('click', async () => {
          const uuid = entry.dataset.uuid;
          const item = await fromUuid(uuid);
          resolve(item);
          dlg.close();
        });
      });

      // Live search filter
      const searchInput = el.querySelector('.talent-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const query = searchInput.value.toLowerCase().trim();
          el.querySelectorAll('.talent-entry').forEach(entry => {
            const name = entry.querySelector('.talent-name').textContent.toLowerCase();
            const effect = entry.querySelector('.talent-effect')?.textContent.toLowerCase() || '';
            entry.style.display = name.includes(query) || effect.includes(query) ? '' : 'none';
          });
        });
      }
    });
  });
}

/**
 * Truncate a string to a maximum length with ellipsis.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function _truncate(str, max) {
  if (!str) return '';
  // Strip HTML tags for display
  const text = str.replace(/<[^>]+>/g, '');
  return text.length > max ? text.slice(0, max) + '…' : text;
}
