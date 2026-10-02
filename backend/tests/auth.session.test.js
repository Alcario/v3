import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createTestApp, baseTestEnv } from './helpers/createTestApp.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';
import {
  makeUser,
  login,
  cookieHeader,
  extractRefreshCookie,
  activeSessions,
} from './helpers/authFixtures.js';
import { User, UserStatus } from '../src/models/user.model.js';
import { AuthSession, SessionStatus, RevocationReason } from '../src/models/authSession.model.js';
import { REFRESH_COOKIE_NAME } from '../src/lib/cookies.js';
import { ACCESS_AUDIENCE, ISSUER } from '../src/modules/auth/tokens.js';
import { createAuthService } from '../src/modules/auth/auth.service.js';

const signAccess = (payload, options = {}) =>
  jwt.sign(payload, baseTestEnv.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
    expiresIn: 900,
    ...options,
  });

describe('POST /api/v1/auth/logout', () => {
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

  it('revoca la sesión y borra la cookie', async () => {
    const user = await makeUser({ env });
    const { refreshCookie } = await login(app, user.email);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader(refreshCookie));

    expect(response.status).toBe(204);
    expect(extractRefreshCookie(response).value).toBe('');
    expect(await activeSessions(user._id)).toHaveLength(0);

    const session = await AuthSession.findOne({ userId: user._id });
    expect(session.status).toBe(SessionStatus.REVOKED);
    expect(session.revokedReason).toBe(RevocationReason.LOGOUT);
  });

  it('después del logout el refresh ya no sirve', async () => {
    const user = await makeUser({ env });
    const { refreshCookie } = await login(app, user.email);
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookieHeader(refreshCookie));

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(refreshCookie));

    expect(refresh.status).toBe(401);
  });

  it('es idempotente: cerrar sesión dos veces devuelve 204 igual', async () => {
    const user = await makeUser({ env });
    const { refreshCookie } = await login(app, user.email);

    const first = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader(refreshCookie));
    const second = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader(refreshCookie));

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(1);
  });

  it('sin cookie devuelve 204 y borra la cookie de todos modos', async () => {
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(204);
    expect(extractRefreshCookie(response)).not.toBeNull();
  });

  it('con una cookie basura devuelve 204 sin romperse', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=no-es-un-jwt`);

    expect(response.status).toBe(204);
  });

  it('cerrar sesión en un dispositivo no cierra la del otro', async () => {
    const user = await makeUser({ env });
    const device1 = (await login(app, user.email)).refreshCookie;
    const device2 = (await login(app, user.email)).refreshCookie;

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookieHeader(device1));

    const stillWorks = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(device2));
    expect(stillWorks.status).toBe(200);
    expect(await activeSessions(user._id)).toHaveLength(1);
  });

  it('registra AUTH_LOGOUT', async () => {
    const { app: testApp, env: testEnv, logs } = createTestApp();
    const user = await makeUser({ env: testEnv });
    const { refreshCookie } = await login(testApp, user.email);

    await request(testApp).post('/api/v1/auth/logout').set('Cookie', cookieHeader(refreshCookie));

    expect(logs.records.some((r) => r.event === 'AUTH_LOGOUT')).toBe(true);
  });
});

describe('GET /api/v1/auth/me y requireAuth', () => {
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

  describe('autenticado', () => {
    it('devuelve el usuario y la lista de adultos (vacía hasta la Iteración 3)', async () => {
      const user = await makeUser({ env });
      const { accessToken } = await login(app, user.email);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe(user._id.toString());
      expect(response.body.data.adults).toEqual([]);
    });

    it('no devuelve passwordHash, tokens ni campos internos', async () => {
      const user = await makeUser({ env });
      const { accessToken } = await login(app, user.email);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      const body = JSON.stringify(response.body);
      expect(body).not.toMatch(/passwordHash/);
      expect(body).not.toMatch(/\$2[aby]\$/);
      expect(body).not.toMatch(/tokenVersion/);
      expect(body).not.toMatch(/refreshToken|chatio_rt/);
      expect(body).not.toMatch(/__v|_id/);
      expect(Object.keys(response.body.data.user).sort()).toEqual([
        'email',
        'firstName',
        'id',
        'isPlatformAdmin',
        'lastName',
        'status',
      ]);
    });

    it('la identidad sale del token y no de ningún parámetro del pedido', async () => {
      const userA = await makeUser({ env, overrides: { email: 'a@ejemplo.com' } });
      const userB = await makeUser({ env, overrides: { email: 'b@ejemplo.com' } });
      const { accessToken } = await login(app, userA.email);

      // Se intenta pedir la identidad de otro por query y por body: no hay forma.
      const response = await request(app)
        .get(`/api/v1/auth/me?userId=${userB._id}&id=${userB._id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe(userA._id.toString());
      expect(response.body.data.user.email).toBe('a@ejemplo.com');
    });
  });

  describe('rechazos', () => {
    it('sin Authorization devuelve 401', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rechaza un esquema que no sea Bearer', async () => {
      const user = await makeUser({ env });
      const { accessToken } = await login(app, user.email);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Basic ${accessToken}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un token expirado', async () => {
      const user = await makeUser({ env });
      const expired = signAccess({ tv: 0 }, { subject: user._id.toString(), expiresIn: '-1s' });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expired}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un token firmado con otro secreto', async () => {
      const user = await makeUser({ env });
      const forged = jwt.sign({ tv: 0 }, 'secreto-del-atacante-que-mide-mas-de-32-chars', {
        subject: user._id.toString(),
        issuer: ISSUER,
        audience: ACCESS_AUDIENCE,
        expiresIn: 900,
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forged}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un token con alg none', async () => {
      const user = await makeUser({ env });
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: user._id.toString(),
          tv: 0,
          iss: ISSUER,
          aud: ACCESS_AUDIENCE,
          exp: Math.floor(Date.now() / 1000) + 900,
        }),
      ).toString('base64url');

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${header}.${payload}.`);

      expect(response.status).toBe(401);
    });

    it('rechaza un refresh token usado como access token', async () => {
      const user = await makeUser({ env });
      const { refreshCookie } = await login(app, user.email);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${refreshCookie.value}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un token sin el claim tv', async () => {
      const user = await makeUser({ env });
      const withoutTv = signAccess({}, { subject: user._id.toString() });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${withoutTv}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un token con tv desactualizado (logout global inmediato, D029)', async () => {
      const user = await makeUser({ env });
      const { accessToken } = await login(app, user.email);
      await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
    });

    it('rechaza el token de un usuario desactivado, sin esperar a que expire (D029)', async () => {
      const user = await makeUser({ env });
      const { accessToken } = await login(app, user.email);

      const before = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      await User.updateOne({ _id: user._id }, { $set: { status: UserStatus.INACTIVE } });
      const after = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(before.status).toBe(200);
      expect(after.status).toBe(401);
    });

    it('rechaza el token de un usuario borrado', async () => {
      const user = await makeUser({ env });
      const { accessToken } = await login(app, user.email);
      await User.deleteOne({ _id: user._id });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
    });

    it('rechaza un sub que no es un ObjectId', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${signAccess({ tv: 0 }, { subject: 'no-es-un-id' })}`);

      expect(response.status).toBe(401);
    });

    it('registra el rechazo con el motivo, sin exponerlo', async () => {
      const { app: testApp, logs } = createTestApp();

      const response = await request(testApp).get('/api/v1/auth/me');

      const event = logs.records.find((r) => r.event === 'AUTH_ACCESS_DENIED');
      expect(event.reason).toBe('NO_TOKEN');
      expect(JSON.stringify(response.body)).not.toMatch(/NO_TOKEN/);
    });
  });

  describe('revokeAllSessions', () => {
    it('revoca todas las sesiones y sube tokenVersion', async () => {
      const user = await makeUser({ env });
      const authService = createAuthService({ env });
      const first = await login(app, user.email);
      await login(app, user.email);

      const result = await authService.revokeAllSessions({ userId: user._id });

      expect(result.revokedCount).toBe(2);
      expect(await activeSessions(user._id)).toHaveLength(0);
      expect((await User.findById(user._id)).tokenVersion).toBe(1);

      // Y el access token emitido antes deja de servir de inmediato.
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${first.accessToken}`);
      expect(response.status).toBe(401);
    });
  });
});

describe('POST /api/v1/admin/users', () => {
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

  async function adminToken() {
    const admin = await makeUser({
      env,
      overrides: { email: 'admin@ejemplo.com', isPlatformAdmin: true },
    });
    const { accessToken } = await login(app, admin.email);
    return { admin, accessToken };
  }

  it('un administrador de plataforma crea un usuario', async () => {
    const { accessToken } = await adminToken();

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'nueva@ejemplo.com',
        password: 'una-clave-larga-y-propia',
        firstName: 'Nueva',
        lastName: 'Cuidadora',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('nueva@ejemplo.com');
    expect(response.body.data.isPlatformAdmin).toBe(false);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('el usuario creado puede iniciar sesión', async () => {
    const { accessToken } = await adminToken();
    await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'nueva@ejemplo.com',
        password: 'una-clave-larga-y-propia',
        firstName: 'Nueva',
        lastName: 'Cuidadora',
      });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nueva@ejemplo.com', password: 'una-clave-larga-y-propia' });

    expect(response.status).toBe(200);
  });

  it('sin token devuelve 401', async () => {
    const response = await request(app).post('/api/v1/admin/users').send({
      email: 'nueva@ejemplo.com',
      password: 'una-clave-larga-y-propia',
      firstName: 'Nueva',
      lastName: 'Cuidadora',
    });

    expect(response.status).toBe(401);
  });

  it('un usuario común no puede crear usuarios (403)', async () => {
    const user = await makeUser({ env });
    const { accessToken } = await login(app, user.email);

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'nueva@ejemplo.com',
        password: 'una-clave-larga-y-propia',
        firstName: 'Nueva',
        lastName: 'Cuidadora',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(await User.countDocuments({ email: 'nueva@ejemplo.com' })).toBe(0);
  });

  it('rechaza una contraseña que no cumple la política', async () => {
    const { accessToken } = await adminToken();

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'nueva@ejemplo.com',
        password: 'password123',
        firstName: 'Nueva',
        lastName: 'Cuidadora',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.details.some((d) => d.path === 'body.password')).toBe(true);
  });

  it('rechaza un email duplicado con 409', async () => {
    const { accessToken } = await adminToken();

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'admin@ejemplo.com',
        password: 'una-clave-larga-y-propia',
        firstName: 'Otra',
        lastName: 'Persona',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('un usuario común no puede promoverse a administrador por el body', async () => {
    const user = await makeUser({ env });
    const { accessToken } = await login(app, user.email);

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'nueva@ejemplo.com',
        password: 'una-clave-larga-y-propia',
        firstName: 'Nueva',
        lastName: 'Cuidadora',
        isPlatformAdmin: true,
      });

    // La autorización corta antes de mirar el body.
    expect(response.status).toBe(403);
  });

  it('no existe ningún endpoint público de bootstrap de administradores', async () => {
    for (const path of ['/api/v1/auth/register', '/api/v1/register', '/api/v1/register-admin']) {
      const response = await request(app).post(path).send({});
      expect(response.status).toBe(404);
    }
  });

  it('valida que el id del creador salga del token y no del body', async () => {
    const { admin, accessToken } = await adminToken();
    const otro = new mongoose.Types.ObjectId();

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'nueva@ejemplo.com',
        password: 'una-clave-larga-y-propia',
        firstName: 'Nueva',
        lastName: 'Cuidadora',
        createdBy: otro.toString(),
      });

    // `createdBy` es una propiedad desconocida: el esquema estricto la rechaza.
    expect(response.status).toBe(400);
    expect(admin.isPlatformAdmin).toBe(true);
  });
});
