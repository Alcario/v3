/**
 * Carga y validación estricta del entorno.
 *
 * Reglas (SECURITY.md §7):
 *  - Si falta una variable obligatoria o tiene un valor inválido, el proceso NO arranca.
 *  - Los mensajes de error nombran la variable y el problema, JAMÁS el valor.
 *  - El esquema crece por iteración (D026): acá solo están las variables que el código usa.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Raíz del repositorio: backend/src/config -> backend/src -> backend -> raíz */
export const repoRoot = path.resolve(here, '..', '..', '..');

/** Carga el `.env` de la raíz del repositorio, si existe. No sobreescribe lo ya definido. */
export function loadDotEnv() {
  dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });
}

/**
 * Esquema reutilizable para secretos (JWT). La regla de longitud mínima vive acá y en
 * un solo lugar. SECURITY.md §3 pide secretos de al menos 32 bytes aleatorios.
 */
export const secretSchema = (minLength = 32) =>
  z.string({ error: 'es obligatoria' }).min(minLength, {
    error: `debe tener al menos ${minLength} caracteres`,
  });

const booleanish = z
  .enum(['true', 'false', '1', '0'], { error: 'debe ser true o false' })
  .transform((value) => value === 'true' || value === '1');

const csvList = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const positiveInt = (fallback) =>
  z.coerce
    .number({ error: 'debe ser un número' })
    .int({ error: 'debe ser un número entero' })
    .positive({ error: 'debe ser mayor que cero' })
    .default(fallback);

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'], {
        error: 'debe ser development, test o production',
      })
      .default('development'),

    PORT: z.coerce
      .number({ error: 'debe ser un número' })
      .int({ error: 'debe ser un número entero' })
      .min(1, { error: 'debe estar entre 1 y 65535' })
      .max(65535, { error: 'debe estar entre 1 y 65535' })
      .default(3000),

    MONGODB_URI: z
      .string({ error: 'es obligatoria' })
      .min(1, { error: 'es obligatoria' })
      .refine((value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'), {
        error: 'debe empezar con mongodb:// o mongodb+srv://',
      }),

    MONGODB_SERVER_SELECTION_TIMEOUT_MS: positiveInt(5000),

    LOG_LEVEL: z
      .enum(LOG_LEVELS, { error: `debe ser uno de: ${LOG_LEVELS.join(', ')}` })
      .default('info'),

    TRUST_PROXY: booleanish.default(false),

    // En Zod 4 el valor de `.default()` es el de SALIDA: no pasa por el `transform`,
    // así que el default de una lista es `[]` y no la cadena vacía.
    CORS_ORIGINS: csvList.default([]),

    BODY_LIMIT: z.string().min(2).default('32kb'),

    RATE_LIMIT_WINDOW_MS: positiveInt(15 * 60 * 1000),
    RATE_LIMIT_MAX: positiveInt(300),
    HEALTH_RATE_LIMIT_WINDOW_MS: positiveInt(60 * 1000),
    HEALTH_RATE_LIMIT_MAX: positiveInt(60),

    SHUTDOWN_TIMEOUT_MS: positiveInt(10_000),

    // ─── Autenticación (Iteración 2) ───────────────────────────────────────────
    // Obligatorios en todos los entornos: un secreto con valor por defecto es un
    // secreto compartido por todo el que clone el repositorio.
    JWT_ACCESS_SECRET: secretSchema(32),
    JWT_REFRESH_SECRET: secretSchema(32),

    ACCESS_TOKEN_TTL_SECONDS: positiveInt(15 * 60),
    REFRESH_TOKEN_TTL_SECONDS: positiveInt(7 * 24 * 60 * 60),

    // bcrypt cost 12 (SECURITY.md §3). Configurable para poder bajarlo en los tests.
    BCRYPT_COST: z.coerce
      .number({ error: 'debe ser un número' })
      .int({ error: 'debe ser un número entero' })
      .min(4, { error: 'debe estar entre 4 y 15' })
      .max(15, { error: 'debe estar entre 4 y 15' })
      .default(12),

    LOGIN_RATE_LIMIT_WINDOW_MS: positiveInt(15 * 60 * 1000),
    LOGIN_RATE_LIMIT_MAX: positiveInt(5),
    REFRESH_RATE_LIMIT_WINDOW_MS: positiveInt(15 * 60 * 1000),
    REFRESH_RATE_LIMIT_MAX: positiveInt(30),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    // En producción el panel se sirve desde un origen conocido: no puede quedar vacío,
    // y nunca se admite un comodín (incompatible con cookies, y CORS abierto).
    if (env.CORS_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'es obligatoria en producción y no puede estar vacía',
      });
    }
    if (env.CORS_ORIGINS.includes('*')) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'no admite el comodín *: hay que enumerar los orígenes',
      });
    }
    // Un solo secreto para las dos cosas convierte un access token en un refresh:
    // quien pueda firmar uno puede firmar el otro.
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'debe ser distinto de JWT_ACCESS_SECRET',
      });
    }
    // El access token corto es la mitad de la decisión D001: no tiene sentido en
    // producción un TTL largo, que es lo que se busca evitar.
    if (env.ACCESS_TOKEN_TTL_SECONDS > 3600) {
      ctx.addIssue({
        code: 'custom',
        path: ['ACCESS_TOKEN_TTL_SECONDS'],
        message: 'no puede superar 3600 (1 h) en producción: ver decisión D001',
      });
    }
    if (env.BCRYPT_COST < 12) {
      ctx.addIssue({
        code: 'custom',
        path: ['BCRYPT_COST'],
        message: 'no puede ser menor que 12 en producción (SECURITY.md §3)',
      });
    }
    // SECURITY.md §8: en producción no se loguea a nivel debug/trace.
    if (env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace') {
      ctx.addIssue({
        code: 'custom',
        path: ['LOG_LEVEL'],
        message: 'no admite debug ni trace en producción',
      });
    }
  });

/** Error de configuración. Expone los nombres de las variables, nunca sus valores. */
export class EnvValidationError extends Error {
  constructor(issues) {
    const lines = issues.map(({ variable, message }) => `  - ${variable}: ${message}`);
    super(`Configuración de entorno inválida:\n${lines.join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/**
 * Valida un objeto de entorno. Función pura: no lee `process.env` ni sale del proceso.
 * @param {Record<string, string | undefined>} raw
 */
export function parseEnv(raw = {}) {
  // Las claves vacías se tratan como ausentes, para que los defaults apliquen.
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined && value !== ''),
  );

  const result = envSchema.safeParse(cleaned);
  if (result.success) return Object.freeze(result.data);

  const issues = result.error.issues.map((issue) => ({
    variable: String(issue.path[0] ?? '(entorno)'),
    message: issue.message,
  }));
  throw new EnvValidationError(issues);
}

let cached = null;

/** Entorno validado y memoizado. Lanza `EnvValidationError` si es inválido. */
export function getEnv() {
  if (!cached) {
    loadDotEnv();
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Limpia la memoización. Solo para tests. */
export function resetEnvCache() {
  cached = null;
}

/**
 * Para el arranque del proceso: valida y, si falla, escribe el motivo y sale con código 1.
 * Se usa únicamente en `server.js`, para que importar la configuración nunca mate un test.
 */
export function loadEnvOrExit({ exit = process.exit, stderr = process.stderr } = {}) {
  try {
    return getEnv();
  } catch (error) {
    if (!(error instanceof EnvValidationError)) throw error;
    stderr.write(`\n${error.message}\n\nRevisá .env.example y corregí el entorno.\n\n`);
    return exit(1);
  }
}
