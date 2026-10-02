/**
 * Sesión de refresh (**D028**).
 *
 * Un documento por sesión (una por login), que se **rota en el lugar**: guarda el hash
 * del refresh token vigente y nada más. Esto es lo que habilita las tres cosas que
 * `refreshTokenVersion` por sí solo no puede dar:
 *
 *   1. Rotación real: el token anterior deja de servir porque su hash ya no está.
 *   2. Detección de reutilización: un token válido y no expirado cuyo hash no coincide
 *      con el vigente es, por definición, un token viejo replayado.
 *   3. Revocación por sesión: cerrar sesión en un dispositivo sin tocar los demás.
 *
 * Nunca se guarda el token: solo `SHA-256` del token completo. Se usa SHA-256 y no
 * bcrypt a propósito: el refresh token es un secreto de alta entropía generado por
 * nosotros (no una contraseña elegida por una persona), así que no hace falta un hash
 * lento —y bcrypt en cada refresh sería un costo de CPU sin beneficio—.
 */
import mongoose from 'mongoose';

export const SessionStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
});

export const RevocationReason = Object.freeze({
  LOGOUT: 'LOGOUT',
  REUSE_DETECTED: 'REUSE_DETECTED',
  GLOBAL_LOGOUT: 'GLOBAL_LOGOUT',
  ADMIN: 'ADMIN',
});

const authSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** SHA-256 (hex) del refresh token vigente. Único: identifica la sesión sin el token. */
    tokenHash: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.ACTIVE,
    },
    /**
     * Momento de expiración de la sesión. **La aplicación compara contra este campo**:
     * el índice TTL de MongoDB borra en segundo plano (cada ~60 s), así que un documento
     * expirado puede seguir existiendo un rato y no se puede tratar la ausencia del
     * documento como el único criterio de expiración.
     */
    expiresAt: { type: Date, required: true },
    rotationCount: { type: Number, default: 0, min: 0 },
    lastRotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: [...Object.values(RevocationReason), null],
      default: null,
    },
  },
  { timestamps: true },
);

// Búsqueda por el hash del token vigente: es el camino del refresh.
authSessionSchema.index({ tokenHash: 1 }, { unique: true });
// Revocar todas las sesiones de un usuario, y listarlas en el futuro.
authSessionSchema.index({ userId: 1, status: 1 });
// TTL: limpieza de sesiones vencidas. Es higiene, no un control de seguridad.
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Una sesión sirve solo si está activa y todavía no venció. */
authSessionSchema.methods.isUsable = function isUsable(now = new Date()) {
  return this.status === SessionStatus.ACTIVE && this.expiresAt > now;
};

export const AuthSession = mongoose.model('AuthSession', authSessionSchema);
