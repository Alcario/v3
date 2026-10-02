import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/createTestApp.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';
import { makeUser, login } from './helpers/authFixtures.js';
import { User } from '../src/models/user.model.js';
import { AuthSession } from '../src/models/authSession.model.js';
import { Adult } from '../src/models/adult.model.js';
import { CaregiverAccess } from '../src/models/caregiverAccess.model.js';
import { ActivityEvent } from '../src/models/activityEvent.model.js';
import { createAdultRouter } from '../src/modules/adults/adult.routes.js';

const adultInput = {
  firstName: 'Rosa',
  lastName: 'Gómez',
  birthDate: '1944-03-12',
  timezone: 'America/Argentina/Buenos_Aires',
  notes: 'Hablar despacio.',
  contacts: [{ name: 'Ana Pérez', relationship: 'Hija', phone: '+5491122223333', isPrimary: true }],
  consentConfirmed: true,
};

async function createAdult(app, accessToken, input = adultInput) {
  return request(app)
    .post('/api/v1/adults')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(input);
}

describe('Iteración 3 — adultos y cuidadores', () => {
  let app;
  let env;

  beforeAll(async () => {
    await startMemoryMongo();
    await Promise.all([
      User.syncIndexes(),
      Adult.syncIndexes(),
      CaregiverAccess.syncIndexes(),
      ActivityEvent.syncIndexes(),
    ]);
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await Promise.all([
      CaregiverAccess.deleteMany({}),
      Adult.deleteMany({}),
      ActivityEvent.deleteMany({}),
      AuthSession.deleteMany({}),
      User.deleteMany({}),
    ]);
    ({ app, env } = createTestApp());
  });

  async function authenticatedUser(overrides = {}) {
    const user = await makeUser({ env, overrides });
    const session = await login(app, user.email);
    return { user, accessToken: session.accessToken };
  }

  it('crea Adult y OWNER en una operación consistente', async () => {
    const owner = await authenticatedUser();
    const response = await createAdult(app, owner.accessToken);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      firstName: 'Rosa',
      lastName: 'Gómez',
      birthDate: '1944-03-12',
      timezone: 'America/Argentina/Buenos_Aires',
      status: 'ACTIVE',
    });
    const adult = await Adult.findOne({ firstName: 'Rosa' });
    const access = await CaregiverAccess.findOne({ adultId: adult._id });
    expect(adult).toMatchObject({
      consentRecordedByUserId: owner.user._id,
      consentStatementVersion: 'v1',
    });
    expect(adult.consentRecordedAt).toBeInstanceOf(Date);
    expect(access).toMatchObject({
      userId: owner.user._id,
      role: 'OWNER',
      status: 'ACTIVE',
      grantedByUserId: owner.user._id,
    });
  });

  it('rechaza una timezone inválida y propiedades no permitidas', async () => {
    const owner = await authenticatedUser();

    const invalidTimezone = await createAdult(app, owner.accessToken, {
      ...adultInput,
      timezone: 'UTC-03:00',
    });
    expect(invalidTimezone.status).toBe(400);
    expect(invalidTimezone.body.error.code).toBe('VALIDATION_ERROR');

    const massAssignment = await createAdult(app, owner.accessToken, {
      ...adultInput,
      status: 'INACTIVE',
      createdByUserId: owner.user._id.toString(),
    });
    expect(massAssignment.status).toBe(400);
    expect(massAssignment.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'body.status' }),
        expect.objectContaining({ path: 'body.createdByUserId' }),
      ]),
    );
  });

  it('exige confirmación explícita de consentimiento informado', async () => {
    const owner = await authenticatedUser();
    const response = await createAdult(app, owner.accessToken, {
      ...adultInput,
      consentConfirmed: false,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'body.consentConfirmed' })]),
    );
  });

  it('limita el listado a adultos con acceso activo', async () => {
    const owner = await authenticatedUser();
    const other = await authenticatedUser({ email: 'otro@ejemplo.com' });
    const ownAdult = await createAdult(app, owner.accessToken);
    const otherAdult = await createAdult(app, other.accessToken, {
      ...adultInput,
      firstName: 'José',
    });

    const response = await request(app)
      .get('/api/v1/adults')
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ total: 1 });
    expect(response.body.data.map((adult) => adult.id)).toEqual([ownAdult.body.data.id]);
    expect(response.body.data.map((adult) => adult.id)).not.toContain(otherAdult.body.data.id);
  });

  it('protege detalle, actualización y desactivación frente a IDOR/BOLA', async () => {
    const owner = await authenticatedUser();
    const outsider = await authenticatedUser({ email: 'ajeno@ejemplo.com' });
    const created = await createAdult(app, owner.accessToken);
    const adultId = created.body.data.id;

    const ownDetail = await request(app)
      .get(`/api/v1/adults/${adultId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(ownDetail.status).toBe(200);

    const foreignDetail = await request(app)
      .get(`/api/v1/adults/${adultId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(foreignDetail.status).toBe(404);

    const foreignUpdate = await request(app)
      .patch(`/api/v1/adults/${adultId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ firstName: 'No autorizado' });
    expect(foreignUpdate.status).toBe(404);

    const foreignDeactivate = await request(app)
      .post(`/api/v1/adults/${adultId}/deactivate`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(foreignDeactivate.status).toBe(404);

    const invalidId = await request(app)
      .get('/api/v1/adults/not-an-object-id')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(invalidId.status).toBe(400);
  });

  it('solo OWNER puede modificar y desactivar; activar conserva el historial', async () => {
    const owner = await authenticatedUser();
    const caregiver = await authenticatedUser({ email: 'cuidador@ejemplo.com' });
    const created = await createAdult(app, owner.accessToken);
    const adultId = created.body.data.id;

    const granted = await request(app)
      .post(`/api/v1/adults/${adultId}/caregivers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: caregiver.user.email, role: 'CAREGIVER' });
    expect(granted.status).toBe(201);

    const caregiverUpdate = await request(app)
      .patch(`/api/v1/adults/${adultId}`)
      .set('Authorization', `Bearer ${caregiver.accessToken}`)
      .send({ notes: 'No puede editar' });
    expect(caregiverUpdate.status).toBe(403);

    const deactivated = await request(app)
      .post(`/api/v1/adults/${adultId}/deactivate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.status).toBe('INACTIVE');

    const reactivated = await request(app)
      .post(`/api/v1/adults/${adultId}/activate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.status).toBe('ACTIVE');

    const events = await ActivityEvent.find({ adultId, type: 'ADULT_UPDATED' }).sort({
      occurredAt: 1,
    });
    expect(events).toHaveLength(2);
  });

  it('administra cuidadores, registra roles y rechaza duplicados', async () => {
    const owner = await authenticatedUser();
    const caregiver = await authenticatedUser({ email: 'cuidador@ejemplo.com' });
    const created = await createAdult(app, owner.accessToken);
    const adultId = created.body.data.id;

    const granted = await request(app)
      .post(`/api/v1/adults/${adultId}/caregivers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: caregiver.user.email, role: 'CAREGIVER' });
    expect(granted.status).toBe(201);
    expect(granted.body.data.user.email).toBe(caregiver.user.email);

    const duplicate = await request(app)
      .post(`/api/v1/adults/${adultId}/caregivers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: caregiver.user.email, role: 'CAREGIVER' });
    expect(duplicate.status).toBe(409);

    const list = await request(app)
      .get(`/api/v1/adults/${adultId}/caregivers`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(2);

    const roleChanged = await request(app)
      .patch(`/api/v1/adults/${adultId}/caregivers/${granted.body.data.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'OWNER' });
    expect(roleChanged.status).toBe(200);
    expect(roleChanged.body.data.role).toBe('OWNER');

    const events = await ActivityEvent.find({ adultId }).sort({ occurredAt: 1 });
    expect(events.map((event) => event.type)).toEqual([
      'CAREGIVER_GRANTED',
      'CAREGIVER_ROLE_CHANGED',
    ]);
  });

  it('protege el último OWNER al revocar o degradar', async () => {
    const owner = await authenticatedUser();
    const created = await createAdult(app, owner.accessToken);
    const adultId = created.body.data.id;
    const ownerAccess = await CaregiverAccess.findOne({ adultId, role: 'OWNER' });

    const degrade = await request(app)
      .patch(`/api/v1/adults/${adultId}/caregivers/${ownerAccess._id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'CAREGIVER' });
    expect(degrade.status).toBe(422);

    const revoke = await request(app)
      .delete(`/api/v1/adults/${adultId}/caregivers/${ownerAccess._id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(revoke.status).toBe(422);
  });

  it('serializa cambios concurrentes para no dejar cero OWNER', async () => {
    const owner = await authenticatedUser();
    const secondOwner = await authenticatedUser({ email: 'segundo@ejemplo.com' });
    const created = await createAdult(app, owner.accessToken);
    const adultId = created.body.data.id;
    const granted = await request(app)
      .post(`/api/v1/adults/${adultId}/caregivers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: secondOwner.user.email, role: 'OWNER' });
    const firstAccess = await CaregiverAccess.findOne({
      adultId,
      userId: owner.user._id,
    });

    const results = await Promise.all([
      request(app)
        .patch(`/api/v1/adults/${adultId}/caregivers/${firstAccess._id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ role: 'CAREGIVER' }),
      request(app)
        .patch(`/api/v1/adults/${adultId}/caregivers/${granted.body.data.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ role: 'CAREGIVER' }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 422]);
    expect(await CaregiverAccess.countDocuments({ adultId, role: 'OWNER', status: 'ACTIVE' })).toBe(
      1,
    );
  });

  it('revoca el acceso inmediatamente aunque el JWT siga vigente', async () => {
    const owner = await authenticatedUser();
    const caregiver = await authenticatedUser({ email: 'cuidador@ejemplo.com' });
    const created = await createAdult(app, owner.accessToken);
    const adultId = created.body.data.id;
    const granted = await request(app)
      .post(`/api/v1/adults/${adultId}/caregivers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: caregiver.user.email, role: 'CAREGIVER' });

    const before = await request(app)
      .get(`/api/v1/adults/${adultId}`)
      .set('Authorization', `Bearer ${caregiver.accessToken}`);
    expect(before.status).toBe(200);

    const revoked = await request(app)
      .delete(`/api/v1/adults/${adultId}/caregivers/${granted.body.data.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(revoked.status).toBe(200);

    const after = await request(app)
      .get(`/api/v1/adults/${adultId}`)
      .set('Authorization', `Bearer ${caregiver.accessToken}`);
    expect(after.status).toBe(404);
  });

  it('incluye los adultos accesibles y sus roles en /auth/me', async () => {
    const owner = await authenticatedUser();
    const created = await createAdult(app, owner.accessToken);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.adults).toEqual([
      expect.objectContaining({ id: created.body.data.id, role: 'OWNER' }),
    ]);
  });

  it('exige autenticación en la creación y en los recursos protegidos', async () => {
    const unauthenticatedCreate = await request(app).post('/api/v1/adults').send(adultInput);
    expect(unauthenticatedCreate.status).toBe(401);

    const unauthenticatedList = await request(app).get('/api/v1/adults');
    expect(unauthenticatedList.status).toBe(401);
  });

  it('mantiene requireAdultAccess en cada ruta anidada del router', () => {
    const { router } = createAdultRouter({ env });
    const nestedRoutes = router.stack.filter((layer) => layer.route?.path?.startsWith('/:adultId'));
    expect(nestedRoutes.length).toBeGreaterThan(0);
    for (const layer of nestedRoutes) {
      expect(layer.route.stack.map((entry) => entry.name)).toContain('requireAdultAccess');
    }
  });
});
