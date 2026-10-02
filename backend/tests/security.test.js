import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/createTestApp.js';

describe('cabeceras de seguridad', () => {
  it('aplica las cabeceras de helmet que exige SECURITY.md §10', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    expect(response.headers['strict-transport-security']).toMatch(/includeSubDomains/);
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('no anuncia el framework', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/health');

    expect(response.headers).not.toHaveProperty('x-powered-by');
  });
});

describe('CORS', () => {
  it('permite un origen de la allowlist y habilita credenciales', async () => {
    const { app } = createTestApp({ CORS_ORIGINS: 'https://panel.chatio.app' });

    const response = await request(app).get('/health').set('Origin', 'https://panel.chatio.app');

    expect(response.headers['access-control-allow-origin']).toBe('https://panel.chatio.app');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('no habilita un origen que no está en la allowlist', async () => {
    const { app } = createTestApp({ CORS_ORIGINS: 'https://panel.chatio.app' });

    const response = await request(app).get('/health').set('Origin', 'https://atacante.example');

    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
    // Un origen no permitido no es un error del servidor: lo bloquea el navegador.
    expect(response.status).toBe(200);
  });

  it('nunca devuelve el comodín, que rompería las cookies de sesión', async () => {
    const { app } = createTestApp({ CORS_ORIGINS: 'https://panel.chatio.app' });

    const response = await request(app).get('/health').set('Origin', 'https://panel.chatio.app');

    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('responde al preflight de un origen permitido', async () => {
    const { app } = createTestApp({ CORS_ORIGINS: 'https://panel.chatio.app' });

    const response = await request(app)
      .options('/health')
      .set('Origin', 'https://panel.chatio.app')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBeLessThan(300);
    expect(response.headers['access-control-allow-headers']).toMatch(/Authorization/i);
    expect(response.headers['access-control-expose-headers']).toMatch(/x-request-id/i);
  });

  it('atiende un pedido sin Origin, como el del monitoreo', async () => {
    const { app } = createTestApp({ CORS_ORIGINS: 'https://panel.chatio.app' });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
  });
});

describe('rate limiting', () => {
  it('corta al superar la cuota general y devuelve el envoltorio estándar', async () => {
    const { app } = createTestApp({ RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_MS: '60000' });

    // Las rutas bajo /api/v1 todavía no existen: devuelven 404, pero pasan por el
    // limitador, que es justamente lo que se quiere verificar.
    await request(app).get('/api/v1/x');
    await request(app).get('/api/v1/x');
    const blocked = await request(app).get('/api/v1/x');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBe('60');
    expect(blocked.body.error.requestId).toBeTypeOf('string');
  });

  it('los healthchecks tienen cuota propia y no consumen la de la API', async () => {
    const { app } = createTestApp({ RATE_LIMIT_MAX: '1', HEALTH_RATE_LIMIT_MAX: '50' });

    // Varios healthchecks no agotan la cuota de la API.
    await request(app).get('/health');
    await request(app).get('/health');
    await request(app).get('/health');
    const apiCall = await request(app).get('/api/v1/x');

    expect(apiCall.status).toBe(404);
  });

  it('también limita los healthchecks, para que no sirvan de canal de sondeo', async () => {
    const { app } = createTestApp({
      HEALTH_RATE_LIMIT_MAX: '2',
      HEALTH_RATE_LIMIT_WINDOW_MS: '60000',
    });

    await request(app).get('/health');
    await request(app).get('/health');
    const blocked = await request(app).get('/health');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
