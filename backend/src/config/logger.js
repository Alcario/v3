/**
 * Logger estructurado (pino).
 *
 * La lista de redacción implementa SECURITY.md §8. Es explícita a propósito: nunca
 * se confía en una heurística para decidir si algo es sensible.
 *
 * Nota sobre `pino`/fast-redact: los comodines cubren un nivel (`*.password`), así que
 * cada campo se declara en el nivel raíz y en el primer nivel anidado, que son las
 * formas en las que efectivamente logueamos objetos.
 */
import pino from 'pino';

const SENSITIVE_FIELDS = [
  // Credenciales y sesión
  'authorization',
  'cookie',
  'password',
  'newPassword',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiAccessToken',
  'secret',
  'apiKey',
  // Alexa
  'alertToken',
  'alexaUserId',
  'alexaUserIdHash',
  'deviceId',
  'deviceIdHash',
  // Vinculación.
  // Ojo: NO se redacta `code` a secas. Es el nombre del campo del código de error de
  // la API (`VALIDATION_ERROR`, ...) y redactarlo deja los logs sin diagnóstico.
  // Convención: el código de vinculación se llama SIEMPRE `pairingCode` en el código.
  'codeHash',
  'pairingCode',
  'verificationCode',
  // Datos personales y de salud (DATA_MODEL.md §7)
  'email',
  'notes',
  'instructions',
  'medicationName',
  'dose',
  'birthDate',
  'phone',
];

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SENSITIVE_FIELDS,
  ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
];

export const REDACTED = '[redactado]';

/**
 * @param {{ LOG_LEVEL: string, NODE_ENV: string }} env
 * @param {import('node:stream').Writable} [destination] Solo para tests.
 */
export function createLogger(env, destination) {
  const options = {
    level: env.LOG_LEVEL,
    base: { env: env.NODE_ENV },
    redact: { paths: REDACT_PATHS, censor: REDACTED },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (destination) return pino(options, destination);

  // `pino-pretty` solo en desarrollo: en producción la salida es JSON de una línea.
  if (env.NODE_ENV === 'development') {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,env' },
      },
    });
  }

  return pino(options);
}
