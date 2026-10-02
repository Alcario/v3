import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp } from './helpers/createTestApp.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';
import {
  makeUser,
  login,
  extractRefreshCookie,
  activeSessions,
  VALID_PASSWORD,
} from './helpers/authFixtures.js';
import { User, UserStatus } from '../src/models/user.model.js';
import { AuthSession } from '../src/models/authSession.model.js';
import { ACCESS_AUDIENCE, ISSUER } from '../src/modules/auth/tokens.js';

describe('POST /api/v1/auth/login', () => {
  let app;
  let env;

  beforeAll(async () => {
    await startMemoryMongo();
    await User.syncIndexes();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), AuthSession.deleteMany({})]);
    ({ app, env } = createTestApp());
  });

  describe('credenciales correctas', () => {
    it('devuelve access token, expiresIn y el usuario público', async () => {
      const user = await makeUser({ env });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: VALID_PASSWORD });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeTypeOf('string');
      expect(response.body.data.expiresIn).toBe(900);
      expect(response.body.data.user).toEqual({
        id: user._id.toString(),
        email: user.email,
        firstName: 'Ana',
        lastName: 'Pérez',
        status: 'ACTIVE',
        isPlatformAdmin: false,
      });
    });

    it('el access token lleva solo sub y tv, sin datos personales', async () => {
      const user = await makeUser({ env });

      const { accessToken } = await login(app, user.email);
      const payload = jwt.decode(accessToken);

      expect(payload.sub).toBe(user._id.toString());
      expect(payload.tv).toBe(0);
      expect(payload.iss).toBe(ISSUER);
      expect(payload.aud).toBe(ACCESS_AUDIENCE);
      // Sin PII en un token que viaja en cada request.
      expect(payload.email).toBeUndefined();
      expect(payload.firstName).toBeUndefined();
      expect(payload.name).toBeUndefined();
      expect(payload.isPlatformAdmin).toBeUndefined();
      expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub', 'tv']);
    });

    it('el refresh token viaja solo en la cookie, nunca en el cuerpo', async () => {
      const user = await makeUser({ env });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: VALID_PASSWORD });

      expect(extractRefreshCookie(response)).not.toBeNull();
      const body = JSON.stringify(response.body);
      expect(body).not.toMatch(/refreshToken/);
      expect(body).not.toMatch(/chatio_rt/);
    });

    it('la cookie de refresh tiene httpOnly, sameSite=strict y path acotado', async () => {
      const user = await makeUser({ env });

      const { refreshCookie } = await login(app, user.email);

      expect(refreshCookie.attributes).toContain('httponly');
      expect(refreshCookie.attributes).toContain('samesite=strict');
      expect(refreshCookie.attributes).toContain('path=/api/v1/auth');
      expect(refreshCookie.attributes).toContain('max-age=604800');
      // En test no es `secure`: el navegador descartaría una cookie secure sobre http.
      expect(refreshCookie.attributes).not.toContain('secure');
    });

    it('marca la cookie como secure cuando el entorno es de producción', async () => {
      const prod = createTestApp({
        NODE_ENV: 'production',
        BCRYPT_COST: '12',
        CORS_ORIGINS: 'https://panel.chatio.app',
      });
      const user = await makeUser({ env: prod.env });

      const { refreshCookie } = await login(prod.app, user.email);

      expect(refreshCookie.attributes).toContain('secure');
    });

    it('crea exactamente una sesión activa y guarda solo el hash del token', async () => {
      const user = await makeUser({ env });

      const { refreshCookie } = await login(app, user.email);
      const sessions = await activeSessions(user._id);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(sessions[0].rotationCount).toBe(0);
      // El token no está en la base en ninguna forma recuperable.
      expect(sessions[0].tokenHash).not.toBe(refreshCookie.value);
      expect(JSON.stringify(sessions[0].toObject())).not.toContain(refreshCookie.value);
    });

    it('registra lastLoginAt', async () => {
      const user = await makeUser({ env });

      await login(app, user.email);

      const updated = await User.findById(user._id);
      expect(updated.lastLoginAt).toBeInstanceOf(Date);
    });

    it('dos logins crean dos sesiones independientes', async () => {
      const user = await makeUser({ env });

      await login(app, user.email);
      await login(app, user.email);

      expect(await activeSessions(user._id)).toHaveLength(2);
    });

    it('acepta el email con otra capitalización y con espacios', async () => {
      const user = await makeUser({ env, overrides: { email: 'ana@ejemplo.com' } });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: '  ANA@Ejemplo.COM  ', password: VALID_PASSWORD });

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe(user._id.toString());
    });
  });

  describe('credenciales incorrectas', () => {
    it('devuelve exactamente la misma respuesta para email inexistente y contraseña incorrecta', async () => {
      const user = await makeUser({ env });

      const unknownEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nadie@ejemplo.com', password: VALID_PASSWORD });
      const badPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'contraseña-equivocada' });

      expect(unknownEmail.status).toBe(401);
      expect(badPassword.status).toBe(401);
      expect(unknownEmail.body.error.code).toBe('INVALID_CREDENTIALS');
      // Mismo código y mismo mensaje: no se puede enumerar cuentas.
      expect(unknownEmail.body.error.message).toBe(badPassword.body.error.message);
      expect(unknownEmail.body.error.code).toBe(badPassword.body.error.code);
    });

    it('un usuario inactivo recibe la misma respuesta que unas credenciales inválidas', async () => {
      const user = await makeUser({ env });
      await User.updateOne({ _id: user._id }, { $set: { status: UserStatus.INACTIVE } });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: VALID_PASSWORD });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(await activeSessions(user._id)).toHaveLength(0);
    });

    it('no crea sesión cuando la contraseña es incorrecta', async () => {
      const user = await makeUser({ env });

      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'no-es-la-correcta' });

      expect(await activeSessions(user._id)).toHaveLength(0);
    });

    it('no filtra la contraseña ni el hash en la respuesta', async () => {
      const user = await makeUser({ env });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'no-es-la-correcta' });

      expect(response.text).not.toContain('no-es-la-correcta');
      expect(response.text).not.toMatch(/\$2[aby]\$/);
      expect(response.text).not.toMatch(/passwordHash/);
    });
  });

  describe('validación del payload', () => {
    it('rechaza un email con formato inválido', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'no-es-un-email', password: VALID_PASSWORD });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].path).toBe('body.email');
    });

    it('rechaza un body sin contraseña', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ana@ejemplo.com' });

      expect(response.status).toBe(400);
      expect(response.body.error.details.some((d) => d.path === 'body.password')).toBe(true);
    });

    it('rechaza propiedades desconocidas en el body', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ana@ejemplo.com', password: VALID_PASSWORD, isPlatformAdmin: true });

      expect(response.status).toBe(400);
      expect(response.body.error.details.some((d) => d.path.includes('isPlatformAdmin'))).toBe(
        true,
      );
    });

    it('no aplica la política de contraseñas en el login', async () => {
      // Una contraseña que no cumple la política tiene que poder intentarse: el login
      // no es el lugar para validar formato, y hacerlo filtraría información.
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ana@ejemplo.com', password: 'x' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('rate limiting', () => {
    it('corta al sexto intento y devuelve Retry-After', async () => {
      const limited = createTestApp({ LOGIN_RATE_LIMIT_MAX: '5' });
      const user = await makeUser({ env: limited.env });

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(limited.app)
          .post('/api/v1/auth/login')
          .send({ email: user.email, password: 'incorrecta' });
      }
      const blocked = await request(limited.app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: VALID_PASSWORD });

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
      expect(blocked.headers['retry-after']).toBeTypeOf('string');
    });

    it('la cuota es por IP + email: otra cuenta no queda bloqueada', async () => {
      const limited = createTestApp({ LOGIN_RATE_LIMIT_MAX: '3' });
      const victima = await makeUser({
        env: limited.env,
        overrides: { email: 'victima@ejemplo.com' },
      });
      const otra = await makeUser({ env: limited.env, overrides: { email: 'otra@ejemplo.com' } });

      for (let attempt = 0; attempt < 4; attempt += 1) {
        await request(limited.app)
          .post('/api/v1/auth/login')
          .send({ email: victima.email, password: 'incorrecta' });
      }
      const otherAccount = await request(limited.app)
        .post('/api/v1/auth/login')
        .send({ email: otra.email, password: VALID_PASSWORD });

      // Agotar la cuota de una cuenta no puede servir para bloquear a otra.
      expect(otherAccount.status).toBe(200);
    });
  });

  describe('eventos de seguridad', () => {
    it('registra el login exitoso con el id del usuario y sin el email', async () => {
      const { app: testApp, env: testEnv, logs } = createTestApp();
      const user = await makeUser({ env: testEnv, overrides: { email: 'auditada@ejemplo.com' } });

      await login(testApp, user.email);

      const event = logs.records.find((r) => r.event === 'AUTH_LOGIN_SUCCESS');
      expect(event).toBeDefined();
      expect(event.userId).toBe(user._id.toString());
      expect(logs.raw).not.toContain('auditada@ejemplo.com');
    });

    it('registra el fallo con el motivo interno, sin exponerlo al cliente', async () => {
      const { app: testApp, env: testEnv, logs } = createTestApp();
      const user = await makeUser({ env: testEnv });

      await request(testApp)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'incorrecta' });

      const event = logs.records.find((r) => r.event === 'AUTH_LOGIN_FAILURE');
      expect(event.reason).toBe('BAD_PASSWORD');
      expect(event.ip).toBeTypeOf('string');
    });

    it('nunca loguea la contraseña ni el token emitido', async () => {
      const { app: testApp, env: testEnv, logs } = createTestApp();
      const user = await makeUser({ env: testEnv });

      const { accessToken } = await login(testApp, user.email);

      expect(logs.raw).not.toContain(VALID_PASSWORD);
      expect(logs.raw).not.toContain(accessToken);
    });
  });
});
