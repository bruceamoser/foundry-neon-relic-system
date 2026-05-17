/**
 * Accessibility features for Neon Relic.
 * ARIA attributes, keyboard navigation, and screen reader support.
 */

/**
 * Enhance sheet elements with ARIA attributes.
 * Called during sheet render to add accessibility metadata.
 * @param {HTMLElement} html - The sheet's root HTML element.
 * @param {object} context - The sheet render context.
 */
export function enhanceAccessibility(html, context) {
  // Add ARIA labels to attribute boxes
  html.querySelectorAll('.attribute-box').forEach(box => {
    const label = box.querySelector('.attribute-label')?.textContent?.trim();
    if (label) {
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', label);
    }
  });

  // Add ARIA labels to skill rows
  html.querySelectorAll('.skill-row').forEach(row => {
    const label = row.querySelector('.skill-name')?.textContent?.trim();
    if (label) {
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', label);
    }
  });

  // Make roll buttons accessible
  html.querySelectorAll('[data-action="roll"]').forEach(btn => {
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    if (!btn.getAttribute('aria-label')) {
      const text = btn.textContent?.trim();
      if (text) btn.setAttribute('aria-label', `Roll ${text}`);
    }
    // Support Enter/Space activation
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  // Add live region for corruption changes
  let liveRegion = html.querySelector('.nr-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.classList.add('nr-live-region');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
    html.appendChild(liveRegion);
  }

  // Add corruption track ARIA
  const corruptionTrack = html.querySelector('.corruption-track');
  if (corruptionTrack && context?.corruption) {
    corruptionTrack.setAttribute('role', 'progressbar');
    corruptionTrack.setAttribute('aria-valuemin', '0');
    corruptionTrack.setAttribute('aria-valuemax', String(context.corruption.max));
    corruptionTrack.setAttribute('aria-valuenow', String(context.corruption.value));
    corruptionTrack.setAttribute('aria-label', `Corruption: ${context.corruption.value} of ${context.corruption.max}`);
  }
}

/**
 * Announce a message to screen readers via ARIA live region.
 * @param {string} message - The message to announce.
 */
export function announceToScreenReader(message) {
  const region = document.querySelector('.nr-live-region');
  if (region) {
    region.textContent = message;
  }
}
