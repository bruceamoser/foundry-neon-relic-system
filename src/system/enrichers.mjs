/**
 * Text enrichers for Neon Relic inline content references.
 * Registers custom enricher patterns that transform inline references
 * to interactive elements in journal entries and descriptions.
 */

/**
 * Register text enrichers for the system.
 * Patterns: @Check[skill], @Corruption[amount], @Artifact[name], @Condition[name]
 */
export function registerTextEnrichers() {
  // @Check[skill difficulty] — inline skill check reference
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Check\[(?<skill>\w+)\s*(?<diff>\d+)?\]/gi,
    enricher: enrichCheckReference,
  });

  // @Corruption[amount] — inline corruption reference
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Corruption\[(?<amount>\d+)\]/gi,
    enricher: enrichCorruptionReference,
  });

  // @Artifact\[name\] — inline artifact reference
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Artifact\[(?<name>[^\]]+)\]/gi,
    enricher: enrichArtifactReference,
  });

  // @Condition[name] — inline condition reference
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Condition\[(?<name>\w+)\]/gi,
    enricher: enrichConditionReference,
  });
}

/**
 * Enrich a @Check reference into a clickable skill check element.
 * @param {RegExpMatchArray} match - Regex match.
 * @param {object} _options - Enricher options.
 * @returns {HTMLElement} Enriched element.
 */
function enrichCheckReference(match, _options) {
  const skill = match.groups.skill;
  const diff = match.groups.diff ?? '';
  const label = game.i18n.localize(`NEONRELIC.Skill.${skill.charAt(0).toUpperCase() + skill.slice(1)}`) || skill;

  const a = document.createElement('a');
  a.classList.add('nr-enricher', 'nr-check');
  a.dataset.action = 'roll-check';
  a.dataset.skill = skill;
  if (diff) a.dataset.difficulty = diff;
  a.innerHTML = `<i class="fas fa-dice-d6"></i> ${label}${diff ? ` (${diff})` : ''}`;
  a.title = `Roll ${label}${diff ? ` Difficulty ${diff}` : ''}`;
  return a;
}

/**
 * Enrich a @Corruption reference into a styled corruption element.
 * @param {RegExpMatchArray} match - Regex match.
 * @param {object} _options - Enricher options.
 * @returns {HTMLElement} Enriched element.
 */
function enrichCorruptionReference(match, _options) {
  const amount = match.groups.amount;
  const span = document.createElement('span');
  span.classList.add('nr-enricher', 'nr-corruption');
  span.innerHTML = `<i class="fas fa-skull"></i> ${amount} ${game.i18n.localize('NEONRELIC.Corruption.Label')}`;
  span.title = `${amount} Corruption`;
  return span;
}

/**
 * Enrich an @Artifact reference into a link to the artifact.
 * @param {RegExpMatchArray} match - Regex match.
 * @param {object} _options - Enricher options.
 * @returns {HTMLElement} Enriched element.
 */
function enrichArtifactReference(match, _options) {
  const name = match.groups.name;
  const a = document.createElement('a');
  a.classList.add('nr-enricher', 'nr-artifact');
  a.dataset.action = 'view-artifact';
  a.dataset.name = name;
  a.innerHTML = `<i class="fas fa-gem"></i> ${name}`;
  a.title = `View artifact: ${name}`;
  return a;
}

/**
 * Enrich a @Condition reference into a styled condition badge.
 * @param {RegExpMatchArray} match - Regex match.
 * @param {object} _options - Enricher options.
 * @returns {HTMLElement} Enriched element.
 */
function enrichConditionReference(match, _options) {
  const name = match.groups.name;
  const label = game.i18n.localize(`NEONRELIC.Condition.${name}`) || name;
  const span = document.createElement('span');
  span.classList.add('nr-enricher', 'nr-condition');
  span.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${label}`;
  span.title = label;
  return span;
}
