import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createLogger, REDACTED } from '../src/config/logger.js';
import { parseEnv } from '../src/config/env.js';
import { createTestApp, createLogSink, baseTestEnv } from './helpers/createTestApp.js';

const env = parseEnv({ ...baseTestEnv, LOG_LEVEL: 'debug' });

function loggerWithSink() {
  const logs = createLogSink();
  return { logger: createLogger(env, logs.stream), logs };
}

describe('redacción del logger (SECURITY.md §8)', () => {
  it('redacta la cabecera Authorization', () => {
    const { logger, logs } = loggerWithSink();

    logger.info({ req: { headers: { authorization: 'Bearer token-secretisimo' } } }, 'con auth');

    expect(logs.raw).not.toMatch(/token-secretisimo/);
    expect(logs.raw).toMatch(REDACTED);
  });

  it('redacta las cookies', () => {
    const { logger, logs } = loggerWithSink();

    logger.info({ req: { headers: { cookie: 'chatio_rt=valor-de-refresh' } } }, 'con cookie');

    expect(logs.raw).not.toMatch(/valor-de-refresh/);
  });

  it('redacta contraseñas y hashes', () => {
    const { logger, logs } = loggerWithSink();

    logger.info({ password: 'hunter2', passwordHash: '$2b$12$abcdef' }, 'credenciales');

    expect(logs.raw).not.toMatch(/hunter2/);
    expect(logs.raw).not.toMatch(/\$2b\$12/);
  });

  it('redacta tokens de todo tipo, incluido el de Alexa', () => {
    const { logger, logs } = loggerWithSink();

    logger.info(
      {
        accessToken: 'at-123',
        refreshToken: 'rt-456',
        apiAccessToken: 'alexa-api-789',
        alertToken: 'alert.token.abc',
      },
      'tokens',
    );

    for (const secret of ['at-123', 'rt-456', 'alexa-api-789', 'alert.token.abc']) {
      expect(logs.raw).not.toMatch(secret);
    }
  });

  it('redacta el código de vinculación y los identificadores de Alexa', () => {
    const { logger, logs } = loggerWithSink();

    logger.info(
      {
        pairingCode: '4723',
        codeHash: 'hash-del-codigo',
        alexaUserId: 'amzn1.ask.account.AG',
      },
      'vinculación',
    );

    expect(logs.raw).not.toMatch(/4723/);
    expect(logs.raw).not.toMatch(/hash-del-codigo/);
    expect(logs.raw).not.toMatch(/amzn1\.ask\.account/);
  });

  it('redacta datos personales y de salud', () => {
    const { logger, logs } = loggerWithSink();

    logger.info(
      {
        email: 'rosa@ejemplo.com',
        medicationName: 'Losartán',
        dose: 50,
        notes: 'información sensible del adulto',
        instructions: 'después del desayuno',
      },
      'datos',
    );

    expect(logs.raw).not.toMatch(/rosa@ejemplo\.com/);
    expect(logs.raw).not.toMatch(/Losartán/);
    expect(logs.raw).not.toMatch(/información sensible/);
    expect(logs.raw).not.toMatch(/desayuno/);
  });

  it('redacta también un nivel de anidación, que es como logueamos objetos', () => {
    const { logger, logs } = loggerWithSink();

    logger.info({ payload: { password: 'anidada-secreta', email: 'x@y.com' } }, 'anidado');

    expect(logs.raw).not.toMatch(/anidada-secreta/);
    expect(logs.raw).not.toMatch(/x@y\.com/);
  });

  it('sí deja pasar lo que hace falta para diagnosticar', () => {
    const { logger, logs } = loggerWithSink();

    logger.info({ adultId: '66f1a000', requestId: 'abc-123', status: 'PENDING' }, 'diagnóstico');

    expect(logs.raw).toMatch(/66f1a000/);
    expect(logs.raw).toMatch(/abc-123/);
    expect(logs.raw).toMatch(/PENDING/);
  });

  it('respeta el nivel configurado', () => {
    const quietEnv = parseEnv({ ...baseTestEnv, LOG_LEVEL: 'error' });
    const logs = createLogSink();
    const logger = createLogger(quietEnv, logs.stream);

    logger.info('esto no debería salir');
    logger.error('esto sí');

    expect(logs.raw).not.toMatch(/no debería salir/);
    expect(logs.raw).toMatch(/esto sí/);
  });
});

describe('log de acceso HTTP', () => {
  it('registra método, path, status y requestId', async () => {
    const { app, logs } = createTestApp();

    await request(app).get('/api/v1/algo');

    // El log de acceso es el único registro que trae `res`: los warn del dominio
    // heredan `req` del logger hijo de pino-http pero no tienen respuesta.
    const accessLog = logs.records.find((record) => record.res);
    expect(accessLog.req).toMatchObject({ method: 'GET', path: '/api/v1/algo' });
    expect(accessLog.res.statusCode).toBe(404);
    expect(accessLog['x-request-id']).toBeTypeOf('string');
  });

  it('no registra el body de la solicitud', async () => {
    const { app, logs } = createTestApp();

    await request(app).post('/api/v1/algo').send({ password: 'no-debe-aparecer' });

    expect(logs.raw).not.toMatch(/no-debe-aparecer/);
  });

  it('no registra el query string, que puede llevar datos personales', async () => {
    const { app, logs } = createTestApp();

    await request(app).get('/api/v1/algo?email=rosa@ejemplo.com&adultId=66f1');

    expect(logs.raw).not.toMatch(/rosa@ejemplo\.com/);
    const accessLog = logs.records.find((record) => record.res);
    expect(accessLog.req.path).toBe('/api/v1/algo');
  });

  it('no registra la cabecera Authorization de una solicitud real', async () => {
    const { app, logs } = createTestApp();

    await request(app).get('/api/v1/algo').set('Authorization', 'Bearer jwt-que-no-debe-loguearse');

    expect(logs.raw).not.toMatch(/jwt-que-no-debe-loguearse/);
  });

  it('usa nivel warn para 4xx', async () => {
    const { app, logs } = createTestApp();

    await request(app).get('/api/v1/inexistente');

    const accessLog = logs.records.find((record) => record.res);
    expect(accessLog.level).toBe('warn');
  });
});
