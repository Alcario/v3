/**
 * Conexión a MongoDB mediante Mongoose.
 *
 * Decisiones que aplican acá:
 *  - `sanitizeFilter` global (SECURITY.md §5, amenaza T9: inyección NoSQL por operadores).
 *  - Reintento con backoff en el arranque: la API sirve `/health` aunque Mongo no esté,
 *    y `/ready` responde 503 hasta que la dependencia crítica esté disponible.
 *  - Cierre ordenado, para no dejar conexiones colgadas al recibir SIGTERM.
 */
import mongoose from 'mongoose';

mongoose.set('strictQuery', true);
// Descarta operadores ($gt, $where, ...) que lleguen desde un input en un filtro.
mongoose.set('sanitizeFilter', true);

export const ConnectionState = {
  disconnected: 0,
  connected: 1,
  connecting: 2,
  disconnecting: 3,
};

/** @returns {number} readyState de la conexión de Mongoose. */
export function getConnectionState() {
  return mongoose.connection.readyState;
}

export function isConnected() {
  return getConnectionState() === ConnectionState.connected;
}

/** Un único intento de conexión. Lanza si falla. */
export async function connectDb({ uri, serverSelectionTimeoutMS = 5000 }) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS,
    // Sin `autoIndex` en producción: los índices se crean de forma explícita.
    autoIndex: process.env.NODE_ENV !== 'production',
  });
  return mongoose.connection;
}

const wait = (ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // No mantiene el proceso vivo solo por esperar un reintento.
    timer.unref?.();
  });

/**
 * Conecta reintentando con backoff exponencial acotado.
 * No lanza: informa por el logger y sigue intentando hasta `maxAttempts`.
 *
 * Mongoose reconecta solo después de la primera conexión exitosa; este reintento
 * cubre únicamente el arranque (Mongo todavía no disponible cuando la API levanta).
 *
 * @returns {Promise<boolean>} true si llegó a conectar.
 */
export async function connectDbWithRetry({
  uri,
  logger,
  serverSelectionTimeoutMS = 5000,
  maxAttempts = Infinity,
  baseDelayMs = 1000,
  maxDelayMs = 30_000,
  shouldStop = () => false,
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (shouldStop()) return false;
    try {
      await connectDb({ uri, serverSelectionTimeoutMS });
      logger?.info({ attempt }, 'Conexión a MongoDB establecida');
      return true;
    } catch (error) {
      // Nunca se loguea la URI: puede contener credenciales.
      logger?.error(
        { attempt, err: { name: error.name, message: error.message } },
        'No se pudo conectar a MongoDB',
      );
      if (attempt === maxAttempts) return false;
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await wait(delay);
    }
  }
  return false;
}

/**
 * Verifica que la base responda de verdad, no solo que el socket exista.
 * @returns {Promise<boolean>}
 */
export async function pingDb({ timeoutMs = 2000 } = {}) {
  if (!isConnected()) return false;
  try {
    const ping = mongoose.connection.db.admin().command({ ping: 1 });
    const timeout = new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('ping timeout')), timeoutMs);
      timer.unref?.();
    });
    await Promise.race([ping, timeout]);
    return true;
  } catch {
    return false;
  }
}

/** Cierre ordenado. Idempotente. */
export async function disconnectDb() {
  if (getConnectionState() === ConnectionState.disconnected) return;
  await mongoose.disconnect();
}
