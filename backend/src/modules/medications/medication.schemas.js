import { z } from 'zod';
import { DoseUnit, QuantityUnit } from '../../models/medication.model.js';
import { isValidDateOnly, isValidTime } from '../../lib/time.js';
import { objectIdSchema } from '../adults/adult.schemas.js';

const nameSchema = z
  .string({ error: 'es obligatorio' })
  .trim()
  .min(2, { error: 'debe tener al menos 2 caracteres' })
  .max(120, { error: 'no puede superar 120 caracteres' });

const positiveNumberSchema = z
  .number({ error: 'debe ser un número' })
  .finite({ error: 'debe ser un número finito' })
  .positive({ error: 'debe ser mayor que cero' });

const timeSchema = z
  .string({ error: 'debe tener formato HH:mm' })
  .regex(/^\d{2}:\d{2}$/, { error: 'debe tener formato HH:mm' })
  .refine(isValidTime, { error: 'debe ser una hora válida' });

const daysSchema = z
  .array(z.number({ error: 'debe ser un número' }).int().min(0).max(6), {
    error: 'debe ser una lista de días',
  })
  .min(1, { error: 'debe incluir al menos un día' })
  .refine((days) => new Set(days).size === days.length, {
    error: 'no puede haber días repetidos',
  });

export const scheduleSchema = z
  .strictObject({
    times: z
      .array(timeSchema, { error: 'debe ser una lista de horarios' })
      .min(1, { error: 'debe incluir al menos un horario' })
      .max(6, { error: 'no puede incluir más de 6 horarios' })
      .refine((times) => new Set(times).size === times.length, {
        error: 'no puede haber horarios repetidos',
      }),
    daysOfWeek: daysSchema,
    startDate: z
      .string({ error: 'es obligatoria' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'debe tener formato YYYY-MM-DD' })
      .refine(isValidDateOnly, { error: 'no es una fecha válida' }),
    endDate: z
      .string({ error: 'debe tener formato YYYY-MM-DD' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'debe tener formato YYYY-MM-DD' })
      .refine(isValidDateOnly, { error: 'no es una fecha válida' })
      .nullable()
      .optional(),
  })
  .superRefine((schedule, ctx) => {
    if (schedule.endDate && schedule.endDate < schedule.startDate) {
      ctx.addIssue({
        path: ['endDate'],
        code: 'custom',
        message: 'debe ser posterior o igual a startDate',
      });
    }
  });

const instructionsSchema = z
  .string({ error: 'debe ser texto' })
  .trim()
  .max(300, { error: 'no puede superar 300 caracteres' });

const graceMinutesSchema = z
  .number({ error: 'debe ser un número' })
  .int({ error: 'debe ser un número entero' })
  .min(15, { error: 'debe ser al menos 15 minutos' })
  .max(720, { error: 'no puede superar 720 minutos' });

export const medicationIdParamsSchema = z.strictObject({
  adultId: objectIdSchema,
  medicationId: objectIdSchema,
});

export const medicationAdultParamsSchema = z.strictObject({ adultId: objectIdSchema });

export const medicationQuerySchema = z.strictObject({
  includeInactive: z
    .enum(['true', 'false'], { error: 'debe ser true o false' })
    .default('false')
    .transform((value) => value === 'true'),
});

const medicationFields = {
  name: nameSchema,
  dose: positiveNumberSchema,
  doseUnit: z.enum(Object.values(DoseUnit), { error: 'unidad de dosis inválida' }),
  quantity: positiveNumberSchema,
  quantityUnit: z.enum(Object.values(QuantityUnit), { error: 'unidad de cantidad inválida' }),
  instructions: instructionsSchema.nullable().optional(),
  schedule: scheduleSchema,
  graceMinutes: graceMinutesSchema.default(180),
};

export const createMedicationSchema = z.strictObject(medicationFields);

export const updateMedicationSchema = z
  .strictObject({
    name: medicationFields.name.optional(),
    dose: medicationFields.dose.optional(),
    doseUnit: medicationFields.doseUnit.optional(),
    quantity: medicationFields.quantity.optional(),
    quantityUnit: medicationFields.quantityUnit.optional(),
    instructions: medicationFields.instructions,
    schedule: medicationFields.schedule.optional(),
    graceMinutes: medicationFields.graceMinutes.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: 'debe incluir al menos un campo para actualizar',
  });
