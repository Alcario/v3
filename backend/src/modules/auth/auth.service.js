/**
 * Servicio de autenticación. Única capa con reglas de sesión (ARCHITECTURE.md §3).
 *
 * No conoce `req`, `res` ni cookies: recibe datos planos y devuelve datos planos. Quien
 * traduce a HTTP es el controlador.
 */
import mongoose from 'mongoose';
import { User, UserStatus, normalizeEmail } from '../../models/user.model.js';
import { AuthSession, SessionStatus, RevocationReason } from '../../models/authSession.model.js';
import { AppError } from '../../lib/errors.js';
import { createTokenService, hashToken } from './tokens.js';
import { hashPassword, verifyPassword, verifyPasswordAgainstDummy } from './password.js';

/** Motivos internos de rechazo. Se loguean; al cliente siempre se le dice lo mismo. */
export const AuthFailure = Object.freeze({
  UNKNOWN_EMAIL: 'UNKNOWN_EMAIL',
  BAD_PASSWORD: 'BAD_PASSWORD',
  USER_INACTIVE: 'USER_INACTIVE',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOKEN_VERSION_STALE: 'TOKEN_VERSION_STALE',
  REUSE_DETECTED: 'REUSE_DETECTED',
});

/** Error de autenticación: mismo mensaje público para todos los motivos. */
export class AuthenticationError extends AppError {
  constructor(failure, { code = 'UNAUTHENTICATED', message = 'No se pudo autenticar.' } = {}) {
    super(code, message);
    this.name = 'AuthenticationError';
    this.failure = failure;
  }
}

const invalidCredentials = (failure) =>
  new AuthenticationError(failure, {
    code: 'INVALID_CREDENTIALS',
    message: 'Email o contraseña incorrectos.',
  });

const invalidSession = (failure) =>
  new AuthenticationError(failure, { message: 'La sesión no es válida. Iniciá sesión de nuevo.' });

