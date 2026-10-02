import mongoose from 'mongoose';
import { Adult, AdultStatus } from '../../models/adult.model.js';
import {
  MedicationOccurrence,
  MedicationOccurrenceSource,
  MedicationOccurrenceStatus,
} from '../../models/medicationOccurrence.model.js';
import { Medication } from '../../models/medication.model.js';
import { AppError } from '../../lib/errors.js';
import { getLocalDateTime, scheduledOccurrencesBetween } from '../../lib/time.js';
import { withTransaction } from '../../lib/transactions.js';
import { ActivityActorType, ActivitySource } from '../../models/activityEvent.model.js';
import { createActivityService } from '../activity/activity.service.js';

const HORIZON_HOURS = 48;
const EARLY_CONFIRMATION_MINUTES = 60;

const occurrenceNotFound = () =>
  new AppError('NOT_FOUND', 'La toma de medicación solicitada no existe.');
const invalidState = (message = 'La toma de medicación no admite esa transición.') =>
  new AppError('INVALID_STATE', message);
const adultNotFound = () => new AppError('NOT_FOUND', 'El adulto solicitado no existe.');

function asDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function snapshotFromMedication(medication) {
  return {
    name: medication.name,
    dose: medication.dose,
    doseUnit: medication.doseUnit,
    quantity: medication.quantity,
    quantityUnit: medication.quantityUnit,
    instructions: medication.instructions ?? null,
  };
}

function serialize(occurrence, now = new Date()) {
  const result = occurrence.toPublicJSON();
  const instant = asDate(now);
  const earliest = new Date(occurrence.scheduledAt.getTime() - EARLY_CONFIRMATION_MINUTES * 60_000);
  const latest = new Date(occurrence.scheduledAt.getTime() + occurrence.graceMinutes * 60_000);
  return {
    ...result,
    confirmable:
      occurrence.status === MedicationOccurrenceStatus.PENDING &&
      instant >= earliest &&
      instant <= latest,
  };
}

function eventActor({ source, actor }) {
  if (source === MedicationOccurrenceSource.ALEXA) {
    return { source: ActivitySource.ALEXA, actorType: ActivityActorType.ADULT, actorUserId: null };
  }
  if (source === MedicationOccurrenceSource.SYSTEM) {
    return {
      source: ActivitySource.SYSTEM,
      actorType: ActivityActorType.SYSTEM,
      actorUserId: null,
    };
  }
  return {
    source: ActivitySource.WEB,
    actorType: ActivityActorType.CAREGIVER,
    actorUserId: actor?.userId ?? null,
  };
}

