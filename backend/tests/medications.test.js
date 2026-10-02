import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/createTestApp.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';
import { makeUser, login } from './helpers/authFixtures.js';
import { User } from '../src/models/user.model.js';
import { AuthSession } from '../src/models/authSession.model.js';
import { Adult } from '../src/models/adult.model.js';
import { CaregiverAccess } from '../src/models/caregiverAccess.model.js';
import { ActivityEvent } from '../src/models/activityEvent.model.js';
import { Medication } from '../src/models/medication.model.js';
import { MedicationOccurrence } from '../src/models/medicationOccurrence.model.js';
import { createMedicationRouter } from '../src/modules/medications/medication.routes.js';

const adultInput = {
  firstName: 'Rosa',
  lastName: 'Gomez',
  birthDate: '1944-03-12',
  timezone: 'America/Argentina/Buenos_Aires',
  notes: 'Hablar despacio.',
  contacts: [],
  consentConfirmed: true,
};

const medicationInput = {
  name: 'Losartan',
  dose: 50,
  doseUnit: 'MG',
  quantity: 1,
  quantityUnit: 'COMPRIMIDO',
  instructions: 'Despues del desayuno',
  schedule: {
    times: ['09:00', '21:00'],
    daysOfWeek: [6, 0, 2, 1, 3, 4, 5],
    startDate: '2026-09-29',
    endDate: null,
  },
  graceMinutes: 180,
};

