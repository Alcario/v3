import { z } from 'zod';
import { isValidDateOnly } from '../../lib/time.js';
import { objectIdSchema } from '../adults/adult.schemas.js';
import { MedicationOccurrenceStatus } from '../../models/medicationOccurrence.model.js';

const dateSchema = z
  .string({ error: 'debe tener formato YYYY-MM-DD' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'debe tener formato YYYY-MM-DD' })
  .refine(isValidDateOnly, { error: 'no es una fecha válida' });

const noteSchema = z
  .string({ error: 'debe ser texto' })
  .trim()
  .max(300, { error: 'no puede superar 300 caracteres' });

export const occurrenceIdParamsSchema = z.strictObject({
  adultId: objectIdSchema,
  occurrenceId: objectIdSchema,
});

export const occurrenceAdultParamsSchema = z.strictObject({ adultId: objectIdSchema });

const statusSchema = z.enum(Object.values(MedicationOccurrenceStatus), {
  error: 'estado inválido',
});

export const occurrenceQuerySchema = z
  .strictObject({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    status: z.union([statusSchema, z.array(statusSchema)]).optional(),
    medicationId: objectIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: objectIdSchema.optional(),
  })
  .superRefine((query, ctx) => {
    if (query.from && query.to && query.from > query.to) {
      ctx.addIssue({ path: ['to'], code: 'custom', message: 'debe ser posterior o igual a from' });
    }
  });

export const confirmOccurrenceSchema = z.strictObject({
  note: noteSchema.nullable().optional(),
});

export const skipOccurrenceSchema = z.strictObject({
  note: noteSchema.nullable().optional(),
});