export function createOccurrenceService({ horizonHours = HORIZON_HOURS } = {}) {
  const activityService = createActivityService();

  async function findAdult(adultId, session) {
    const query = Adult.findOne({ _id: adultId, deletedAt: null });
    if (session) query.session(session);
    const adult = await query;
    if (!adult) throw adultNotFound();
    return adult;
  }

  async function materialize({ medicationId, from = new Date(), to } = {}) {
    const start = asDate(from);
    const end = to ? asDate(to) : new Date(start.getTime() + horizonHours * 3_600_000);
    const medication = await Medication.findOne({
      _id: medicationId,
      isActive: true,
      deletedAt: null,
    });
    if (!medication) return { createdCount: 0, existingCount: 0, skipped: true };

    const adult = await Adult.findOne({ _id: medication.adultId, deletedAt: null });
    if (!adult || adult.status !== AdultStatus.ACTIVE) {
      return { createdCount: 0, existingCount: 0, skipped: true };
    }

    const scheduled = scheduledOccurrencesBetween({
      schedule: medication.schedule,
      timezone: adult.timezone,
      from: start,
      to: end,
    });
    let createdCount = 0;
    let existingCount = 0;
    for (const item of scheduled) {
      try {
        const result = await MedicationOccurrence.updateOne(
          { medicationId: medication._id, scheduledAt: item.at },
          {
            $setOnInsert: {
              adultId: adult._id,
              medicationId: medication._id,
              scheduledAt: item.at,
              localDate: item.localDate,
              localTime: item.localTime,
              timezone: item.timezone,
              status: MedicationOccurrenceStatus.PENDING,
              confirmedAt: null,
              source: null,
              confirmedByUserId: null,
              confirmedOutOfWindow: false,
              snapshot: snapshotFromMedication(medication),
              graceMinutes: medication.graceMinutes,
              note: null,
            },
          },
          { upsert: true, runValidators: true },
        );
        if (result.upsertedCount) createdCount += 1;
        else existingCount += 1;
      } catch (error) {
        // A concurrent materializer can win the unique upsert between Mongo's
        // match and insert. The unique index makes that race harmless.
        if (error?.code === 11000) existingCount += 1;
        else throw error;
      }
    }
    return { createdCount, existingCount, skipped: false };
  }

  async function materializeAll({ now = new Date(), horizonHours: requestedHorizon } = {}) {
    const start = asDate(now);
    const end = new Date(start.getTime() + (requestedHorizon ?? horizonHours) * 3_600_000);
    const medications = await Medication.find({ isActive: true, deletedAt: null }).select('_id');
    const totals = { createdCount: 0, existingCount: 0, skippedCount: 0, failedCount: 0 };
    for (const medication of medications) {
      try {
        const result = await materialize({ medicationId: medication._id, from: start, to: end });
        totals.createdCount += result.createdCount;
        totals.existingCount += result.existingCount;
        if (result.skipped) totals.skippedCount += 1;
      } catch {
        totals.failedCount += 1;
      }
    }
    return totals;
  }

  async function removePendingFuture({ medicationId, adultId, from = new Date() }) {
    const filter = {
      status: MedicationOccurrenceStatus.PENDING,
      scheduledAt: mongoose.trusted({ $gte: asDate(from) }),
    };
    if (medicationId) filter.medicationId = medicationId;
    if (adultId) filter.adultId = adultId;
    const result = await MedicationOccurrence.deleteMany(mongoose.trusted(filter));
    return result.deletedCount;
  }

  async function reconcileMedication({ medicationId, now = new Date() }) {
    await removePendingFuture({ medicationId, from: now });
    return materialize({ medicationId, from: now });
  }

  async function reconcileAdult({ adultId, now = new Date() }) {
    const adult = await Adult.findOne({ _id: adultId, deletedAt: null });
    if (!adult) throw adultNotFound();
    // An inactive adult stops future materialization, but occurrences already
    // materialized remain as history and can be swept normally.
    if (adult.status !== AdultStatus.ACTIVE) {
      return { createdCount: 0, existingCount: 0, skippedCount: 1, failedCount: 0 };
    }
    await removePendingFuture({ adultId, from: now });
    const medications = await Medication.find({ adultId, isActive: true, deletedAt: null }).select(
      '_id',
    );
    const totals = { createdCount: 0, existingCount: 0, skippedCount: 0, failedCount: 0 };
    for (const medication of medications) {
      const result = await materialize({ medicationId: medication._id, from: now });
      totals.createdCount += result.createdCount;
      totals.existingCount += result.existingCount;
      if (result.skipped) totals.skippedCount += 1;
    }
    return totals;
  }

  async function sweep({ now = new Date() } = {}) {
    const instant = asDate(now);
    const pending = await MedicationOccurrence.find(
      mongoose.trusted({
        status: MedicationOccurrenceStatus.PENDING,
        scheduledAt: mongoose.trusted({ $lte: instant }),
      }),
    ).select('_id adultId scheduledAt graceMinutes');
    let missedCount = 0;
    for (const candidate of pending) {
      const deadline = new Date(candidate.scheduledAt.getTime() + candidate.graceMinutes * 60_000);
      if (deadline > instant) continue;
      const changed = await withTransaction(async (session) => {
        const occurrence = await MedicationOccurrence.findOneAndUpdate(
          mongoose.trusted({
            _id: candidate._id,
            status: MedicationOccurrenceStatus.PENDING,
            scheduledAt: mongoose.trusted({
              $lte: new Date(instant.getTime() - candidate.graceMinutes * 60_000),
            }),
          }),
          { $set: { status: MedicationOccurrenceStatus.MISSED } },
          { new: true, session },
        );
        if (!occurrence) return false;
        await activityService.record(
          {
            adultId: occurrence.adultId,
            type: 'MEDICATION_MISSED',
            summary: 'No se registró confirmación de la toma',
            payload: { occurrenceId: occurrence._id.toString() },
            relatedId: occurrence._id,
            relatedModel: 'MedicationOccurrence',
            source: ActivitySource.SYSTEM,
            actorType: ActivityActorType.SYSTEM,
            actorUserId: null,
          },
          { session },
        );
        return true;
      });
      if (changed) missedCount += 1;
    }
    return { missedCount };
  }

  async function findConfirmable({ adultId, now = new Date() }) {
    const instant = asDate(now);
    const candidates = await MedicationOccurrence.find(
      mongoose.trusted({
        adultId,
        status: MedicationOccurrenceStatus.PENDING,
        scheduledAt: mongoose.trusted({
          $gte: new Date(instant.getTime() - 720 * 60_000),
          $lte: new Date(instant.getTime() + EARLY_CONFIRMATION_MINUTES * 60_000),
        }),
      }),
    ).sort({ scheduledAt: 1, _id: 1 });
    return candidates
      .filter((occurrence) => {
        const earliest = occurrence.scheduledAt.getTime() - EARLY_CONFIRMATION_MINUTES * 60_000;
        const latest = occurrence.scheduledAt.getTime() + occurrence.graceMinutes * 60_000;
        return instant.getTime() >= earliest && instant.getTime() <= latest;
      })
      .map((occurrence) => serialize(occurrence, instant));
  }

  async function confirm({
    adultId,
    occurrenceId,
    actor,
    source = MedicationOccurrenceSource.WEB,
    now = new Date(),
    note = null,
  }) {
    const instant = asDate(now);
    const result = await withTransaction(async (session) => {
      const occurrence = await MedicationOccurrence.findOne({ _id: occurrenceId, adultId }).session(
        session,
      );
      if (!occurrence) throw occurrenceNotFound();
      if (occurrence.status === MedicationOccurrenceStatus.TAKEN) {
        return { occurrence, idempotent: true };
      }
      if (occurrence.status === MedicationOccurrenceStatus.SKIPPED) {
        throw invalidState('No se puede confirmar una toma omitida.');
      }
      if (
        occurrence.status === MedicationOccurrenceStatus.MISSED &&
        source !== MedicationOccurrenceSource.WEB
      ) {
        throw invalidState('La toma quedó fuera de la ventana de confirmación.');
      }

      const earliest = occurrence.scheduledAt.getTime() - EARLY_CONFIRMATION_MINUTES * 60_000;
      const latest = occurrence.scheduledAt.getTime() + occurrence.graceMinutes * 60_000;
      const outOfWindow =
        occurrence.status === MedicationOccurrenceStatus.MISSED ||
        instant.getTime() < earliest ||
        instant.getTime() > latest;
      const updated = await MedicationOccurrence.findOneAndUpdate(
        { _id: occurrence._id, adultId, status: occurrence.status },
        {
          $set: {
            status: MedicationOccurrenceStatus.TAKEN,
            confirmedAt: instant,
            source,
            confirmedByUserId:
              source === MedicationOccurrenceSource.WEB ? (actor?.userId ?? null) : null,
            confirmedOutOfWindow: outOfWindow,
            note: note ?? null,
          },
        },
        { new: true, session },
      );
      if (!updated) {
        const current = await MedicationOccurrence.findOne({ _id: occurrenceId, adultId }).session(
          session,
        );
        if (current?.status === MedicationOccurrenceStatus.TAKEN)
          return { occurrence: current, idempotent: true };
        throw invalidState();
      }
      const actorFields = eventActor({ source, actor });
      await activityService.record(
        {
          adultId,
          type: 'MEDICATION_CONFIRMED',
          summary: 'Confirmación declarada de toma registrada',
          payload: { occurrenceId: occurrence._id.toString(), source },
          relatedId: occurrence._id,
          relatedModel: 'MedicationOccurrence',
          ...actorFields,
        },
        { session },
      );
      return { occurrence: updated, idempotent: false };
    });
    return { ...serialize(result.occurrence, instant), idempotent: result.idempotent };
  }

  async function skip({ adultId, occurrenceId, actor, note = null, now = new Date() }) {
    const result = await withTransaction(async (session) => {
      const occurrence = await MedicationOccurrence.findOne({ _id: occurrenceId, adultId }).session(
        session,
      );
      if (!occurrence) throw occurrenceNotFound();
      if (
        ![MedicationOccurrenceStatus.PENDING, MedicationOccurrenceStatus.MISSED].includes(
          occurrence.status,
        )
      ) {
        throw invalidState('Solo se puede omitir una toma pendiente o sin confirmación.');
      }
      const updated = await MedicationOccurrence.findOneAndUpdate(
        { _id: occurrence._id, adultId, status: occurrence.status },
        { $set: { status: MedicationOccurrenceStatus.SKIPPED, note: note ?? null } },
        { new: true, session },
      );
      if (!updated) throw invalidState();
      await activityService.record(
        {
          adultId,
          type: 'MEDICATION_SKIPPED',
          summary: 'Toma omitida por un cuidador',
          payload: { occurrenceId: occurrence._id.toString() },
          relatedId: occurrence._id,
          relatedModel: 'MedicationOccurrence',
          ...eventActor({ source: MedicationOccurrenceSource.WEB, actor }),
        },
        { session },
      );
      return updated;
    });
    return serialize(result, now);
  }

  async function list({ adultId, query = {}, now = new Date() }) {
    const adult = await findAdult(adultId);
    const instant = asDate(now);
    const localNow = getLocalDateTime({ instant, timezone: adult.timezone });
    const today = localNow.toISODate();
    const date = new Date(`${today}T00:00:00.000Z`);
    const defaultFrom = new Date(date.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
    const filter = {
      adultId,
      localDate: mongoose.trusted({
        $gte: query.from ?? defaultFrom,
        $lte: query.to ?? today,
      }),
    };
    if (query.status?.length) {
      filter.status = mongoose.trusted({
        $in: Array.isArray(query.status) ? query.status : [query.status],
      });
    }
    if (query.medicationId) filter.medicationId = query.medicationId;

    if (query.cursor) {
      const cursor = await MedicationOccurrence.findOne({ _id: query.cursor, adultId }).select(
        'scheduledAt',
      );
      if (!cursor) return { data: [], meta: { limit: query.limit ?? 20, nextCursor: null } };
      filter.$or = mongoose.trusted([
        { scheduledAt: mongoose.trusted({ $lt: cursor.scheduledAt }) },
        { scheduledAt: cursor.scheduledAt, _id: mongoose.trusted({ $lt: cursor._id }) },
      ]);
    }
    const limit = query.limit ?? 20;
    const occurrences = await MedicationOccurrence.find(mongoose.trusted(filter))
      .sort({ scheduledAt: -1, _id: -1 })
      .limit(limit);
    return {
      data: occurrences.map((occurrence) => serialize(occurrence, instant)),
      meta: {
        limit,
        nextCursor: occurrences.length === limit ? occurrences.at(-1)._id.toString() : null,
      },
    };
  }

  async function get({ adultId, occurrenceId, now = new Date() }) {
    const occurrence = await MedicationOccurrence.findOne({ _id: occurrenceId, adultId });
    if (!occurrence) throw occurrenceNotFound();
    return serialize(occurrence, now);
  }

  return {
    materialize,
    materializeAll,
    removePendingFuture,
    reconcileMedication,
    reconcileAdult,
    sweep,
    findConfirmable,
    confirm,
    skip,
    list,
    get,
  };
}

export { HORIZON_HOURS, EARLY_CONFIRMATION_MINUTES };
