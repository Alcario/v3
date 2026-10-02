import { Router } from 'express';
import { createRequireAuth } from '../../middleware/auth.js';
import { requireAdultAccess } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { createOccurrenceController } from './occurrence.controller.js';
import { createOccurrenceService } from './occurrence.service.js';
import {
  confirmOccurrenceSchema,
  occurrenceAdultParamsSchema,
  occurrenceIdParamsSchema,
  occurrenceQuerySchema,
  skipOccurrenceSchema,
} from './occurrence.schemas.js';

export function createOccurrenceRouter({
  env,
  occurrenceService = createOccurrenceService(),
} = {}) {
  const router = Router();
  const requireAuth = createRequireAuth({ env });
  const controller = createOccurrenceController({ occurrenceService });
  const adultAccess = [
    requireAuth,
    validate({ params: occurrenceAdultParamsSchema }),
    requireAdultAccess,
  ];
  const occurrenceAccess = [
    requireAuth,
    validate({ params: occurrenceIdParamsSchema }),
    requireAdultAccess,
  ];

  router.get(
    '/:adultId/medication-occurrences',
    ...adultAccess,
    validate({ query: occurrenceQuerySchema }),
    controller.list,
  );
  router.post(
    '/:adultId/medication-occurrences/:occurrenceId/confirm',
    ...occurrenceAccess,
    validate({ body: confirmOccurrenceSchema }),
    controller.confirm,
  );
  router.post(
    '/:adultId/medication-occurrences/:occurrenceId/skip',
    ...occurrenceAccess,
    validate({ body: skipOccurrenceSchema }),
    controller.skip,
  );

  return { router, occurrenceService };
}
