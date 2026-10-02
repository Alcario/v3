import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp, createLogSink, baseTestEnv } from './helpers/createTestApp.js';
import { createLogger } from '../src/config/logger.js';
import { parseEnv } from '../src/config/env.js';
import { createErrorHandler } from '../src/middleware/error.js';
import { AppError, ERROR_CODES } from '../src/lib/errors.js';

/** Respuesta falsa mínima para probar el error handler como unidad. */
function fakeRes() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('AppError', () => {
  it('deriva el status HTTP del código', () => {
    expect(new AppError('NOT_FOUND', 'x').httpStatus).toBe(404);
    expect(new AppError('VALIDATION_ERROR', 'x').httpStatus).toBe(400);
    expect(new AppError('RATE_LIMITED', 'x').httpStatus).toBe(429);
    expect(new AppError('INTERNAL_ERROR', 'x').httpStatus).toBe(500);
  });

  it('rechaza un código que no está en el contrato', () => {
    expect(() => new AppError('CODIGO_INVENTADO', 'x')).toThrow(TypeError);
  });

  it('expone los códigos documentados en API.md', () => {
    expect(Object.keys(ERROR_CODES)).toEqual(
      expect.arrayContaining([
        'VALIDATION_ERROR',
        'UNAUTHENTICATED',
        'INVALID_CREDENTIALS',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'INVALID_STATE',
        'BUSINESS_RULE',
        'RATE_LIMITED',
        'INTERNAL_ERROR',
      ]),
    );
  });
});

describe('errorHandler', () => {
  const env = parseEnv(baseTestEnv);

  function setup() {
    const logs = createLogSink();
    const logger = createLogger(env, logs.stream);
    return { handler: createErrorHandler(logger), logs };
  }

  it('convierte un error inesperado en 500 con mensaje genérico y sin stack', () => {
    const { handler } = setup();
    const res = fakeRes();
    const boom = new Error('connect ECONNREFUSED 10.0.0.5:27017 en collection usuarios');

    handler(boom, { id: 'req-1' }, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.requestId).toBe('req-1');
    // Nada del error original llega al cliente.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/ECONNREFUSED/);
    expect(serialized).not.toMatch(/10\.0\.0\.5/);
    expect(serialized).not.toMatch(/usuarios/);
    expect(serialized).not.toMatch(/at /);
    expect(res.body.error.stack).toBeUndefined();
  });

  it('loguea el error completo del lado del servidor', () => {
    const { handler, logs } = setup();

    handler(new Error('detalle interno'), { id: 'req-2' }, fakeRes(), vi.fn());

    expect(logs.raw).toMatch(/detalle interno/);
  });

  it('respeta el mensaje de un AppError operacional', () => {
    const { handler } = setup();
    const res = fakeRes();

    handler(new AppError('CONFLICT', 'Ese email ya está registrado.'), { id: 'r' }, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'Ese email ya está registrado.',
      requestId: 'r',
    });
  });

  it('agrega Retry-After cuando el error lo trae', () => {
    const { handler } = setup();
    const res = fakeRes();

    handler(new AppError('RATE_LIMITED', 'muchas', { retryAfterSeconds: 42 }), {}, res, vi.fn());

    expect(res.headers['retry-after']).toBe('42');
  });

  it('incluye details solo cuando el error los trae', () => {
    const { handler } = setup();
    const withDetails = fakeRes();
    const withoutDetails = fakeRes();

    handler(
      new AppError('VALIDATION_ERROR', 'mal', { details: [{ path: 'body.a', message: 'req' }] }),
      {},
      withDetails,
      vi.fn(),
    );
    handler(new AppError('NOT_FOUND', 'no está'), {}, withoutDetails, vi.fn());

    expect(withDetails.body.error.details).toEqual([{ path: 'body.a', message: 'req' }]);
    expect(withoutDetails.body.error).not.toHaveProperty('details');
  });
});

describe('404 y errores a través de la app real', () => {
  it('una ruta inexistente devuelve 404 con el envoltorio estándar', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBeTypeOf('string');
    expect(response.body.error.requestId).toBeTypeOf('string');
  });

  it('no refleja la ruta pedida en el mensaje de error', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/ruta-reflejada-12345');

    expect(response.text).not.toMatch(/ruta-reflejada-12345/);
  });

  it('un método no soportado en una ruta existente también devuelve 404', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/health');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('un JSON mal formado devuelve 400 VALIDATION_ERROR con details', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/v1/cualquier-cosa')
      .set('Content-Type', 'application/json')
      .send('{"roto": ');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([{ path: 'body', message: 'JSON inválido' }]);
  });

  it('un body que excede el límite devuelve 413 PAYLOAD_TOO_LARGE', async () => {
    const { app } = createTestApp({ BODY_LIMIT: '1kb' });

    const response = await request(app)
      .post('/api/v1/cualquier-cosa')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ relleno: 'x'.repeat(4096) }));

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('el requestId de la respuesta coincide con el del header', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/no-existe');

    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});
