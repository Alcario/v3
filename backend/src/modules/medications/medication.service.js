import { Adult, AdultStatus } from '../../models/adult.model.js';
import { Medication } from '../../models/medication.model.js';
import { AppError } from '../../lib/errors.js';
import { withTransaction } from '../../lib/transactions.js';
import { nextScheduledOccurrence } from '../../lib/time.js';
import { createActivityService } from '../activity/activity.service.js';
import { createOccurrenceService } from '../occurrences/occurrence.service.js';

const medicationNotFound = () => new AppError('NOT_FOUND', 'El medicamento solicitado no existe.');
const adultNotFound = () => new AppError('NOT_FOUND', 'El adulto solicitado no existe.');
const inactiveAdult = () =>
  new AppError('BUSINESS_RULE', 'El adulto está inactivo y no admite cambios de medicación.');

function normalizeSchedule(schedule) {
  return {
    times: [...schedule.times].sort(),
    daysOfWeek: [...schedule.daysOfWeek].sort((a, b) => a - b),
    startDate: schedule.startDate,
    endDate: schedule.endDate ?? null,
  };
}

function buildMedicationFields(input, adultId, userId) {
  return {
    adultId,
    name: input.name,
    dose: input.dose,
    doseUnit: input.doseUnit,
    quantity: input.quantity,
    quantityUnit: input.quantityUnit,
    instructions: input.instructions ?? null,
    schedule: normalizeSchedule(input.schedule),
    graceMinutes: input.graceMinutes,
    isActive: true,
    deletedAt: null,
    createdByUserId: userId,
  };
}

function serializeMedication(medication, adult, now = new Date()) {
  const result = medication.toPublicJSON();
  const next =
    medication.isActive && adult.status === AdultStatus.ACTIVE
      ? nextScheduledOccurrence({ schedule: result.schedule, timezone: adult.timezone, now })
      : null;

  return {
    ...result,
    nextOccurrenceAt: next?.at?.toISOString() ?? null,
    nextOccurrenceLocal: next
      ? { date: next.localDate, time: next.localTime, timezone: next.timezone }
      : null,
    // AlexaReminderSync is introduced in Iteration 16; until then there is no
    // external desired state to reconcile.
    remindersPendingSync: false,
  };
}

export function createMedicationService({ occurrenceService = createOccurrenceService() } = {}) {
  const activityService = createActivityService();

  async function findAdult(adultId) {
    const adult = await Adult.findOne({ _id: adultId, deletedAt: null });
    if (!adult) throw adultNotFound();
    return adult;
  }

  async function requireActiveAdult(adultId, session) {
    const query = Adult.findOne({ _id: adultId, deletedAt: null });
    if (session) query.session(session);
    const adult = await query;
    if (!adult) throw adultNotFound();
    if (adult.status !== AdultStatus.ACTIVE) throw inactiveAdult();
    return adult;
  }

  function recordMedicationEvent({ adultId, medication, actor, type, summary, session }) {
    return activityService.record(
      {
        adultId,
        type,
        actorUserId: actor.userId,
        summary,
        payload: { medicationId: medication._id.toString() },
        relatedId: medication._id,
        relatedModel: 'Medication',
      },
      { session },
    );
  }

  async function create({ adultId, actor, input }) {
    const result = await withTransaction(async (session) => {
      const adult = await requireActiveAdult(adultId, session);
      const [medication] = await Medication.create(
        [buildMedicationFields(input, adultId, actor.userId)],
        { session },
      );
      await recordMedicationEvent({
        adultId,
        medication,
        actor,
        type: 'MEDICATION_CREATED',
        summary: 'Medicamento creado',
        session,
      });
      return { medication, adult };
    });
    await occurrenceService.reconcileMedication({ medicationId: result.medication._id });
    return serializeMedication(result.medication, result.adult);
  }

  async function list({ adultId, includeInactive = false }) {
    const adult = await findAdult(adultId);
    const filter = { adultId, deletedAt: null };
    if (!includeInactive) filter.isActive = true;
    const medications = await Medication.find(filter).sort({ name: 1, createdAt: 1 });
    return {
      data: medications.map((medication) => serializeMedication(medication, adult)),
      meta: { total: medications.length },
    };
  }

  async function get({ adultId, medicationId }) {
    const adult = await findAdult(adultId);
    const medication = await Medication.findOne({
      _id: medicationId,
      adultId,
      deletedAt: null,
    });
    if (!medication) throw medicationNotFound();
    return serializeMedication(medication, adult);
  }

  function buildUpdates(input) {
    const updates = {};
    for (const field of ['name', 'dose', 'doseUnit', 'quantity', 'quantityUnit', 'graceMinutes']) {
      if (input[field] !== undefined) updates[field] = input[field];
    }
    if (input.instructions !== undefined) updates.instructions = input.instructions;
    if (input.schedule !== undefined) updates.schedule = normalizeSchedule(input.schedule);
    return updates;
  }

  async function update({ adultId, medicationId, actor, input }) {
    const result = await withTransaction(async (session) => {
      const adult = await requireActiveAdult(adultId, session);
      const medication = await Medication.findOneAndUpdate(
        { _id: medicationId, adultId, deletedAt: null },
        { $set: buildUpdates(input) },
        { new: true, runValidators: true, session },
      );
      if (!medication) throw medicationNotFound();
      await recordMedicationEvent({
        adultId,
        medication,
        actor,
        type: 'MEDICATION_UPDATED',
        summary: 'Medicamento actualizado',
        session,
      });
      return { medication, adult };
    });
    await occurrenceService.reconcileMedication({ medicationId: result.medication._id });
    return serializeMedication(result.medication, result.adult);
  }

  async function setActive({ adultId, medicationId, actor, isActive }) {
    const result = await withTransaction(async (session) => {
      const adult = await requireActiveAdult(adultId, session);
      const medication = await Medication.findOne({
        _id: medicationId,
        adultId,
        deletedAt: null,
      }).session(session);
      if (!medication) throw medicationNotFound();

      if (medication.isActive !== isActive) {
        medication.isActive = isActive;
        await medication.save({ session });
        await recordMedicationEvent({
          adultId,
          medication,
          actor,
          type: isActive ? 'MEDICATION_ACTIVATED' : 'MEDICATION_DEACTIVATED',
          summary: isActive ? 'Medicamento activado' : 'Medicamento desactivado',
          session,
        });
      }
      return { medication, adult };
    });
    await occurrenceService.reconcileMedication({ medicationId: result.medication._id });
    return serializeMedication(result.medication, result.adult);
  }

  async function remove({ adultId, medicationId, actor }) {
    const result = await withTransaction(async (session) => {
      const adult = await requireActiveAdult(adultId, session);
      const medication = await Medication.findOne({
        _id: medicationId,
        adultId,
        deletedAt: null,
      }).session(session);
      if (!medication) throw medicationNotFound();

      medication.isActive = false;
      medication.deletedAt = new Date();
      await medication.save({ session });
      await recordMedicationEvent({
        adultId,
        medication,
        actor,
        type: 'MEDICATION_DEACTIVATED',
        summary: 'Medicamento dado de baja',
        session,
      });
      return { medication, adult };
    });
    await occurrenceService.removePendingFuture({ medicationId: result.medication._id });
    return serializeMedication(result.medication, result.adult);
  }

  return { create, list, get, update, setActive, remove, occurrenceService };
}
