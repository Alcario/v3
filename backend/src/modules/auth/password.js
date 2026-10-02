/**
 * Contraseñas (SECURITY.md §3).
 *
 *  - bcrypt, cost 12 por defecto. Nunca texto plano, nunca MD5/SHA, nunca cifrado
 *    reversible.
 *  - Comparación siempre con `bcrypt.compare`, que es de tiempo constante. Jamás `===`.
 *  - Política: longitud mínima y lista de contraseñas comunes. **Sin** reglas de
 *    composición arbitrarias (favorecen contraseñas peores) y sin expiración forzada.
 */
import bcrypt from 'bcrypt';
import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * Hash con el que comparar cuando el usuario no existe, para que el tiempo de
 * respuesta del login sea uniforme y no revele si el email está registrado.
 * Se genera una vez al cargar el módulo con el mismo coste que los reales.
 */
let dummyHash = null;

/**
 * Contraseñas más usadas, para rechazar las peores sin sumar una dependencia ni un
 * diccionario de 100 MB. No pretende ser exhaustiva: descarta lo indefendible.
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  'contrasena',
  'contrasena1',
  'contrasena123',
  'contraseña123',
  '1234567890',
  '12345678901',
  '123456789012',
  'qwertyuiop',
  'qwerty12345',
  'administrador',
  'iloveyou123',
  'welcome123',
  'admin12345',
  'adminadmin',
  'letmein123',
  'changeme123',
  'passw0rd123',
  'chatio1234',
  'chatio12345',
  'abcd123456',
  'aaaaaaaaaa',
  '0000000000',
  'zxcvbnm123',
  'monkey1234',
  'football12',
  'baseball12',
  'princess12',
  'sunshine12',
  'trustno1234',
  'dragon1234',
  'superman12',
  'starwars12',
  'whatever12',
  'qazwsxedc1',
  'asdfghjkl1',
]);

/** Normaliza para comparar contra la lista: minúsculas y sin espacios en los bordes. */
const normalize = (value) => value.trim().toLowerCase();

/**
 * Esquema de contraseña. Se usa tanto en el alta administrativa como en el seed.
 * El login NO aplica la política: valida solo que haya algo, porque una contraseña
 * vieja que ya no cumple la política igual tiene que poder entrar (y el mensaje de
 * error no debe dar pistas sobre el formato de la almacenada).
 */
export const passwordSchema = z
  .string({ error: 'es obligatoria' })
  .min(MIN_PASSWORD_LENGTH, { error: `debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` })
  .max(MAX_PASSWORD_LENGTH, { error: `no puede superar ${MAX_PASSWORD_LENGTH} caracteres` })
  .refine((value) => !COMMON_PASSWORDS.has(normalize(value)), {
    error: 'es demasiado común: elegí una distinta',
  });

/** Valida una contraseña contra la política y devuelve los problemas encontrados. */
export function validatePasswordPolicy(password) {
  const result = passwordSchema.safeParse(password);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

/** @returns {Promise<string>} hash bcrypt. */
export function hashPassword(password, cost) {
  return bcrypt.hash(password, cost);
}

/** Comparación en tiempo constante. Nunca `===` contra un hash (SECURITY.md §3). */
export function verifyPassword(password, hash) {
  if (typeof hash !== 'string' || hash.length === 0) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

/**
 * Consume el mismo tiempo que una verificación real, para el caso "el email no existe".
 * Sin esto, el login filtra por tiempo qué emails están registrados.
 */
export async function verifyPasswordAgainstDummy(password, cost) {
  if (!dummyHash) {
    dummyHash = await bcrypt.hash('contraseña-inexistente-para-tiempo-uniforme', cost);
  }
  await bcrypt.compare(password, dummyHash);
  return false;
}
