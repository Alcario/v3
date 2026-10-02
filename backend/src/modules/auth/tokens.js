/**
 * Emisión y verificación de tokens (SECURITY.md §3, decisiones D001 y D028).
 *
 * Dos tokens, con **secretos distintos** y audiencias distintas, para que uno no pueda
 * hacerse pasar por el otro:
 *
 *   Access  (`aud: chatio-web`)  · 15 min · viaja en Authorization: Bearer
 *   Refresh (`aud: chatio-refresh`) · 7 días · viaja en cookie httpOnly
 *
 * Claims del access token: `sub` y `tv`, más los estándar. **Sin email, sin nombre, sin
 * rol y sin permisos** (**D028**): un bearer token va en cada request y se filtra en
 * cualquier log intermedio, así que no lleva datos personales. El rol y el estado del
 * usuario se leen de la base en cada request (**D029**), que además los mantiene frescos.
 */
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const ISSUER = 'chatio';
export const ACCESS_AUDIENCE = 'chatio-web';
export const REFRESH_AUDIENCE = 'chatio-refresh';
export const ALGORITHM = 'HS256';

/** Nombre de la cookie del refresh token (API.md §3). */
export const REFRESH_COOKIE_NAME = 'chatio_rt';

/** Motivos por los que un token se rechaza. Se loguean; nunca se exponen al cliente. */
export const TokenError = Object.freeze({
  MISSING: 'MISSING',
  MALFORMED: 'MALFORMED',
  EXPIRED: 'EXPIRED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_CLAIMS: 'INVALID_CLAIMS',
});

/**
 * SHA-256 hex del token completo. Es lo único que se persiste de un refresh token.
 * Ver `authSession.model.js` para por qué no es bcrypt.
 */
export function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createTokenService({ env }) {
  const accessTtl = env.ACCESS_TOKEN_TTL_SECONDS;
  const refreshTtl = env.REFRESH_TOKEN_TTL_SECONDS;

  function signAccessToken({ userId, tokenVersion }) {
    return jwt.sign({ tv: tokenVersion }, env.JWT_ACCESS_SECRET, {
      algorithm: ALGORITHM,
      subject: String(userId),
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
      expiresIn: accessTtl,
    });
  }

  /**
   * El refresh token lleva `sid` (la sesión) y un `jti` nuevo en cada rotación, así que
   * dos rotaciones nunca producen el mismo token aunque ocurran en el mismo segundo.
   */
  function signRefreshToken({ userId, sessionId, tokenVersion }) {
    return jwt.sign(
      { sid: String(sessionId), tv: tokenVersion, jti: randomUUID() },
      env.JWT_REFRESH_SECRET,
      {
        algorithm: ALGORITHM,
        subject: String(userId),
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
        expiresIn: refreshTtl,
      },
    );
  }

  /** @returns {{ ok: true, payload: object } | { ok: false, reason: string }} */
  function verify(token, { secret, audience, requiredClaims = [] }) {
    if (typeof token !== 'string' || token.length === 0) {
      return { ok: false, reason: TokenError.MISSING };
    }
    let payload;
    try {
      payload = jwt.verify(token, secret, {
        algorithms: [ALGORITHM], // Fijo: evita el ataque de `alg: none` o cambio de algoritmo.
        issuer: ISSUER,
        audience,
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') return { ok: false, reason: TokenError.EXPIRED };
      if (error.name === 'JsonWebTokenError') {
        return {
          ok: false,
          reason: /signature/i.test(error.message)
            ? TokenError.INVALID_SIGNATURE
            : TokenError.MALFORMED,
        };
      }
      return { ok: false, reason: TokenError.MALFORMED };
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return { ok: false, reason: TokenError.INVALID_CLAIMS };
    }
    if (typeof payload.tv !== 'number') {
      return { ok: false, reason: TokenError.INVALID_CLAIMS };
    }
    for (const claim of requiredClaims) {
      if (typeof payload[claim] !== 'string' || payload[claim].length === 0) {
        return { ok: false, reason: TokenError.INVALID_CLAIMS };
      }
    }
    return { ok: true, payload };
  }

  return {
    accessTtlSeconds: accessTtl,
    refreshTtlSeconds: refreshTtl,
    signAccessToken,
    signRefreshToken,
    verifyAccessToken: (token) =>
      verify(token, { secret: env.JWT_ACCESS_SECRET, audience: ACCESS_AUDIENCE }),
    verifyRefreshToken: (token) =>
      verify(token, {
        secret: env.JWT_REFRESH_SECRET,
        audience: REFRESH_AUDIENCE,
        requiredClaims: ['sid'],
      }),
  };
}
