import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import {
  MedicationOccurrence,
  MedicationOccurrenceStatus,
} from '../src/models/medicationOccurrence.model.js';
import { createOccurrenceService } from '../src/modules/occurrences/occurrence.service.js';
import { localDateTimeToUtc } from '../src/lib/time.js';

const FIXED_NOW = new Date('2026-10-02T11:00:00.000Z');
const adultInput = {
  firstName: 'Rosa',
  lastName: 'Gomez',
  birthDate: '1944-03-12',
  timezone: 'America/Argentina/Buenos_Aires',
  contacts: [],
  consentConfirmed: true,
};

function medicationFields(adultId, userId, overrides = {}) {
  return {
    adultId,
    createdByUserId: userId,
    name: 'Losartan',
    dose: 50,
    doseUnit: 'MG',
    quantity: 1,
    quantityUnit: 'COMPRIMIDO',
    instructions: 'Despues del desayuno',
    schedule: {
      times: ['09:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-10-01',
      endDate: null,
    },
    graceMinutes: 180,
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}

describe('Iteracion 5 - ocurrencias y confirmaciones', () => {
  let app;
  let env;
  let occurrenceService;

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
      MedicationOccurrence.deleteMany({}),
      Medication.deleteMany({}),
      CaregiverAccess.deleteMany({}),
      Adult.deleteMany({}),
      ActivityEvent.deleteMany({}),
      AuthSession.deleteMany({}),
      User.deleteMany({}),
    ]);
    ({ app, env } = createTestApp());
    occurrenceService = createOccurrenceService();
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

  async function createMedication(adultId, userId, overrides = {}) {
    return Medication.create(medicationFields(adultId, userId, overrides));
  }

  async function materialize(medicationId, from = FIXED_NOW, hours = 48) {
    return occurrenceService.materialize({
      medicationId,
      from,
      to: new Date(from.getTime() + hours * 3_600_000),
    });
  }

  it('materializa el horizonte de 48 horas con UTC, fecha local y snapshot', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    const result = await materialize(medication._id);

    expect(result.createdCount).toBe(2);
    const occurrences = await MedicationOccurrence.find({ medicationId: medication._id }).sort({
      scheduledAt: 1,
    });
    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((occurrence) => occurrence.scheduledAt.toISOString())).toEqual([
      '2026-10-02T12:00:00.000Z',
      '2026-10-03T12:00:00.000Z',
    ]);
    expect(occurrences[0].toPublicJSON()).toMatchObject({
      adultId: adult.id,
      medicationId: medication._id.toString(),
      localDate: '2026-10-02',
      localTime: '09:00',
      timezone: adult.timezone,
      status: 'PENDING',
      medication: {
        name: 'Losartan',
        dose: 50,
        quantity: 1,
      },
    });
  });

  it('respeta dias, vigencia, medicamento pausado y adulto inactivo', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const weekday = await createMedication(adult.id, owner.user._id, {
      schedule: {
        times: ['09:00'],
        daysOfWeek: [1, 2, 3, 4, 5],
        startDate: '2026-10-01',
        endDate: '2026-10-10',
      },
    });
    const paused = await createMedication(adult.id, owner.user._id, {
      name: 'Pausado',
      isActive: false,
    });
    expect((await materialize(weekday._id)).createdCount).toBe(1);
    expect((await materialize(paused._id)).createdCount).toBe(0);

    await Adult.updateOne({ _id: adult.id }, { $set: { status: 'INACTIVE' } });
    const inactive = await createMedication(adult.id, owner.user._id, { name: 'Otro' });
    expect((await materialize(inactive._id)).createdCount).toBe(0);
    expect(await MedicationOccurrence.countDocuments()).toBe(1);
  });

  it('resuelve DST manteniendo la hora de pared', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken, {
      ...adultInput,
      timezone: 'Europe/Madrid',
    });
    const medication = await createMedication(adult.id, owner.user._id, {
      schedule: {
        times: ['09:00'],
        daysOfWeek: [0, 6],
        startDate: '2026-10-24',
        endDate: '2026-10-26',
      },
    });
    const result = await materialize(medication._id, new Date('2026-10-24T00:00:00.000Z'), 48);
    expect(result.createdCount).toBe(2);
    const occurrences = await MedicationOccurrence.find({ medicationId: medication._id }).sort({
      scheduledAt: 1,
    });
    expect(occurrences.map((occurrence) => occurrence.scheduledAt.toISOString())).toEqual([
      '2026-10-24T07:00:00.000Z',
      '2026-10-25T08:00:00.000Z',
    ]);
  });

  it('es idempotente y no duplica ocurrencias con materializadores concurrentes', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    const results = await Promise.all([
      materialize(medication._id),
      materialize(medication._id),
      materialize(medication._id),
    ]);

    expect(await MedicationOccurrence.countDocuments({ medicationId: medication._id })).toBe(2);
    expect(results.reduce((sum, result) => sum + result.createdCount, 0)).toBe(2);
    const existing = await MedicationOccurrence.findOne({ medicationId: medication._id });
    await expect(
      MedicationOccurrence.create({
        ...existing.toObject(),
        _id: undefined,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('conserva el snapshot histórico al cambiar nombre, dosis e indicaciones', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    await materialize(medication._id);
    await Medication.updateOne(
      { _id: medication._id },
      {
        $set: {
          name: 'Losartan actualizado',
          dose: 100,
          instructions: 'Con la cena',
        },
      },
    );
    const historical = await MedicationOccurrence.findOne({
      medicationId: medication._id,
      localDate: '2026-10-02',
    });
    expect(historical.snapshot).toMatchObject({
      name: 'Losartan',
      dose: 50,
      instructions: 'Despues del desayuno',
    });

    await occurrenceService.reconcileMedication({
      medicationId: medication._id,
      now: new Date('2026-10-02T13:00:00.000Z'),
    });
    const future = await MedicationOccurrence.findOne({
      medicationId: medication._id,
      localDate: '2026-10-03',
    });
    expect(future.snapshot).toMatchObject({
      name: 'Losartan actualizado',
      dose: 100,
      instructions: 'Con la cena',
    });
  });

  it('marca MISSED solo después de graceMinutes y no toca estados resueltos', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id, { graceMinutes: 60 });
    await materialize(medication._id, new Date('2026-10-02T11:00:00.000Z'), 30);
    const occurrence = await MedicationOccurrence.findOne({ medicationId: medication._id });
    const beforeDeadline = new Date(occurrence.scheduledAt.getTime() + 59 * 60_000);
    expect((await occurrenceService.sweep({ now: beforeDeadline })).missedCount).toBe(0);
    const afterDeadline = new Date(occurrence.scheduledAt.getTime() + 61 * 60_000);
    expect((await occurrenceService.sweep({ now: afterDeadline })).missedCount).toBe(1);
    expect((await occurrenceService.sweep({ now: afterDeadline })).missedCount).toBe(0);
    expect((await MedicationOccurrence.findById(occurrence._id)).status).toBe(
      MedicationOccurrenceStatus.MISSED,
    );
    expect(await ActivityEvent.countDocuments({ type: 'MEDICATION_MISSED' })).toBe(1);

    const taken = await MedicationOccurrence.findOne({
      medicationId: medication._id,
      status: 'PENDING',
    });
    taken.status = MedicationOccurrenceStatus.TAKEN;
    taken.confirmedAt = new Date();
    await taken.save();
    expect(
      (await occurrenceService.sweep({ now: new Date('2026-10-10T00:00:00.000Z') })).missedCount,
    ).toBe(0);
  });

  it('confirma de forma idempotente, registra source y evita eventos duplicados', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    await materialize(medication._id);
    const occurrence = await MedicationOccurrence.findOne({ medicationId: medication._id });
    const confirmed = await occurrenceService.confirm({
      adultId: adult.id,
      occurrenceId: occurrence._id,
      actor: { userId: owner.user._id.toString() },
      now: new Date('2026-10-02T12:05:00.000Z'),
    });
    const confirmedAt = confirmed.confirmedAt;
    const repeated = await occurrenceService.confirm({
      adultId: adult.id,
      occurrenceId: occurrence._id,
      actor: { userId: owner.user._id.toString() },
      now: new Date('2026-10-02T12:06:00.000Z'),
    });
    expect(confirmed).toMatchObject({ status: 'TAKEN', source: 'WEB', idempotent: false });
    expect(repeated).toMatchObject({
      status: 'TAKEN',
      source: 'WEB',
      idempotent: true,
      confirmedAt,
    });
    expect(await ActivityEvent.countDocuments({ type: 'MEDICATION_CONFIRMED' })).toBe(1);
  });

  it('devuelve todas las ocurrencias pendientes de una misma franja', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const first = await createMedication(adult.id, owner.user._id, { name: 'Losartan' });
    const second = await createMedication(adult.id, owner.user._id, { name: 'Metformina' });
    await materialize(first._id);
    await materialize(second._id);

    const pending = await occurrenceService.findConfirmable({
      adultId: adult.id,
      now: new Date('2026-10-02T12:05:00.000Z'),
    });
    expect(pending).toHaveLength(2);
    expect(pending.map((item) => item.medication.name)).toEqual(['Losartan', 'Metformina']);
    expect(pending.every((item) => item.status === 'PENDING')).toBe(true);
  });

  it('permite al adaptador futuro de Alexa confirmar sin exponer endpoint Alexa', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    await materialize(medication._id);
    const occurrence = await MedicationOccurrence.findOne({ medicationId: medication._id });

    const confirmed = await occurrenceService.confirm({
      adultId: adult.id,
      occurrenceId: occurrence._id,
      source: 'ALEXA',
      now: new Date('2026-10-02T12:05:00.000Z'),
    });

    expect(confirmed).toMatchObject({ status: 'TAKEN', source: 'ALEXA', confirmedByUserId: null });
    expect(
      await ActivityEvent.countDocuments({ type: 'MEDICATION_CONFIRMED', source: 'ALEXA' }),
    ).toBe(1);
  });

  it('dos confirmaciones concurrentes producen una sola confirmación y un solo evento', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    await materialize(medication._id);
    const occurrence = await MedicationOccurrence.findOne({ medicationId: medication._id });
    const results = await Promise.all(
      [1, 2].map(() =>
        occurrenceService.confirm({
          adultId: adult.id,
          occurrenceId: occurrence._id,
          actor: { userId: owner.user._id.toString() },
          now: new Date('2026-10-02T12:05:00.000Z'),
        }),
      ),
    );
    expect(results.filter((result) => !result.idempotent)).toHaveLength(1);
    expect(await ActivityEvent.countDocuments({ type: 'MEDICATION_CONFIRMED' })).toBe(1);
  });

  it('permite confirmar MISSED desde WEB, rechaza SKIPPED y soporta source ALEXA en el servicio', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id, { graceMinutes: 15 });
    await materialize(medication._id);
    const occurrence = await MedicationOccurrence.findOne({ medicationId: medication._id });
    await occurrenceService.sweep({
      now: new Date(occurrence.scheduledAt.getTime() + 16 * 60_000),
    });
    const late = await occurrenceService.confirm({
      adultId: adult.id,
      occurrenceId: occurrence._id,
      actor: { userId: owner.user._id.toString() },
      now: new Date(occurrence.scheduledAt.getTime() + 20 * 60_000),
    });
    expect(late).toMatchObject({ status: 'TAKEN', confirmedOutOfWindow: true, source: 'WEB' });

    const second = await MedicationOccurrence.findOne({
      medicationId: medication._id,
      status: 'PENDING',
    });
    second.status = MedicationOccurrenceStatus.SKIPPED;
    await second.save();
    await expect(
      occurrenceService.confirm({
        adultId: adult.id,
        occurrenceId: second._id,
        source: 'ALEXA',
        now: FIXED_NOW,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('expone endpoints protegidos, snapshot histórico y aislamiento IDOR', async () => {
    const owner = await authenticatedUser();
    const outsider = await authenticatedUser({ email: 'ajeno@ejemplo.com' });
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    await materialize(medication._id);
    const occurrence = await MedicationOccurrence.findOne({ medicationId: medication._id });

    const list = await request(app)
      .get(
        `/api/v1/adults/${adult.id}/medication-occurrences?from=2026-10-02&to=2026-10-03&limit=1`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].medication.name).toBe('Losartan');
    expect(list.body.meta.nextCursor).toEqual(expect.any(String));

    const pageTwo = await request(app)
      .get(`/api/v1/adults/${adult.id}/medication-occurrences?cursor=${list.body.meta.nextCursor}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.data).toHaveLength(1);

    const foreign = await request(app)
      .post(`/api/v1/adults/${adult.id}/medication-occurrences/${occurrence._id}/confirm`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(foreign.status).toBe(404);
    const noToken = await request(app).get(`/api/v1/adults/${adult.id}/medication-occurrences`);
    expect(noToken.status).toBe(401);
    const invalid = await request(app)
      .post(`/api/v1/adults/${adult.id}/medication-occurrences/not-an-id/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(invalid.status).toBe(400);
  });

  it('confirma y omite desde API, fija WEB y rechaza mass assignment', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    await materialize(medication._id);
    const occurrence = await MedicationOccurrence.findOne({ medicationId: medication._id });
    const response = await request(app)
      .post(`/api/v1/adults/${adult.id}/medication-occurrences/${occurrence._id}/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ source: 'ALEXA', confirmedByUserId: 'malicioso' });
    expect(response.status).toBe(400);

    const confirmed = await request(app)
      .post(`/api/v1/adults/${adult.id}/medication-occurrences/${occurrence._id}/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ note: 'Confirmado por el cuidador' });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data).toMatchObject({ status: 'TAKEN', source: 'WEB' });

    const skippedOccurrence = await MedicationOccurrence.findOne({
      medicationId: medication._id,
      status: MedicationOccurrenceStatus.PENDING,
    });
    const skipped = await request(app)
      .post(`/api/v1/adults/${adult.id}/medication-occurrences/${skippedOccurrence._id}/skip`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ note: 'No correspondia' });
    expect(skipped.status).toBe(200);
    expect(skipped.body.data.status).toBe('SKIPPED');
  });

  it('reconcilia cambios de timezone y conserva ocurrencias históricas', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    await materialize(medication._id);
    const historical = await MedicationOccurrence.findOne({ medicationId: medication._id });
    historical.status = MedicationOccurrenceStatus.TAKEN;
    historical.confirmedAt = FIXED_NOW;
    await historical.save();
    await Adult.updateOne({ _id: adult.id }, { $set: { timezone: 'Europe/Madrid' } });
    await occurrenceService.reconcileAdult({
      adultId: adult.id,
      now: FIXED_NOW,
    });
    const unchanged = await MedicationOccurrence.findById(historical._id);
    expect(unchanged.timezone).toBe('America/Argentina/Buenos_Aires');
    const future = await MedicationOccurrence.findOne({
      medicationId: medication._id,
      localDate: '2026-10-03',
    });
    expect(future.timezone).toBe('Europe/Madrid');
    expect(future.scheduledAt.toISOString()).toBe('2026-10-03T07:00:00.000Z');
  });

  it('el soft delete de Medication conserva el historial de ocurrencias', async () => {
    const owner = await authenticatedUser();
    const adult = await createAdult(owner.accessToken);
    const medication = await createMedication(adult.id, owner.user._id);
    await materialize(medication._id);
    const before = await MedicationOccurrence.countDocuments({ medicationId: medication._id });
    await Medication.updateOne(
      { _id: medication._id },
      { $set: { deletedAt: new Date(), isActive: false } },
    );
    await occurrenceService.removePendingFuture({
      medicationId: medication._id,
      from: new Date('2026-10-04T00:00:00.000Z'),
    });
    expect(await MedicationOccurrence.countDocuments({ medicationId: medication._id })).toBe(
      before,
    );
  });

  it('los cuatro índices de MedicationOccurrence existen', async () => {
    const indexes = await MedicationOccurrence.collection.indexes();
    expect(indexes.map((index) => index.key)).toEqual(
      expect.arrayContaining([
        { medicationId: 1, scheduledAt: 1 },
        { adultId: 1, localDate: 1, localTime: 1 },
        { adultId: 1, status: 1, scheduledAt: 1 },
        { status: 1, scheduledAt: 1 },
      ]),
    );
  });

  it('la conversión de UTC del horario materializado coincide con la utilidad de tiempo', () => {
    const expected = localDateTimeToUtc({
      date: '2026-10-02',
      time: '09:00',
      timezone: adultInput.timezone,
    });
    expect(expected.toISOString()).toBe('2026-10-02T12:00:00.000Z');
  });
});
