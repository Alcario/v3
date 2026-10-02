import { z } from 'zod';
import { DEFAULT_TIMEZONE, isValidDateOnly, isValidTimezone } from '../../lib/time.js';

const objectIdPattern = /^[a-fA-F0-9]{24}$/;

export const objectIdSchema = z.string({ error: 'es obligatorio' }).regex(objectIdPattern, {
  error: 'debe ser un ObjectId válido',
});

const nameSchema = z
  .string({ error: 'es obligatorio' })
  .trim()
  .min(2, { error: 'debe tener al menos 2 caracteres' })
  .max(80, { error: 'no puede superar 80 caracteres' });

const dateOnlySchema = z
  .string({ error: 'debe tener formato YYYY-MM-DD' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'debe tener formato YYYY-MM-DD' })
  .refine(isValidDateOnly, { error: 'no es una fecha válida' })
  .refine((value) => new Date(`${value}T00:00:00.000Z`) <= new Date(), {
    error: 'no puede ser futura',
  });

const timezoneSchema = z
  .string({ error: 'es obligatoria' })
  .trim()
  .refine(isValidTimezone, { error: 'debe ser una zona horaria IANA válida' });

const notesSchema = z
  .string({ error: 'debe ser texto' })
  .trim()
  .max(1000, { error: 'no puede superar 1000 caracteres' });

export const contactSchema = z.strictObject({
  name: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(2, { error: 'debe tener al menos 2 caracteres' })
    .max(80, { error: 'no puede superar 80 caracteres' }),
  relationship: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(2, { error: 'debe tener al menos 2 caracteres' })
    .max(80, { error: 'no puede superar 80 caracteres' }),
  phone: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(3, { error: 'debe tener al menos 3 caracteres' })
    .max(40, { error: 'no puede superar 40 caracteres' }),
  isPrimary: z.boolean().default(false),
});

const contactsSchema = z
  .array(contactSchema, { error: 'debe ser una lista' })
  .max(5, { error: 'no puede tener más de 5 contactos' })
  .superRefine((contacts, ctx) => {
    if (contacts.filter((contact) => contact.isPrimary).length > 1) {
      ctx.addIssue({ code: 'custom', message: 'solo un contacto puede ser principal' });
    }
  });

export const adultIdParamsSchema = z.strictObject({ adultId: objectIdSchema });

export const accessIdParamsSchema = z.strictObject({
  adultId: objectIdSchema,
  accessId: objectIdSchema,
});

export const createAdultSchema = z.strictObject({
  firstName: nameSchema,
  lastName: nameSchema,
  birthDate: dateOnlySchema.nullable().optional(),
  timezone: timezoneSchema.default(DEFAULT_TIMEZONE),
  notes: notesSchema.nullable().optional(),
  contacts: contactsSchema.optional().default([]),
  consentConfirmed: z.literal(true, { error: 'debe confirmarse el consentimiento' }),
});

export const updateAdultSchema = z
  .strictObject({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    birthDate: dateOnlySchema.nullable().optional(),
    timezone: timezoneSchema.optional(),
    notes: notesSchema.nullable().optional(),
    contacts: contactsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: 'debe incluir al menos un campo para actualizar',
  });
