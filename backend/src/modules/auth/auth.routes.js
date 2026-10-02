/**
 * Rutas de autenticación (API.md §3).
 *
 * Los rate limits específicos se aplican acá y no de forma global: el límite general de
 * 300/15 min no protege un login por fuerza bruta (SECURITY.md T5).
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createLoginRateLimiter, createRefreshRateLimiter } from '../../middleware/rateLimit.js';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';
import { loginSchema } from './auth.schemas.js';

export function createAuthRouter({ env, adultService }) {
  const router = Router();
  const authService = createAuthService({ env });
  const controller = createAuthController({ authService, env, adultService });
  const requireAuth = createRequireAuth({ env });

  router.post(
    '/login',
    createLoginRateLimiter(env),
    validate({ body: loginSchema }),
    controller.login,
  );

  // `/refresh` y `/logout` no llevan `requireAuth`: se autentican con la cookie, que es
  // justamente lo que se usa cuando el access token ya expiró.
  router.post('/refresh', createRefreshRateLimiter(env), controller.refresh);
  router.post('/logout', controller.logout);

  router.get('/me', requireAuth, controller.me);

  return { router, authService };
}
