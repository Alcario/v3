/**
 * Ciclo de vida completo de una sesión, de punta a punta.
 *
 * Este archivo existe porque "el login funciona" no alcanza para cerrar la Iteración 2:
 * lo que hay que demostrar es la secuencia entera, incluida la expiración real del access
 * token y el rechazo de un refresh token replayado.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/createTestApp.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';
import {
  makeUser,
  login,
  cookieHeader,
  extractRefreshCookie,
  activeSessions,
  VALID_PASSWORD,
} from './helpers/authFixtures.js';
import { User } from '../src/models/user.model.js';
import { AuthSession, SessionStatus, RevocationReason } from '../src/models/authSession.model.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ciclo completo de autenticación', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await Promise.all([User.syncIndexes(), AuthSession.syncIndexes()]);
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), AuthSession.deleteMany({})]);
  });

  it('login → API autenticada → access expira → refresh → rotación → nuevo access → logout → refresh inválido', async () => {
    // TTL de 1 segundo para poder observar la expiración de verdad, sin simular relojes.
    const { app, env } = createTestApp({ ACCESS_TOKEN_TTL_SECONDS: '1' });
    const user = await makeUser({ env });

    // ─── 1. LOGIN ───────────────────────────────────────────────────────────────
    const first = await login(app, user.email);
    expect(first.response.status).toBe(200);
    expect(first.accessToken).toBeTypeOf('string');
    expect(first.refreshCookie).not.toBeNull();
    expect(await activeSessions(user._id)).toHaveLength(1);

    // ─── 2. API AUTENTICADA con el access token ─────────────────────────────────
    const authenticated = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${first.accessToken}`);
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.data.user.id).toBe(user._id.toString());

    // ─── 3. EL ACCESS TOKEN EXPIRA ──────────────────────────────────────────────
    await sleep(1100);
    const expired = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${first.accessToken}`);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('UNAUTHENTICATED');

    // ─── 4. REFRESH con la cookie: rota y devuelve un access nuevo ──────────────
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(first.refreshCookie));
    expect(refreshed.status).toBe(200);

    const secondAccess = refreshed.body.data.accessToken;
    const secondRefresh = extractRefreshCookie(refreshed);
    expect(secondAccess).not.toBe(first.accessToken);
    expect(secondRefresh.value).not.toBe(first.refreshCookie.value);

    // ─── 5. LA ROTACIÓN CONSERVA LA MISMA SESIÓN ────────────────────────────────
    const sessions = await activeSessions(user._id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].rotationCount).toBe(1);

    // ─── 6. EL NUEVO ACCESS TOKEN FUNCIONA ──────────────────────────────────────
    const withNewAccess = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondAccess}`);
    expect(withNewAccess.status).toBe(200);

    // ─── 7. LOGOUT ──────────────────────────────────────────────────────────────
    const loggedOut = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader(secondRefresh));
    expect(loggedOut.status).toBe(204);
    expect(extractRefreshCookie(loggedOut).value).toBe('');

    // ─── 8. EL REFRESH YA NO ES VÁLIDO ──────────────────────────────────────────
    const afterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(secondRefresh));
    expect(afterLogout.status).toBe(401);
    expect(await activeSessions(user._id)).toHaveLength(0);

    // Y el access token que quedaba vivo también deja de servir al expirar; mientras
    // no expire sigue valiendo, que es el trade-off explícito de un token stateless
    // de 15 minutos (D001). La sesión, en cambio, ya está revocada.
    const session = await AuthSession.findOne({ userId: user._id });
    expect(session.status).toBe(SessionStatus.REVOKED);
    expect(session.revokedReason).toBe(RevocationReason.LOGOUT);
  });

  it('R1 → refresh → R2; reutilizar R1 es rechazado y la sesión queda revocada', async () => {
    const { app, env } = createTestApp();
    const user = await makeUser({ env });

    // R1
    const { refreshCookie: r1 } = await login(app, user.email);

    // R1 → R2
    const rotation = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(r1));
    expect(rotation.status).toBe(200);
    const r2 = extractRefreshCookie(rotation);

    // Se intenta reutilizar R1
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieHeader(r1));

    // RECHAZADO
    expect(reuse.status).toBe(401);

    // Y la sesión entera queda revocada: R2 tampoco sirve más.
    const withR2 = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieHeader(r2));
    expect(withR2.status).toBe(401);

    const session = await AuthSession.findOne({ userId: user._id });
    expect(session.status).toBe(SessionStatus.REVOKED);
    expect(session.revokedReason).toBe(RevocationReason.REUSE_DETECTED);

    // Para volver a entrar hace falta autenticarse de nuevo.
    const relogin = await login(app, user.email, VALID_PASSWORD);
    expect(relogin.response.status).toBe(200);
    expect(await activeSessions(user._id)).toHaveLength(1);
  });

  it('el ciclo no filtra nada sensible en ninguna respuesta ni en los logs', async () => {
    const { app, env, logs } = createTestApp();
    const user = await makeUser({ env });

    const first = await login(app, user.email);
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${first.accessToken}`);
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(first.refreshCookie));
    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader(extractRefreshCookie(refreshed)));

    const bodies = [first.response.text, me.text, refreshed.text, out.text].join('');

    expect(bodies).not.toContain(VALID_PASSWORD);
    expect(bodies).not.toMatch(/passwordHash/);
    expect(bodies).not.toMatch(/\$2[aby]\$/);
    expect(bodies).not.toMatch(/tokenHash/);
    expect(bodies).not.toContain(first.refreshCookie.value);

    // En los logs tampoco: ni contraseña, ni tokens, ni el email del usuario.
    expect(logs.raw).not.toContain(VALID_PASSWORD);
    expect(logs.raw).not.toContain(first.accessToken);
    expect(logs.raw).not.toContain(first.refreshCookie.value);
    expect(logs.raw).not.toContain(user.email);
  });
});
