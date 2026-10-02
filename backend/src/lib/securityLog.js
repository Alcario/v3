/**
 * Eventos de seguridad (SECURITY.md §9).
 *
 * Van al log estructurado y **no** al timeline de actividad del adulto: no le interesan
 * al familiar y no deben mezclarse con datos de salud.
 *
 * Qué se registra: el tipo de evento, el `requestId`, y el `userId` o `sessionId` cuando
 * se conocen. En los dos eventos que indican un ataque en curso se registra además la IP,
 * porque sin ella no se puede investigar nada.
 *
 * Qué NO se registra nunca: email, contraseñas, tokens, hashes ni cookies. La lista de
 * redacción del logger es la segunda línea de defensa, no la primera.
 */
export const SecurityEvent = Object.freeze({
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  REFRESH: 'AUTH_REFRESH',
  REFRESH_REJECTED: 'AUTH_REFRESH_REJECTED',
  REFRESH_REUSE: 'AUTH_REFRESH_REUSE',
  LOGOUT: 'AUTH_LOGOUT',
  ACCESS_DENIED: 'AUTH_ACCESS_DENIED',
  USER_CREATED: 'AUTH_USER_CREATED',
  SESSIONS_REVOKED: 'AUTH_SESSIONS_REVOKED',
});

/** Eventos en los que la IP aporta más de lo que cuesta guardarla. */
const EVENTS_WITH_IP = new Set([SecurityEvent.LOGIN_FAILURE, SecurityEvent.REFRESH_REUSE]);

/** Nivel por evento: lo anómalo se ve sin filtrar por texto. */
const LEVELS = {
  [SecurityEvent.LOGIN_FAILURE]: 'warn',
  [SecurityEvent.REFRESH_REJECTED]: 'warn',
  [SecurityEvent.REFRESH_REUSE]: 'error',
  [SecurityEvent.ACCESS_DENIED]: 'warn',
};

/**
 * @param {import('express').Request} req
 * @param {string} event Uno de `SecurityEvent`.
 * @param {{ userId?: string, sessionId?: string, reason?: string, count?: number }} [context]
 */
export function logSecurityEvent(req, event, context = {}) {
  const logger = req.log;
  if (!logger) return;

  const payload = { event, ...context };
  if (EVENTS_WITH_IP.has(event)) payload.ip = req.ip;

  const level = LEVELS[event] ?? 'info';
  logger[level](payload, event);
}
