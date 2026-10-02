/**
 * Arranque del proceso.
 *
 * Orden deliberado: primero valida el entorno (si es inválido, no arranca), después
 * abre el puerto, y recién entonces intenta conectar a Mongo **en segundo plano**.
 * Así `/health` responde aunque la base no esté, y `/ready` devuelve 503 hasta que
 * la dependencia crítica esté disponible — que es justamente para qué sirve `/ready`.
 *
 * La lógica de cierre vive en `lifecycle.js` para poder testearla.
 */
import { loadEnvOrExit } from './config/env.js';
import { createLogger } from './config/logger.js';
import { connectDbWithRetry, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { createShutdownHandler } from './lifecycle.js';
import { startOccurrenceScheduler } from './jobs/occurrenceScheduler.js';

const env = loadEnvOrExit();
const logger = createLogger(env);
const app = createApp({ env, logger });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, 'API Chatio escuchando');
});

let occurrenceScheduler = null;

const { shutdown, isShuttingDown } = createShutdownHandler({
  server,
  disconnect: disconnectDb,
  stopSchedulers: () => occurrenceScheduler?.stop(),
  logger,
  timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
});

connectDbWithRetry({
  uri: env.MONGODB_URI,
  logger,
  serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  shouldStop: isShuttingDown,
}).then((connected) => {
  if (connected && !isShuttingDown()) {
    startOccurrenceScheduler({ logger }).then((scheduler) => {
      occurrenceScheduler = scheduler;
    });
  }
  if (!connected && !isShuttingDown()) {
    logger.warn('La API está arriba sin base de datos: /ready responderá 503');
  }
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Promesa rechazada sin manejar');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Excepción no capturada');
  shutdown('uncaughtException');
});

export { app, server };
