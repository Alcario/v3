/**
 * Cookie del refresh token (API.md §3, SECURITY.md §3).
 *
 * Los cuatro atributos y por qué:
 *
 *   httpOnly            JavaScript no puede leerla: un XSS no se lleva la sesión larga.
 *   secure              Solo por HTTPS. En desarrollo va en false, porque el navegador
 *                       descartaría una cookie `secure` servida por http://localhost.
 *   sameSite=strict     El navegador no la envía en ninguna petición cross-site, lo que
 *                       **es** la protección CSRF de /auth/refresh y /auth/logout
 *                       (**D030**). Requiere que el panel se sirva del mismo sitio que
 *                       la API, que es exactamente la topología de D015 (Nginx sirve
 *                       ambos desde el mismo dominio).
 *   path=/api/v1/auth   La cookie no se envía al resto de la API. Reduce la superficie:
 *                       ningún endpoint de negocio la ve pasar.
 */
import { REFRESH_COOKIE_NAME } from '../modules/auth/tokens.js';

export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function refreshCookieOptions(env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  };
}

export function setRefreshCookie(res, token, env) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(env));
}

/**
 * Borra la cookie. Los atributos tienen que coincidir con los del `set` —en especial
 * `path`—, porque si no el navegador la deja intacta.
 */
export function clearRefreshCookie(res, env) {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions(env);
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

export { REFRESH_COOKIE_NAME };
