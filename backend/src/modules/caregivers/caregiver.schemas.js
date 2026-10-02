import { z } from 'zod';
import { emailSchema } from '../auth/auth.schemas.js';
import { CaregiverRole } from '../../models/caregiverAccess.model.js';

export const caregiverAccessSchema = z.strictObject({
  email: emailSchema,
  role: z.enum(Object.values(CaregiverRole), { error: 'rol inválido' }),
});

export const caregiverRoleSchema = z.strictObject({
  role: z.enum(Object.values(CaregiverRole), { error: 'rol inválido' }),
});
