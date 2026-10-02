/**
 * Autenticación: ¿quién sos? (SECURITY.md §4)
 *
 * Esto es **solo** autenticación. La autorización —¿podés acceder a este recurso?— vive
 * en middlewares aparte (`requireAdultAccess`, Iteración 3) y nunca acá.
 *
 * Decisión **D029**: además de verificar la firma del JWT, se carga el usuario de la base
 * en cada request. Cuesta una lectura por id (indexada) y compra dos cosas que importan
 * con datos de salud: desactivar un usuario surte efecto **al instante** en lugar de
 * esperar a que expire su access token, y `tokenVersion` permite un logout global real.
 */
import mongoose from 'mongoose';
import { User, UserStatus } from '../models/user.model.js';
import { AppError } from '../lib/errors.js';
import { createTokenService } from '../modules/auth/tokens.js';
import { logSecurityEvent, SecurityEvent } from '../lib/securityLog.js';

const BEARER_PREFIX = /^Bearer (.+)$/;

/** Mismo error para todos los motivos: un 401 no explica por qué falló. */
const unauthenticated = () =>
  new AppError('UNAUTHENTICATED', 'Necesitás iniciar sesión para continuar.');

/** Extrae el token del header `Authorization`. */
export function extractBearerToken(req) {
  const header = req.get('authorization');
  if (!header) return null;
  const match = BEARER_PREFIX.exec(header);
  return match ? match[1].trim() : null;
}

export function createRequireAuth({ env }) {
  const tokens = createTokenService({ env });

  return async function requireAuth(req, _res, next) {
    const token = extractBearerToken(req);
    if (!token) {
      logSecurityEvent(req, SecurityEvent.ACCESS_DENIED, { reason: 'NO_TOKEN' });
      return next(unauthenticated());
    }

    const verified = tokens.verifyAccessToken(token);
    if (!verified.ok) {
      logSecurityEvent(req, SecurityEvent.ACCESS_DENIED, { reason: verified.reason });
      return next(unauthenticated());
    }

    const { sub: userId, tv } = verified.payload;
    if (!mongoose.isValidObjectId(userId)) {
      logSecurityEvent(req, SecurityEvent.ACCESS_DENIED, { reason: 'BAD_SUBJECT' });
      return next(unauthenticated());
    }

    try {
      const user = await User.findById(userId);

      if (!user || user.status !== UserStatus.ACTIVE) {
        logSecurityEvent(req, SecurityEvent.ACCESS_DENIED, { reason: 'USER_UNAVAILABLE', userId });
        return next(unauthenticated());
      }
      // Un token emitido antes de un logout global deja de servir inmediatamente.
      if (user.tokenVersion !== tv) {
        logSecurityEvent(req, SecurityEvent.ACCESS_DENIED, { reason: 'STALE_VERSION', userId });
        return next(unauthenticated());
      }

      /**
       * `req.actor` es la identidad autenticada, y la **única** fuente de identidad para
       * el resto de la cadena. Ningún controlador toma el id del usuario del body, del
       * query ni de la URL.
       */
      req.actor = {
        userId: user._id.toString(),
        isPlatformAdmin: user.isPlatformAdmin,
        user,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Rol global de plataforma. **No** da acceso a los datos de ningún adulto (SECURITY.md
 * §4): sirve para crear usuarios y soporte. El permiso sobre un adulto concreto se
 * resuelve contra `CaregiverAccess` en `requireAdultAccess` (Iteración 3).
 */
export function requirePlatformAdmin(req, _res, next) {
  if (!req.actor) return next(unauthenticated());
  if (!req.actor.isPlatformAdmin) {
    logSecurityEvent(req, SecurityEvent.ACCESS_DENIED, {
      reason: 'NOT_PLATFORM_ADMIN',
      userId: req.actor.userId,
    });
    return next(new AppError('FORBIDDEN', 'No tenés permisos para esta operación.'));
  }
  return next();
}
