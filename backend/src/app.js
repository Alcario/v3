/**
 * Fábrica de la aplicación Express.
 *
 * `app` está separada de `server` (ARCHITECTURE.md §3) para poder montarla en los
 * tests sin abrir un puerto ni conectar nada. Todo lo que la app necesita entra por
 * parámetro: no lee `process.env` ni crea su propio logger.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { requestId, REQUEST_ID_HEADER } from './middleware/requestId.js';
import { createHttpLogger } from './middleware/httpLogger.js';
import { createErrorHandler } from './middleware/error.js';
import { notFoundHandler } from './middleware/notFound.js';
import { createGlobalRateLimiter, createHealthRateLimiter } from './middleware/rateLimit.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createApiRouter } from './routes.js';

export const API_PREFIX = '/api/v1';

/** CORS con allowlist explícita. Nunca `*`: es incompatible con cookies y abre la API. */
function createCorsOptions(env) {
  const allowed = new Set(env.CORS_ORIGINS);
  return {
    origin(origin, callback) {
      // Sin `Origin` (curl, healthchecks, server-to-server) no hay nada que validar.
      if (!origin) return callback(null, true);
      // Origen no permitido: se responde sin cabeceras CORS y el navegador bloquea.
      // No se lanza un error para no convertir un CORS fallido en un 500.
      return callback(null, allowed.has(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER, 'Retry-After'],
    maxAge: 600,
  };
}

/**
 * @param {{ env: object, logger: import('pino').Logger }} deps
 */
export function createApp({ env, logger }) {
  const app = express();

  app.disable('x-powered-by');
  // Detrás de Nginx: sin esto, el rate limiting vería siempre la IP del proxy.
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(requestId);
  app.use(createHttpLogger(logger));

  app.use(
    helmet({
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: false },
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(cors(createCorsOptions(env)));

  // Health antes del parser y del rate limit general: el monitoreo no debe consumir
  // la cuota de la API, y tiene su propia cuota.
  app.use(createHealthRateLimiter(env), createHealthRouter());

  // AQUÍ va `POST /alexa/skill` (Iteración 11): necesita el body CRUDO para verificar
  // la firma ASK, así que se monta ANTES del parser JSON global (ARCHITECTURE.md A1).

  app.use(express.json({ limit: env.BODY_LIMIT }));
  // Solo lee cookies. No se firma: la única cookie que usamos es un JWT, que ya trae su
  // propia firma, y un secreto de firma de cookies sería un secreto más que custodiar.
  app.use(cookieParser());
  app.use(createGlobalRateLimiter(env));

  app.use(API_PREFIX, createApiRouter({ env }));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
