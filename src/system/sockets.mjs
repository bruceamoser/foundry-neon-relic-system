/**
 * Socket events for multi-user state synchronization.
 * @module system/sockets
 */

const SOCKET_NAME = 'system.neon-relic';

/**
 * Socket event types.
 */
export const SOCKET_EVENTS = {
  CORRUPTION_GAINED: 'corruptionGained',
  CORRUPTION_STAGE: 'corruptionStage',
  THREAT_ADVANCED: 'threatAdvanced',
  INITIATIVE_DRAWN: 'initiativeDrawn',
  GEAR_DEGRADED: 'gearDegraded',
  SESSION_RESET: 'sessionReset',
  CASE_FILE_RESET: 'caseFileReset',
  OPS_BOARD_UPDATE: 'opsBoardUpdate',
};

/**
 * Register socket listener.
 */
export function registerSocketListeners() {
  game.socket.on(SOCKET_NAME, data => {
    switch (data.type) {
      case SOCKET_EVENTS.CORRUPTION_GAINED:
        _onCorruptionGained(data);
        break;
      case SOCKET_EVENTS.CORRUPTION_STAGE:
        _onCorruptionStage(data);
        break;
      case SOCKET_EVENTS.THREAT_ADVANCED:
        _onThreatAdvanced(data);
        break;
      case SOCKET_EVENTS.SESSION_RESET:
        _onSessionReset(data);
        break;
      case SOCKET_EVENTS.CASE_FILE_RESET:
        _onCaseFileReset(data);
        break;
      case SOCKET_EVENTS.OPS_BOARD_UPDATE:
        _onOpsBoardUpdate(data);
        break;
    }
  });
}

/**
 * Emit a socket event to all connected clients.
 * @param {string} type - Event type from SOCKET_EVENTS.
 * @param {object} payload - Event data.
 */
export function emitSocket(type, payload = {}) {
  game.socket.emit(SOCKET_NAME, { type, ...payload });
}

/**
 * Handle corruption gained notification.
 * @param {object} data
 */
function _onCorruptionGained(data) {
  if (data.actorId) {
    const actor = game.actors.get(data.actorId);
    if (actor?.sheet?.rendered) actor.sheet.render();
  }
}

/**
 * Handle corruption stage change.
 * @param {object} data
 */
function _onCorruptionStage(data) {
  if (data.actorId) {
    const actor = game.actors.get(data.actorId);
    if (actor?.sheet?.rendered) actor.sheet.render();
  }
}

/**
 * Handle threat meter advancement.
 * @param {object} _data
 */
function _onThreatAdvanced(_data) {
  // Re-render any open HQ sheets
  for (const actor of game.actors) {
    if (actor.type === 'headquarters' && actor.sheet?.rendered) {
      actor.sheet.render();
    }
  }
}

/**
 * Handle session reset broadcast.
 * @param {object} _data
 */
function _onSessionReset(_data) {
  ui.notifications.info(game.i18n.localize('NEONRELIC.Session.ResetComplete'));
}

/**
 * Handle case file reset broadcast.
 * @param {object} _data
 */
function _onCaseFileReset(_data) {
  ui.notifications.info(game.i18n.localize('NEONRELIC.Session.CaseFileResetComplete'));
}

/**
 * Handle operations board update.
 * @param {object} _data
 */
function _onOpsBoardUpdate(_data) {
  // Re-render any open Operations Board windows
  for (const app of Object.values(ui.windows)) {
    if (app.constructor.name === 'OperationsBoard') {
      app.render();
    }
  }
}
