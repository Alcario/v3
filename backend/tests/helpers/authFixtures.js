/**
 * Fábricas para los tests de autenticación (TESTING.md §2: fábricas, no fixtures
 * compartidos). Cada una acepta overrides y no depende de las demás.
 */
import request from 'supertest';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/authSession.model.js';
import { createAuthService } from '../../src/modules/auth/auth.service.js';
import { REFRESH_COOKIE_NAME } from '../../src/lib/cookies.js';

export const VALID_PASSWORD = 'Rosa-Gomez-2026-clave';

/** Crea un usuario real en la base, con su hash bcrypt. */
export async function makeUser({ env, overrides = {}, password = VALID_PASSWORD } = {}) {
  const authService = createAuthService({ env });
  const suffix = Math.random().toString(36).slice(2, 8);
  return authService.createUser({
    email: overrides.email ?? `ana.${suffix}@ejemplo.com`,
    password,
    firstName: overrides.firstName ?? 'Ana',
    lastName: overrides.lastName ?? 'Pérez',
    isPlatformAdmin: overrides.isPlatformAdmin ?? false,
  });
}

/** Extrae el valor de la cookie de refresh de una respuesta de supertest. */
export function extractRefreshCookie(response) {
  const raw = response.headers['set-cookie'] ?? [];
  const cookie = raw.find((entry) => entry.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!cookie) return null;
  return {
    raw: cookie,
    value: cookie.split(';')[0].slice(REFRESH_COOKIE_NAME.length + 1),
    attributes: cookie.toLowerCase(),
  };
}

/** Login por HTTP. Devuelve el access token y la cookie de refresh. */
export async function login(app, email, password = VALID_PASSWORD) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  return {
    response,
    accessToken: response.body?.data?.accessToken ?? null,
    refreshCookie: extractRefreshCookie(response),
  };
}

/** Cabecera de cookie lista para enviar en el siguiente pedido. */
export function cookieHeader(refreshCookie) {
  return `${REFRESH_COOKIE_NAME}=${refreshCookie.value}`;
}

/** Sesiones activas de un usuario, para afirmar sobre la revocación. */
export async function activeSessions(userId) {
  return AuthSession.find({ userId, status: 'ACTIVE' });
}

export { User, AuthSession, REFRESH_COOKIE_NAME };