describe('Iteracion 4 - medicamentos y horarios', () => {
  let app;
  let env;

  beforeAll(async () => {
    await startMemoryMongo();
    await Promise.all([
      User.syncIndexes(),
      AuthSession.syncIndexes(),
      Adult.syncIndexes(),
      CaregiverAccess.syncIndexes(),
      ActivityEvent.syncIndexes(),
      Medication.syncIndexes(),
      MedicationOccurrence.syncIndexes(),
    ]);
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await Promise.all([
      Medication.deleteMany({}),
      MedicationOccurrence.deleteMany({}),
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

  async function createAdult(accessToken, input = adultInput) {
    const response = await request(app)
      .post('/api/v1/adults')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(input);
    expect(response.status).toBe(201);
    return response.body.data;
  }

  async function createMedication(accessToken, adultId, input = medicationInput) {
    return request(app)
      .post(`/api/v1/adults/${adultId}/medications`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(input);
  }

  async function grantCaregiver(ownerToken, adultId, caregiverEmail, role = 'CAREGIVER') {
    return request(app)
      .post(`/api/v1/adults/${adultId}/caregivers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: caregiverEmail, role });
  }

  it('crea el medicamento, ordena el horario y devuelve la proxima ocurrencia', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const response = await createMedication(owner.accessToken, adult.id);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      adultId: adult.id,
      name: 'Losartan',
      dose: 50,
      doseUnit: 'MG',
      quantity: 1,
      quantityUnit: 'COMPRIMIDO',
      nextOccurrenceLocal: expect.objectContaining({
        timezone: adult.timezone,
      }),
    });
    expect(response.body.data.schedule).toMatchObject({
      times: ['09:00', '21:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(response.body.data.nextOccurrenceAt).toEqual(expect.any(String));
    expect(response.body.data).not.toHaveProperty('timezone');
    expect(await Medication.countDocuments()).toBe(1);
  });

  it('valida horarios, fechas, unidades, numeros y mass assignment', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const invalidInputs = [
      { name: 'X' },
      { schedule: { ...medicationInput.schedule, times: ['25:00'] } },
      { schedule: { ...medicationInput.schedule, times: ['9:00'] } },
      { schedule: { ...medicationInput.schedule, daysOfWeek: [1, 1] } },
      { schedule: { ...medicationInput.schedule, daysOfWeek: [7] } },
      { schedule: { ...medicationInput.schedule, endDate: '2026-01-01' } },
      { dose: 0 },
      { quantity: 0 },
      { unknownField: 'no permitido' },
    ];

    for (const partial of invalidInputs) {
      const response = await createMedication(owner.accessToken, adult.id, {
        ...medicationInput,
        ...partial,
        schedule: partial.schedule ?? medicationInput.schedule,
      });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('lista activos, incluye pausados y hace baja logica', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const first = await createMedication(owner.accessToken, adult.id);
    const second = await createMedication(owner.accessToken, adult.id, {
      ...medicationInput,
      name: 'Metformina',
    });

    const paused = await request(app)
      .post(`/api/v1/adults/${adult.id}/medications/${first.body.data.id}/deactivate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(paused.status).toBe(200);

    const activeList = await request(app)
      .get(`/api/v1/adults/${adult.id}/medications`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(activeList.body.meta.total).toBe(1);
    expect(activeList.body.data[0].id).toBe(second.body.data.id);

    const allList = await request(app)
      .get(`/api/v1/adults/${adult.id}/medications?includeInactive=true`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(allList.body.meta.total).toBe(2);

    const removed = await request(app)
      .delete(`/api/v1/adults/${adult.id}/medications/${second.body.data.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(removed.status).toBe(200);
    const storedRemoved = await Medication.findById(second.body.data.id);
    expect(storedRemoved.deletedAt).toBeInstanceOf(Date);
    expect(
      (
        await request(app)
          .get(`/api/v1/adults/${adult.id}/medications?includeInactive=true`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
      ).body.meta.total,
    ).toBe(1);
  });

  it('permite editar, reactivar y registra eventos sin datos clinicos sensibles', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const created = await createMedication(owner.accessToken, adult.id);
    const medicationId = created.body.data.id;

    const updated = await request(app)
      .patch(`/api/v1/adults/${adult.id}/medications/${medicationId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        dose: 75,
        schedule: { ...medicationInput.schedule, times: ['07:30', '20:00'], daysOfWeek: [1] },
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.dose).toBe(75);
    expect(updated.body.data.schedule).toMatchObject({
      times: ['07:30', '20:00'],
      daysOfWeek: [1],
    });

    const deactivated = await request(app)
      .post(`/api/v1/adults/${adult.id}/medications/${medicationId}/deactivate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const activated = await request(app)
      .post(`/api/v1/adults/${adult.id}/medications/${medicationId}/activate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deactivated.status).toBe(200);
    expect(activated.status).toBe(200);

    const events = await ActivityEvent.find({ adultId: adult.id }).sort({ occurredAt: 1 }).lean();
    expect(events.map((event) => event.type)).toEqual([
      'MEDICATION_CREATED',
      'MEDICATION_UPDATED',
      'MEDICATION_DEACTIVATED',
      'MEDICATION_ACTIVATED',
    ]);
    for (const event of events) {
      expect(event.summary).not.toContain('Losartan');
      expect(JSON.stringify(event.payload)).not.toContain('Losartan');
      expect(JSON.stringify(event.payload)).not.toContain('75');
      expect(JSON.stringify(event.payload)).not.toContain('Despues');
    }
  });

  it('permite a OWNER y CAREGIVER gestionar medicamentos', async () => {
    const owner = await authenticatedUser();
    const caregiver = await authenticatedUser({ email: 'cuidador@ejemplo.com' });
    const adult = await createAdult(owner.accessToken);
    const granted = await grantCaregiver(owner.accessToken, adult.id, caregiver.user.email);
    expect(granted.status).toBe(201);

    const created = await createMedication(caregiver.accessToken, adult.id);
    expect(created.status).toBe(201);
    const updated = await request(app)
      .patch(`/api/v1/adults/${adult.id}/medications/${created.body.data.id}`)
      .set('Authorization', `Bearer ${caregiver.accessToken}`)
      .send({ instructions: 'Con agua' });
    expect(updated.status).toBe(200);
    const list = await request(app)
      .get(`/api/v1/adults/${adult.id}/medications`)
      .set('Authorization', `Bearer ${caregiver.accessToken}`);
    expect(list.status).toBe(200);
  });

  it('rechaza IDOR/BOLA, falta de token y acceso revocado', async () => {
    const owner = await authenticatedUser();
    const outsider = await authenticatedUser({ email: 'ajeno@ejemplo.com' });
    const caregiver = await authenticatedUser({ email: 'revocado@ejemplo.com' });
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(owner.accessToken, adult.id);
    await grantCaregiver(owner.accessToken, adult.id, caregiver.user.email);

    const foreign = await request(app)
      .get(`/api/v1/adults/${adult.id}/medications/${medication.body.data.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(foreign.status).toBe(404);

    const noToken = await request(app).get(`/api/v1/adults/${adult.id}/medications`);
    expect(noToken.status).toBe(401);

    const access = await CaregiverAccess.findOne({ adultId: adult.id, userId: caregiver.user._id });
    await request(app)
      .delete(`/api/v1/adults/${adult.id}/caregivers/${access._id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const revoked = await request(app)
      .get(`/api/v1/adults/${adult.id}/medications`)
      .set('Authorization', `Bearer ${caregiver.accessToken}`);
    expect(revoked.status).toBe(404);
  });

  it('permite leer pero bloquea escrituras mientras el adulto esta INACTIVE', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const created = await createMedication(owner.accessToken, adult.id);
    const medicationId = created.body.data.id;
    const deactivatedAdult = await request(app)
      .post(`/api/v1/adults/${adult.id}/deactivate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deactivatedAdult.status).toBe(200);

    const list = await request(app)
      .get(`/api/v1/adults/${adult.id}/medications`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const detail = await request(app)
      .get(`/api/v1/adults/${adult.id}/medications/${medicationId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(detail.body.data.nextOccurrenceAt).toBeNull();

    for (const response of [
      await createMedication(owner.accessToken, adult.id),
      await request(app)
        .patch(`/api/v1/adults/${adult.id}/medications/${medicationId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ dose: 10 }),
      await request(app)
        .post(`/api/v1/adults/${adult.id}/medications/${medicationId}/activate`)
        .set('Authorization', `Bearer ${owner.accessToken}`),
      await request(app)
        .delete(`/api/v1/adults/${adult.id}/medications/${medicationId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`),
    ]) {
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('BUSINESS_RULE');
    }

    const reactivatedAdult = await request(app)
      .post(`/api/v1/adults/${adult.id}/activate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(reactivatedAdult.status).toBe(200);
    const updated = await request(app)
      .patch(`/api/v1/adults/${adult.id}/medications/${medicationId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ dose: 10 });
    expect(updated.status).toBe(200);
  });

  it('mantiene aislamiento por adultId y los indices de Medication', async () => {
    const owner = await authenticatedUser();
    const firstAdult = await createAdult(owner.accessToken);
    const secondAdult = await createAdult(owner.accessToken, { ...adultInput, firstName: 'Jose' });
    const medication = await createMedication(owner.accessToken, firstAdult.id);

    const wrongAdult = await request(app)
      .get(`/api/v1/adults/${secondAdult.id}/medications/${medication.body.data.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(wrongAdult.status).toBe(404);

    const indexes = await Medication.collection.indexes();
    expect(indexes.map((index) => index.key)).toEqual(
      expect.arrayContaining([
        { adultId: 1, isActive: 1, deletedAt: 1 },
        { isActive: 1, deletedAt: 1 },
      ]),
    );
    expect(await Medication.countDocuments()).toBe(1);
  });

  it('materializa al escribir y re-materializa solo pendientes al editar o pausar', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const created = await createMedication(owner.accessToken, adult.id);
    const medicationId = created.body.data.id;
    const initialPending = await MedicationOccurrence.find({ medicationId, status: 'PENDING' });
    expect(initialPending.length).toBeGreaterThan(0);

    const updated = await request(app)
      .patch(`/api/v1/adults/${adult.id}/medications/${medicationId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ dose: 100 });
    expect(updated.status).toBe(200);
    const updatedPending = await MedicationOccurrence.find({ medicationId, status: 'PENDING' });
    expect(updatedPending.every((occurrence) => occurrence.snapshot.dose === 100)).toBe(true);

    const paused = await request(app)
      .post(`/api/v1/adults/${adult.id}/medications/${medicationId}/deactivate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(paused.status).toBe(200);
    expect(await MedicationOccurrence.countDocuments({ medicationId, status: 'PENDING' })).toBe(0);

    const activated = await request(app)
      .post(`/api/v1/adults/${adult.id}/medications/${medicationId}/activate`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(activated.status).toBe(200);
    expect(
      await MedicationOccurrence.countDocuments({ medicationId, status: 'PENDING' }),
    ).toBeGreaterThan(0);
  });

  it('re-materializa pendientes al cambiar la timezone y preserva una ocurrencia resuelta', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const created = await createMedication(owner.accessToken, adult.id, {
      ...medicationInput,
      schedule: { ...medicationInput.schedule, times: ['09:00'] },
    });
    const oldOccurrence = (
      await MedicationOccurrence.find({ medicationId: created.body.data.id }).sort({
        scheduledAt: 1,
      })
    )[0];
    oldOccurrence.status = 'TAKEN';
    oldOccurrence.confirmedAt = new Date();
    await oldOccurrence.save();

    const changed = await request(app)
      .patch(`/api/v1/adults/${adult.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ timezone: 'Europe/Madrid' });
    expect(changed.status).toBe(200);
    expect((await MedicationOccurrence.findById(oldOccurrence._id)).timezone).toBe(
      'America/Argentina/Buenos_Aires',
    );
    const pending = await MedicationOccurrence.find({
      medicationId: created.body.data.id,
      status: 'PENDING',
    });
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((occurrence) => occurrence.timezone === 'Europe/Madrid')).toBe(true);
  });

  it('declara requireAdultAccess en todas las rutas de medicamentos', () => {
    const { router } = createMedicationRouter({ env: createTestApp().env });
    const routes = router.stack.filter((layer) => layer.route);
    expect(routes).toHaveLength(7);
    for (const layer of routes) {
      expect(layer.route.path).toContain(':adultId');
      expect(layer.route.stack.map((entry) => entry.name)).toContain('requireAdultAccess');
    }
  });
});
