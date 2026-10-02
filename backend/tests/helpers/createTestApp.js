/**
 * Helper de tests: arma la app con un entorno válido y un logger que escribe en memoria.
 *
 * Nunca abre un puerto ni conecta a Mongo: eso lo hace `memoryMongo.js` cuando el test
 * lo necesita. Así la mayoría de los tests corren en milisegundos.
 */
import { Writable } from 'node:stream';
import { createApp } from '../../src/app.js';
import { createLogger } from '../../src/config/logger.js';
import { parseEnv } from '../../src/config/env.js';

/**
 * Entorno mínimo válido para los tests.
 *
 * Los secretos son de prueba y no se parecen a nada de producción. `BCRYPT_COST: 4` es
 * deliberado: con cost 12 cada login tardaría ~250 ms y la suite se volvería inusable.
 * La validación del entorno impide ese valor en producción.
 */
export const baseTestEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/chatio_test',
  LOG_LEVEL: 'info',
  CORS_ORIGINS: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'secreto-de-acceso-solo-para-tests-0123456789',
  JWT_REFRESH_SECRET: 'secreto-de-refresh-solo-para-tests-9876543210',
  BCRYPT_COST: '4',
};

/** Stream que acumula las líneas JSON que emite pino. */
export function createLogSink() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return {
    stream,
    get raw() {
      return lines.join('');
    },
    get records() {
      return lines
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
}

/**
 * @param {Record<string, string>} [overrides] Variables de entorno a sobreescribir.
 * @returns {{ app: import('express').Express, env: object, logger: object, logs: ReturnType<typeof createLogSink> }}
 */
export function createTestApp(overrides = {}) {
  const env = parseEnv({ ...baseTestEnv, ...overrides });
  const logs = createLogSink();
  const logger = createLogger(env, logs.stream);
  const app = createApp({ env, logger });
  return { app, env, logger, logs };
}
