import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, baseTestEnv } from './helpers/createTestApp.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';
import {
  makeUser,
  login,
  extractRefreshCookie,
  cookieHeader,
  activeSessions,
} from './helpers/authFixtures.js';
import { User, UserStatus } from '../src/models/user.model.js';
import { AuthSession, SessionStatus, RevocationReason } from '../src/models/authSession.model.js';
import { REFRESH_COOKIE_NAME } from '../src/lib/cookies.js';
import { REFRESH_AUDIENCE, ISSUER, hashToken } from '../src/modules/auth/tokens.js';

const post = (app, path, cookie) => {
  const req = request(app).post(path);
  return cookie ? req.set('Cookie', cookieHeader(cookie)) : req;
};

describe('POST /api/v1/auth/refresh', () => {
  let app;
  let env;

  beforeAll(async () => {
    await startMemoryMongo();
    await Promise.all([User.syncIndexes(), AuthSession.syncIndexes()]);
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), AuthSession.deleteMany({})]);
    ({ app, env } = createTestApp());
  });

  describe('rotación', () => {
    it('devuelve un access token nuevo y rota la cookie', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);

      const response = await post(app, '/api/v1/auth/refresh', refreshCookie);
      const rotated = extractRefreshCookie(response);

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeTypeOf('string');
      expect(response.body.data.expiresIn).toBe(900);
      expect(rotated).not.toBeNull();
      expect(rotated.value).not.toBe(refreshCookie.value);
    });

    it('mantiene la misma sesión y solo incrementa el contador de rotaciones', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);
      const before = (await activeSessions(user._id))[0];

      const response = await post(app, '/api/v1/auth/refresh', refreshCookie);
      const sessions = await activeSessions(user._id);

      expect(response.status).toBe(200);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]._id.toString()).toBe(before._id.toString());
      expect(sessions[0].rotationCount).toBe(1);
      expect(sessions[0].lastRotatedAt).toBeInstanceOf(Date);
    });

    it('guarda el hash del token nuevo y descarta el del anterior', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);

      const response = await post(app, '/api/v1/auth/refresh', refreshCookie);
      const rotated = extractRefreshCookie(response);
      const session = (await activeSessions(user._id))[0];

      expect(session.tokenHash).toBe(hashToken(rotated.value));
      expect(session.tokenHash).not.toBe(hashToken(refreshCookie.value));
    });

    it('el token rotado sirve para volver a refrescar, en cadena', async () => {
      const user = await makeUser({ env });
      let cookie = (await login(app, user.email)).refreshCookie;

      for (let round = 0; round < 4; round += 1) {
        const response = await post(app, '/api/v1/auth/refresh', cookie);
        expect(response.status).toBe(200);
        cookie = extractRefreshCookie(response);
      }

      const session = (await activeSessions(user._id))[0];
      expect(session.rotationCount).toBe(4);
    });

    it('el refresh token apunta a su sesión y lleva un jti distinto en cada rotación', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);
      const first = jwt.decode(refreshCookie.value);

      const response = await post(app, '/api/v1/auth/refresh', refreshCookie);
      const second = jwt.decode(extractRefreshCookie(response).value);

      expect(first.aud).toBe(REFRESH_AUDIENCE);
      expect(first.iss).toBe(ISSUER);
      expect(second.sid).toBe(first.sid);
      expect(second.jti).not.toBe(first.jti);
    });
  });

  describe('detección de reutilización (D028)', () => {
    it('reutilizar el token anterior después de rotar devuelve 401', async () => {
      const user = await makeUser({ env });
      const { refreshCookie: r1 } = await login(app, user.email);

      // R1 -> R2
      const rotation = await post(app, '/api/v1/auth/refresh', r1);
      expect(rotation.status).toBe(200);

      // Se intenta usar R1 otra vez.
      const reuse = await post(app, '/api/v1/auth/refresh', r1);

      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('la reutilización revoca la sesión entera: R2 también deja de servir', async () => {
      const user = await makeUser({ env });
      const { refreshCookie: r1 } = await login(app, user.email);
      const r2 = extractRefreshCookie(await post(app, '/api/v1/auth/refresh', r1));

      await post(app, '/api/v1/auth/refresh', r1); // replay de R1

      const withR2 = await post(app, '/api/v1/auth/refresh', r2);
      expect(withR2.status).toBe(401);

      const session = await AuthSession.findOne({ userId: user._id });
      expect(session.status).toBe(SessionStatus.REVOKED);
      expect(session.revokedReason).toBe(RevocationReason.REUSE_DETECTED);
      expect(session.revokedAt).toBeInstanceOf(Date);
    });

    it('la reutilización no afecta las sesiones de otros dispositivos', async () => {
      const user = await makeUser({ env });
      const device1 = (await login(app, user.email)).refreshCookie;
      const device2 = (await login(app, user.email)).refreshCookie;

      await post(app, '/api/v1/auth/refresh', device1); // rota el dispositivo 1
      await post(app, '/api/v1/auth/refresh', device1); // replay -> revoca solo esa sesión

      const stillWorks = await post(app, '/api/v1/auth/refresh', device2);
      expect(stillWorks.status).toBe(200);
      expect(await activeSessions(user._id)).toHaveLength(1);
    });

    it('borra la cookie cuando detecta la reutilización', async () => {
      const user = await makeUser({ env });
      const { refreshCookie: r1 } = await login(app, user.email);
      await post(app, '/api/v1/auth/refresh', r1);

      const reuse = await post(app, '/api/v1/auth/refresh', r1);
      const cleared = extractRefreshCookie(reuse);

      // `clearCookie` manda el valor vacío con Expires en el pasado.
      expect(cleared.value).toBe('');
      expect(cleared.attributes).toContain('path=/api/v1/auth');
    });

    it('registra AUTH_REFRESH_REUSE con nivel error y la IP', async () => {
      const { app: testApp, env: testEnv, logs } = createTestApp();
      const user = await makeUser({ env: testEnv });
      const { refreshCookie: r1 } = await login(testApp, user.email);
      await post(testApp, '/api/v1/auth/refresh', r1);

      await post(testApp, '/api/v1/auth/refresh', r1);

      const event = logs.records.find((r) => r.event === 'AUTH_REFRESH_REUSE');
      expect(event).toBeDefined();
      expect(event.level).toBe('error');
      expect(event.ip).toBeTypeOf('string');
      expect(event.reason).toBe('REUSE_DETECTED');
    });

    it('dos refresh simultáneos con el mismo token: uno rota y el otro se rechaza', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);

      const [first, second] = await Promise.all([
        post(app, '/api/v1/auth/refresh', refreshCookie),
        post(app, '/api/v1/auth/refresh', refreshCookie),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 401]);
    });
  });

  describe('rechazos', () => {
    it('sin cookie devuelve 401', async () => {
      const response = await request(app).post('/api/v1/auth/refresh');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rechaza un token firmado con otro secreto', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);
      const { sid } = jwt.decode(refreshCookie.value);
      const forged = jwt.sign({ sid, tv: 0 }, 'otro-secreto-completamente-distinto-123456', {
        subject: user._id.toString(),
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
        expiresIn: 3600,
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${forged}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un access token usado como refresh (audiencias distintas)', async () => {
      const user = await makeUser({ env });
      const { accessToken } = await login(app, user.email);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${accessToken}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un token expirado', async () => {
      const shortLived = createTestApp({ REFRESH_TOKEN_TTL_SECONDS: '1' });
      const user = await makeUser({ env: shortLived.env });
      const { refreshCookie } = await login(shortLived.app, user.email);

      await new Promise((resolve) => setTimeout(resolve, 1100));
      const response = await post(shortLived.app, '/api/v1/auth/refresh', refreshCookie);

      expect(response.status).toBe(401);
    });

    it('rechaza un token cuya sesión fue revocada', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);
      await AuthSession.updateOne(
        { userId: user._id },
        { $set: { status: SessionStatus.REVOKED, revokedReason: RevocationReason.LOGOUT } },
      );

      const response = await post(app, '/api/v1/auth/refresh', refreshCookie);

      expect(response.status).toBe(401);
    });

    it('trata la sesión como expirada aunque el documento todavía exista (TTL diferido)', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);
      // El TTL de MongoDB borra en segundo plano: la aplicación no puede depender de
      // que el documento haya desaparecido.
      await AuthSession.updateOne(
        { userId: user._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );

      const response = await post(app, '/api/v1/auth/refresh', refreshCookie);

      expect(response.status).toBe(401);
      expect(await AuthSession.countDocuments({ userId: user._id })).toBe(1);
    });

    it('rechaza cuando el usuario quedó inactivo', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);
      await User.updateOne({ _id: user._id }, { $set: { status: UserStatus.INACTIVE } });

      const response = await post(app, '/api/v1/auth/refresh', refreshCookie);

      expect(response.status).toBe(401);
    });

    it('rechaza cuando tokenVersion quedó desactualizado (logout global)', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);
      await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });

      const response = await post(app, '/api/v1/auth/refresh', refreshCookie);

      expect(response.status).toBe(401);
    });

    it('rechaza un token cuyo sid no es un ObjectId', async () => {
      const user = await makeUser({ env });
      const forged = jwt.sign({ sid: 'no-es-un-id', tv: 0 }, baseTestEnv.JWT_REFRESH_SECRET, {
        subject: user._id.toString(),
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
        expiresIn: 3600,
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${forged}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un token cuyo sub no coincide con el dueño de la sesión', async () => {
      const victima = await makeUser({ env, overrides: { email: 'victima@ejemplo.com' } });
      const atacante = await makeUser({ env, overrides: { email: 'atacante@ejemplo.com' } });
      const { refreshCookie } = await login(app, victima.email);
      const { sid } = jwt.decode(refreshCookie.value);

      // Token válido en firma, pero apuntando a la sesión de otra persona.
      const forged = jwt.sign({ sid, tv: 0 }, baseTestEnv.JWT_REFRESH_SECRET, {
        subject: atacante._id.toString(),
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
        expiresIn: 3600,
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${forged}`);

      expect(response.status).toBe(401);
    });

    it('un rechazo nunca revela el motivo interno', async () => {
      const response = await request(app).post('/api/v1/auth/refresh');

      const body = JSON.stringify(response.body);
      expect(body).not.toMatch(/SESSION_NOT_FOUND|TOKEN_INVALID|REUSE|TOKEN_VERSION/);
    });

    it('aplica su propio rate limit', async () => {
      const limited = createTestApp({ REFRESH_RATE_LIMIT_MAX: '3' });

      await request(limited.app).post('/api/v1/auth/refresh');
      await request(limited.app).post('/api/v1/auth/refresh');
      await request(limited.app).post('/api/v1/auth/refresh');
      const blocked = await request(limited.app).post('/api/v1/auth/refresh');

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
    });
  });
});
