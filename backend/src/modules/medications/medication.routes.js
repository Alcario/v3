import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createRequireAuth } from '../../middleware/auth.js';
import { requireAdultAccess } from '../../middleware/authorize.js';
import { createMedicationService } from './medication.service.js';
import { createMedicationController } from './medication.controller.js';
import {
  createMedicationSchema,
  medicationAdultParamsSchema,
  medicationIdParamsSchema,
  medicationQuerySchema,
  updateMedicationSchema,
} from './medication.schemas.js';

export function createMedicationRouter({
  env,
  medicationService = createMedicationService(),
} = {}) {
  const router = Router();
  const requireAuth = createRequireAuth({ env });
  const controller = createMedicationController({ medicationService });
  const adultAccess = [
    requireAuth,
    validate({ params: medicationAdultParamsSchema }),
    requireAdultAccess,
  ];
  const medicationAccess = [
    requireAuth,
    validate({ params: medicationIdParamsSchema }),
    requireAdultAccess,
  ];

  router.get(
    '/:adultId/medications',
    ...adultAccess,
    validate({ query: medicationQuerySchema }),
    controller.list,
  );
  router.post(
    '/:adultId/medications',
    ...adultAccess,
    validate({ body: createMedicationSchema }),
    controller.create,
  );
  router.get('/:adultId/medications/:medicationId', ...medicationAccess, controller.get);
  router.patch(
    '/:adultId/medications/:medicationId',
    ...medicationAccess,
    validate({ body: updateMedicationSchema }),
    controller.update,
  );
  router.post(
    '/:adultId/medications/:medicationId/activate',
    ...medicationAccess,
    controller.activate,
  );
  router.post(
    '/:adultId/medications/:medicationId/deactivate',
    ...medicationAccess,
    controller.deactivate,
  );
  router.delete('/:adultId/medications/:medicationId', ...medicationAccess, controller.remove);

  return { router, medicationService };
}
