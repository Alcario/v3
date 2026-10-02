/**
 * Router de la API versionada. Único punto donde se montan los módulos de negocio.
 */
import { Router } from 'express';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createAdultRouter } from './modules/adults/adult.routes.js';
import { createMedicationRouter } from './modules/medications/medication.routes.js';
import { createOccurrenceRouter } from './modules/occurrences/occurrence.routes.js';

export function createApiRouter({ env }) {
  const router = Router();

  const adultModule = createAdultRouter({ env });
  const { router: authRouter } = createAuthRouter({ env, adultService: adultModule.adultService });
  router.use('/auth', authRouter);
  router.use('/admin', createAdminRouter({ env }));

  // Los módulos de adultos, medicamentos, recordatorios, agenda, actividad y ayuda se
  // montan acá a partir de la Iteración 3, cada uno detrás de `requireAdultAccess`.

  router.use('/adults', adultModule.router);
  router.use('/adults', createMedicationRouter({ env }).router);
  router.use('/adults', createOccurrenceRouter({ env }).router);

  return router;
}
