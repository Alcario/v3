/**
 * Alta administrativa de usuarios (**D002**: no hay registro público).
 *
 * Restringido a `isPlatformAdmin`. El primer administrador no se crea acá —haría falta
 * uno para crear el primero—: se crea con `npm run seed:admin`, que corre en el servidor
 * con acceso a la base. Deliberadamente **no** existe ningún endpoint público de
 * bootstrap tipo `POST /register-admin`.
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createRequireAuth, requirePlatformAdmin } from '../../middleware/auth.js';
import { createAuthService } from '../auth/auth.service.js';
import { createUserSchema } from '../auth/auth.schemas.js';
import { logSecurityEvent, SecurityEvent } from '../../lib/securityLog.js';

export function createAdminRouter({ env }) {
  const router = Router();
  const authService = createAuthService({ env });
  const requireAuth = createRequireAuth({ env });

  router.post(
    '/users',
    requireAuth,
    requirePlatformAdmin,
    validate({ body: createUserSchema }),
    async (req, res, next) => {
      try {
        const user = await authService.createUser(req.validated.body);

        logSecurityEvent(req, SecurityEvent.USER_CREATED, {
          userId: user._id.toString(),
          createdBy: req.actor.userId,
        });

        res.status(201).json({ data: user.toPublicJSON() });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
