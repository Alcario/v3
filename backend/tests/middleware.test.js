import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createTestApp, createLogSink, baseTestEnv } from './helpers/createTestApp.js';
import { requestId, REQUEST_ID_HEADER } from '../src/middleware/requestId.js';
import { validate } from '../src/middleware/validate.js';
import { createErrorHandler } from '../src/middleware/error.js';
import { createLogger } from '../src/config/logger.js';
import { parseEnv } from '../src/config/env.js';

describe('requestId', () => {
  it('genera un identificador y lo devuelve en la cabecera', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/health');

    expect(response.headers[REQUEST_ID_HEADER]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('reutiliza el identificador entrante cuando tiene formato seguro', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/health').set(REQUEST_ID_HEADER, 'nginx-abc_123.4');

    expect(response.headers[REQUEST_ID_HEADER]).toBe('nginx-abc_123.4');
  });

  it('descarta un identificador entrante con caracteres peligrosos', async () => {
    const { app } = createTestApp();
    // Node rechaza en el cliente un header con salto de línea, así que el vector
    // realista es un valor legal como header pero con caracteres que no queremos ver
    // en un log: espacios, comillas y separadores.
    const injection = 'abc "level":"fatal" log-falsificado';

    const response = await request(app).get('/no-existe').set(REQUEST_ID_HEADER, injection);

    expect(response.headers[REQUEST_ID_HEADER]).not.toBe(injection);
    expect(response.body.error.requestId).not.toContain('log-falsificado');
  });

  it('descarta un identificador entrante demasiado largo', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/health').set(REQUEST_ID_HEADER, 'x'.repeat(200));

    expect(response.headers[REQUEST_ID_HEADER]).not.toBe('x'.repeat(200));
  });

  it('un identificador distinto por solicitud', async () => {
    const { app } = createTestApp();

    const first = await request(app).get('/health');
    const second = await request(app).get('/health');

    expect(first.headers[REQUEST_ID_HEADER]).not.toBe(second.headers[REQUEST_ID_HEADER]);
  });
});

describe('validate', () => {
  const env = parseEnv(baseTestEnv);

  /** App mínima que monta el middleware contra un esquema real. */
  function appWith(schemas) {
    const app = express();
    app.use(requestId);
    app.use(express.json());
    app.post('/recurso/:id', validate(schemas), (req, res) => res.json({ ok: req.validated }));
    // Logger a memoria: un test no debe escribir en la salida de la suite.
    app.use(createErrorHandler(createLogger(env, createLogSink().stream)));
    return app;
  }

  const bodySchema = z.strictObject({
    name: z.string().min(2),
    dose: z.coerce.number().positive(),
  });

  it('deja los datos validados en req.validated', async () => {
    const app = appWith({ body: bodySchema });

    const response = await request(app).post('/recurso/1').send({ name: 'Losartán', dose: '50' });

    expect(response.status).toBe(200);
    // El `coerce` se aplicó: llega el número, no la cadena.
    expect(response.body.ok.body).toEqual({ name: 'Losartán', dose: 50 });
  });

  it('rechaza una propiedad desconocida con 400 y details', async () => {
    const app = appWith({ body: bodySchema });

    const response = await request(app)
      .post('/recurso/1')
      .send({ name: 'Losartán', dose: 50, isAdmin: true });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.some((d) => d.path.includes('isAdmin'))).toBe(true);
  });

  it('prefija el origen en el path de cada detalle', async () => {
    const app = appWith({ body: bodySchema });

    const response = await request(app).post('/recurso/1').send({ name: 'x', dose: -1 });

    const paths = response.body.error.details.map((d) => d.path);
    expect(paths).toContain('body.name');
    expect(paths).toContain('body.dose');
  });

  it('valida params y query además del body', async () => {
    const app = appWith({
      params: z.object({ id: z.string().regex(/^[0-9a-f]{24}$/, 'no es un ObjectId válido') }),
      query: z.strictObject({ limit: z.coerce.number().int().max(100).optional() }),
    });

    const bad = await request(app).post('/recurso/no-es-un-id?limit=500');
    const good = await request(app).post(`/recurso/${'a'.repeat(24)}?limit=20`);

    expect(bad.status).toBe(400);
    expect(bad.body.error.details.map((d) => d.path)).toEqual(
      expect.arrayContaining(['params.id', 'query.limit']),
    );
    expect(good.status).toBe(200);
    expect(good.body.ok.query).toEqual({ limit: 20 });
  });

  it('no valida nada si no se le pasa esquema para esa fuente', async () => {
    const app = appWith({ body: bodySchema });

    const response = await request(app).post('/recurso/cualquier-cosa?x=1').send({
      name: 'Losartán',
      dose: 50,
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).not.toHaveProperty('params');
    expect(response.body.ok).not.toHaveProperty('query');
  });
});
