/**
 * Esquemas de validación de auth (SECURITY.md §5).
 *
 * `z.strictObject`: una propiedad desconocida es un 400, no algo que se ignora. Es la
 * defensa concreta contra *mass assignment* — sin esto, un `{"isPlatformAdmin": true}`
 * en el body del alta pasaría inadvertido.
 */
import { z } from 'zod';
import { passwordSchema } from './password.js';

/** Email: normalizado acá mismo, para que el servicio reciba el valor ya canónico. */
export const emailSchema = z
  .string({ error: 'es obligatorio' })
  .trim()
  .toLowerCase()
  .min(5, { error: 'no parece un email válido' })
  .max(254, { error: 'es demasiado largo' })
  .refine((value) => /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value), {
    error: 'no parece un email válido',
  });

export const loginSchema = z.strictObject({
  email: emailSchema,
  /**
   * El login NO aplica la política de contraseñas: solo exige que haya algo. Validar la
   * longitud mínima acá filtraría información sobre las contraseñas almacenadas y
   * rompería el acceso de una cuenta vieja que ya no cumple la política.
   */
  password: z
    .string({ error: 'es obligatoria' })
    .min(1, { error: 'es obligatoria' })
    .max(200, { error: 'es demasiado larga' }),
});

const nameSchema = z
  .string({ error: 'es obligatorio' })
  .trim()
  .min(2, { error: 'debe tener al menos 2 caracteres' })
  .max(80, { error: 'no puede superar 80 caracteres' });

export const createUserSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  isPlatformAdmin: z.boolean().optional().default(false),
});
