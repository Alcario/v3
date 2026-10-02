import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createRequireAuth } from '../../middleware/auth.js';
import { requireAdultAccess, requireRole } from '../../middleware/authorize.js';
import {
  accessIdParamsSchema,
  adultIdParamsSchema,
  createAdultSchema,
  updateAdultSchema,
} from './adult.schemas.js';
import { caregiverAccessSchema, caregiverRoleSchema } from '../caregivers/caregiver.schemas.js';
import { createAdultController } from './adult.controller.js';
import { createCaregiverController } from '../caregivers/caregiver.controller.js';
import { createAdultService } from './adult.service.js';
import { createCaregiverService } from '../caregivers/caregiver.service.js';

export function createAdultRouter({
  env,
  adultService = createAdultService(),
  caregiverService = createCaregiverService(),
} = {}) {
  const router = Router();
  const requireAuth = createRequireAuth({ env });
  const adultController = createAdultController({ adultService });
  const caregiverController = createCaregiverController({ caregiverService });
  const adultAccess = [requireAuth, validate({ params: adultIdParamsSchema }), requireAdultAccess];
  const accessResource = [
    requireAuth,
    validate({ params: accessIdParamsSchema }),
    requireAdultAccess,
  ];

  router.get('/', requireAuth, adultController.list);
  router.post('/', requireAuth, validate({ body: createAdultSchema }), adultController.create);

  router.get('/:adultId', ...adultAccess, adultController.get);
  router.patch(
    '/:adultId',
    ...adultAccess,
    requireRole('OWNER'),
    validate({ body: updateAdultSchema }),
    adultController.update,
  );
  router.post(
    '/:adultId/deactivate',
    ...adultAccess,
    requireRole('OWNER'),
    adultController.deactivate,
  );
  router.post('/:adultId/activate', ...adultAccess, requireRole('OWNER'), adultController.activate);

  router.get('/:adultId/caregivers', ...adultAccess, caregiverController.list);
  router.post(
    '/:adultId/caregivers',
    ...adultAccess,
    requireRole('OWNER'),
    validate({ body: caregiverAccessSchema }),
    caregiverController.grant,
  );
  router.patch(
    '/:adultId/caregivers/:accessId',
    ...accessResource,
    requireRole('OWNER'),
    validate({ body: caregiverRoleSchema }),
    caregiverController.changeRole,
  );
  router.delete(
    '/:adultId/caregivers/:accessId',
    ...accessResource,
    requireRole('OWNER'),
    caregiverController.revoke,
  );

  return { router, adultService, caregiverService };
}
