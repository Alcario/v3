import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/createTestApp.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';
import { disconnectDb, isConnected } from '../src/config/db.js';

describe('GET /health (liveness)', () => {
  it('responde 200 aunque no haya base de datos', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('no expone versiones, hostname ni configuración interna', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/health');

    // El cuerpo tiene exactamente una clave: nada de version, uptime ni env.
    expect(Object.keys(response.body)).toEqual(['status']);
    expect(response.text).not.toMatch(/mongodb:\/\//);
  });

  it('no genera log de acceso, para no inundar con el monitoreo', async () => {
    const { app, logs } = createTestApp();

    await request(app).get('/health');

    expect(logs.records.filter((record) => record.req)).toHaveLength(0);
  });
});

describe('GET /ready (readiness) sin Mongo', () => {
  it('responde 503 y marca la base como caída', async () => {
    const { app } = createTestApp();
    await disconnectDb();

    const response = await request(app).get('/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable', checks: { db: 'down' } });
  });

  it('no filtra la URI de Mongo ni detalles del error', async () => {
    const { app } = createTestApp();
    await disconnectDb();

    const response = await request(app).get('/ready');

    expect(response.text).not.toMatch(/mongodb/i);
    expect(response.text).not.toMatch(/27017/);
  });
});

describe('GET /ready (readiness) con Mongo disponible', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  it('responde 200 cuando la base responde al ping', async () => {
    const { app } = createTestApp();
    expect(isConnected()).toBe(true);

    const response = await request(app).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { db: 'up' } });
  });

  it('vuelve a 503 si la conexión se cae', async () => {
    const { app } = createTestApp();
    await disconnectDb();

    const response = await request(app).get('/ready');

    expect(response.status).toBe(503);
    expect(response.body.checks.db).toBe('down');
  });
});