export function createAuthService({ env }) {
  const tokens = createTokenService({ env });

  /** Emite el par de tokens y crea la sesión que lo respalda. */
  async function issueSession(user) {
    const sessionId = new mongoose.Types.ObjectId();
    const refreshToken = tokens.signRefreshToken({
      userId: user._id,
      sessionId,
      tokenVersion: user.tokenVersion,
    });

    await AuthSession.create({
      _id: sessionId,
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + tokens.refreshTtlSeconds * 1000),
    });

    return {
      accessToken: tokens.signAccessToken({ userId: user._id, tokenVersion: user.tokenVersion }),
      refreshToken,
      expiresIn: tokens.accessTtlSeconds,
      sessionId: sessionId.toString(),
    };
  }

  /**
   * Login. Devuelve el mismo error para email inexistente, contraseña incorrecta y
   * usuario inactivo, y consume el mismo tiempo en los tres casos.
   */
  async function login({ email, password }) {
    const normalized = normalizeEmail(email);
    const user = await User.findOne({ email: normalized }).select('+passwordHash');

    if (!user) {
      // Se compara contra un hash de descarte para que el tiempo de respuesta no
      // revele si el email existe.
      await verifyPasswordAgainstDummy(password, env.BCRYPT_COST);
      throw invalidCredentials(AuthFailure.UNKNOWN_EMAIL);
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) throw invalidCredentials(AuthFailure.BAD_PASSWORD);

    // Se verifica DESPUÉS de la contraseña: así un atacante no puede distinguir
    // "existe pero está inactivo" de "no existe" sin conocer la contraseña.
    if (user.status !== UserStatus.ACTIVE) throw invalidCredentials(AuthFailure.USER_INACTIVE);

    const issued = await issueSession(user);
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    return { ...issued, user: user.toPublicJSON() };
  }

  /**
   * Rotación del refresh token con detección de reutilización (**D028**).
   *
   * El orden de las verificaciones importa: primero lo barato y sin base (firma y
   * expiración del JWT), después la sesión, y la rotación al final, con una escritura
   * condicional que resuelve la carrera entre dos refresh simultáneos.
   */
  async function refresh({ refreshToken }) {
    const verified = tokens.verifyRefreshToken(refreshToken);
    if (!verified.ok) throw invalidSession(AuthFailure.TOKEN_INVALID);

    const { sub: userId, sid: sessionId, tv } = verified.payload;

    if (!mongoose.isValidObjectId(sessionId) || !mongoose.isValidObjectId(userId)) {
      throw invalidSession(AuthFailure.TOKEN_INVALID);
    }

    const session = await AuthSession.findById(sessionId);
    if (!session) throw invalidSession(AuthFailure.SESSION_NOT_FOUND);

    // `isUsable` es la definición única de "esta sesión sirve" y vive en el modelo.
    // La expiración se evalúa contra `expiresAt` y no contra la existencia del documento:
    // el TTL de MongoDB borra en segundo plano y puede tardar minutos.
    if (!session.isUsable()) {
      throw invalidSession(
        session.status !== SessionStatus.ACTIVE
          ? AuthFailure.SESSION_REVOKED
          : AuthFailure.SESSION_EXPIRED,
      );
    }
    if (session.userId.toString() !== userId) {
      throw invalidSession(AuthFailure.TOKEN_INVALID);
    }

    const presentedHash = hashToken(refreshToken);
    if (presentedHash !== session.tokenHash) {
      // El token es válido, no expiró y apunta a una sesión activa, pero no es el
      // vigente: es un token viejo replayado. Se revoca la sesión entera.
      await AuthSession.updateOne(
        { _id: session._id, status: SessionStatus.ACTIVE },
        {
          $set: {
            status: SessionStatus.REVOKED,
            revokedAt: new Date(),
            revokedReason: RevocationReason.REUSE_DETECTED,
          },
        },
      );
      throw invalidSession(AuthFailure.REUSE_DETECTED);
    }

    const user = await User.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw invalidSession(AuthFailure.USER_INACTIVE);
    }
    if (user.tokenVersion !== tv) {
      throw invalidSession(AuthFailure.TOKEN_VERSION_STALE);
    }

    const nextRefreshToken = tokens.signRefreshToken({
      userId: user._id,
      sessionId: session._id,
      tokenVersion: user.tokenVersion,
    });

    // Escritura condicional: solo rota quien presentó el hash vigente. Si dos refresh
    // llegan con el mismo token, uno gana y el otro no encuentra el hash y se rechaza,
    // que es el comportamiento correcto — no se puede distinguir de un replay.
    const rotated = await AuthSession.findOneAndUpdate(
      { _id: session._id, tokenHash: presentedHash, status: SessionStatus.ACTIVE },
      {
        $set: { tokenHash: hashToken(nextRefreshToken), lastRotatedAt: new Date() },
        $inc: { rotationCount: 1 },
      },
      { new: true },
    );
    if (!rotated) throw invalidSession(AuthFailure.REUSE_DETECTED);

    return {
      accessToken: tokens.signAccessToken({ userId: user._id, tokenVersion: user.tokenVersion }),
      refreshToken: nextRefreshToken,
      expiresIn: tokens.accessTtlSeconds,
      sessionId: session._id.toString(),
      userId: user._id.toString(),
    };
  }

  /**
   * Logout. Idempotente: si el token es inválido, si la sesión no existe o si ya estaba
   * revocada, el resultado es el mismo. Nunca falla — lo que el cliente quiere es que la
   * sesión deje de existir, y si no existe, ya está.
   */
  async function logout({ refreshToken }) {
    const verified = tokens.verifyRefreshToken(refreshToken);
    if (!verified.ok) return { revoked: false, sessionId: null, userId: null };

    const { sid: sessionId, sub: userId } = verified.payload;
    if (!mongoose.isValidObjectId(sessionId)) {
      return { revoked: false, sessionId: null, userId: null };
    }

    const result = await AuthSession.updateOne(
      { _id: sessionId, status: SessionStatus.ACTIVE },
      {
        $set: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          revokedReason: RevocationReason.LOGOUT,
        },
      },
    );

    return { revoked: result.modifiedCount === 1, sessionId, userId };
  }

  /**
   * Logout global: revoca todas las sesiones e invalida los access tokens ya emitidos
   * subiendo `tokenVersion` (que `requireAuth` compara en cada request, **D029**).
   */
  async function revokeAllSessions({ userId, reason = RevocationReason.GLOBAL_LOGOUT }) {
    const result = await AuthSession.updateMany(
      { userId, status: SessionStatus.ACTIVE },
      { $set: { status: SessionStatus.REVOKED, revokedAt: new Date(), revokedReason: reason } },
    );
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
    return { revokedCount: result.modifiedCount };
  }

  /** Alta de usuario. La usa el endpoint administrativo y el seed. */
  async function createUser({ email, password, firstName, lastName, isPlatformAdmin = false }) {
    const normalized = normalizeEmail(email);
    const passwordHash = await hashPassword(password, env.BCRYPT_COST);

    try {
      const user = await User.create({
        email: normalized,
        passwordHash,
        firstName,
        lastName,
        isPlatformAdmin,
      });
      return user;
    } catch (error) {
      // 11000 = índice único violado. Lo resuelve la base, no una consulta previa:
      // así no hay ventana entre el "existe?" y el insert.
      if (error?.code === 11000) {
        throw new AppError('CONFLICT', 'Ya existe un usuario con ese email.');
      }
      throw error;
    }
  }

  return { login, refresh, logout, revokeAllSessions, createUser, tokens };
}
