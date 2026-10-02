/**
 * Rate limiting (API.md §14).
 *
 * En esta iteración las cuotas son por IP, porque todavía no hay identidad.
 * Los límites por usuario y por endpoint se agregan en sus iteraciones.
 *
 * Los healthchecks tienen su propia cuota, más generosa y separada: el monitoreo
 * externo los golpea cada pocos segundos y no debe consumir la cuota de la API,
 * pero tampoco pueden quedar abiertos como canal de sondeo (SECURITY.md §16).
 */
import rateLimit from 'express-rate-limit';
import { rateLimited } from '../lib/errors.js';

/**
 * Normaliza la IP para usarla como clave de cuota.
 *
 * En IPv6 un solo cliente suele disponer de un /64 entero, así que contar por dirección
 * exacta permitiría saltarse la cuota rotando de dirección sin cambiar de red. Se agrupa
 * por los primeros cuatro grupos (el /64). En IPv4 se usa la dirección tal cual.
 */
export function ipKey(ip) {
  if (typeof ip !== 'string' || ip.length === 0) return 'unknown';
  const address = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (!address.includes(':')) return address;
  return `${address.split(':').slice(0, 4).join(':')}::/64`;
}

function buildLimiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    // El error viaja por el handler central para respetar el envoltorio único.
    handler: (_req, _res, next, options) => {
      next(rateLimited(Math.ceil(options.windowMs / 1000)));
    },
  });
}

export function createGlobalRateLimiter(env) {
  return buildLimiter({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX });
}

export function createHealthRateLimiter(env) {
  return buildLimiter({
    windowMs: env.HEALTH_RATE_LIMIT_WINDOW_MS,
    max: env.HEALTH_RATE_LIMIT_MAX,
  });
}

/**
 * Login: cuota por **IP + email** (API.md §14). Solo por IP dejaría que un atacante
 * pruebe una contraseña contra miles de cuentas; solo por email permitiría a cualquiera
 * bloquear la cuenta de otro. La combinación acota el ataque sin habilitar la denegación
 * de servicio contra una cuenta concreta.
 */
export function createLoginRateLimiter(env) {
  return buildLimiter({
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
    max: env.LOGIN_RATE_LIMIT_MAX,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '-';
      return `${ipKey(req.ip)}|${email}`;
    },
  });
}

/** Refresh: cuota por IP. No hay email en el pedido, solo la cookie. */
export function createRefreshRateLimiter(env) {
  return buildLimiter({
    windowMs: env.REFRESH_RATE_LIMIT_WINDOW_MS,
    max: env.REFRESH_RATE_LIMIT_MAX,
  });
}
