/**
 * Session tracking and once-per-session reset.
 * @module system/session-tracker
 */

/**
 * Perform a session reset — resets once-per-session talent uses,
 * clears temporary effects, and advances session counter.
 * @returns {Promise<void>}
 */
export async function performSessionReset() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('NEONRELIC.Session.GMOnly'));
    return;
  }

  const alreadyReset = game.settings.get('neon-relic', 'sessionResetDone');
  if (alreadyReset) {
    ui.notifications.info(game.i18n.localize('NEONRELIC.Session.AlreadyReset'));
    return;
  }

  // Reset all agents
  for (const actor of game.actors) {
    if (actor.type === 'agent') {
      await actor.resetSession?.();
    }
  }

  // Advance session counter
  const currentSession = game.settings.get('neon-relic', 'currentSession');
  await game.settings.set('neon-relic', 'currentSession', currentSession + 1);
  await game.settings.set('neon-relic', 'sessionResetDone', true);

  ui.notifications.info(game.i18n.localize('NEONRELIC.Session.ResetComplete'));

  // Broadcast to other clients
  const { emitSocket, SOCKET_EVENTS } = await import('./sockets.mjs');
  emitSocket(SOCKET_EVENTS.SESSION_RESET);
}

/**
 * Clear the session reset flag (called at session start).
 * @returns {Promise<void>}
 */
export async function clearSessionResetFlag() {
  if (game.user.isGM) {
    await game.settings.set('neon-relic', 'sessionResetDone', false);
  }
}
