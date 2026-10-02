import { Adult, AdultStatus } from '../../models/adult.model.js';
import { CaregiverAccess, CaregiverAccessStatus } from '../../models/caregiverAccess.model.js';
import { AppError } from '../../lib/errors.js';
import { dateOnlyToDate } from '../../lib/time.js';
import { withTransaction } from '../../lib/transactions.js';
import { createActivityService } from '../activity/activity.service.js';
import { createOccurrenceService } from '../occurrences/occurrence.service.js';

const notFound = () => new AppError('NOT_FOUND', 'El adulto solicitado no existe.');

function serializeAdult(adult) {
  return adult.toPublicJSON();
}

function serializeSummary(adult, role) {
  return {
    id: adult._id.toString(),
    firstName: adult.firstName,
    lastName: adult.lastName,
    birthDate: adult.birthDate ? adult.birthDate.toISOString().slice(0, 10) : null,
    timezone: adult.timezone,
    status: adult.status,
    role,
    // AlexaLink and HelpRequest are introduced in later iterations.
    hasAlexaLink: false,
    openHelpRequests: 0,
  };
}

function buildAdultFields(input, actorUserId) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate: dateOnlyToDate(input.birthDate),
    timezone: input.timezone,
    notes: input.notes ?? null,
    contacts: input.contacts,
    createdByUserId: actorUserId,
    consentRecordedAt: new Date(),
    consentRecordedByUserId: actorUserId,
    consentStatementVersion: 'v1',
    status: AdultStatus.ACTIVE,
    deletedAt: null,
  };
}

export function createAdultService({ occurrenceService = createOccurrenceService() } = {}) {
  const activityService = createActivityService();

  async function create({ actor, input }) {
    try {
      const result = await withTransaction(async (session) => {
        const [adult] = await Adult.create([buildAdultFields(input, actor.userId)], { session });
        const [access] = await CaregiverAccess.create(
          [
            {
              userId: actor.userId,
              adultId: adult._id,
              role: 'OWNER',
              status: CaregiverAccessStatus.ACTIVE,
              grantedByUserId: actor.userId,
              revokedAt: null,
            },
          ],
          { session },
        );
        return { adult, access };
      });
      return serializeAdult(result.adult);
    } catch (error) {
      if (error?.code === 11000) {
        throw new AppError(
          'CONFLICT',
          'No se pudo crear el adulto porque ya existe un acceso igual.',
        );
      }
      throw error;
    }
  }

  async function listForUser({ userId }) {
    const accesses = await CaregiverAccess.find({
      userId,
      status: CaregiverAccessStatus.ACTIVE,
    })
      .populate({ path: 'adultId', match: { deletedAt: null } })
      .sort({ createdAt: 1 })
      .lean();

    const adults = accesses
      .filter((access) => access.adultId)
      .map((access) => serializeSummary(access.adultId, access.role));

    return adults;
  }

  async function list({ userId }) {
    const adults = await listForUser({ userId });
    return { data: adults, meta: { total: adults.length } };
  }

  async function get({ adultId }) {
    const adult = await Adult.findOne({ _id: adultId, deletedAt: null });
    if (!adult) throw notFound();
    return serializeAdult(adult);
  }

  function buildUpdates(input) {
    const updates = {};
    if (input.firstName !== undefined) updates.firstName = input.firstName;
    if (input.lastName !== undefined) updates.lastName = input.lastName;
    if (input.birthDate !== undefined) updates.birthDate = dateOnlyToDate(input.birthDate);
    if (input.timezone !== undefined) updates.timezone = input.timezone;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.contacts !== undefined) updates.contacts = input.contacts;
    return updates;
  }

  async function update({ adultId, actor, input }) {
    const result = await withTransaction(async (session) => {
      const adult = await Adult.findOneAndUpdate(
        { _id: adultId, deletedAt: null },
        { $set: buildUpdates(input) },
        { new: true, runValidators: true, session },
      );
      if (!adult) throw notFound();

      await activityService.record(
        {
          adultId,
          type: 'ADULT_UPDATED',
          actorUserId: actor.userId,
          summary: 'Datos del adulto actualizados',
          payload: { fields: Object.keys(input) },
        },
        { session },
      );
      return adult;
    });
    if (input.timezone !== undefined) {
      await occurrenceService.reconcileAdult({ adultId });
    }
    return serializeAdult(result);
  }

  async function setStatus({ adultId, actor, status }) {
    const result = await withTransaction(async (session) => {
      const adult = await Adult.findOneAndUpdate(
        { _id: adultId, deletedAt: null },
        { $set: { status } },
        { new: true, runValidators: true, session },
      );
      if (!adult) throw notFound();

      await activityService.record(
        {
          adultId,
          type: 'ADULT_UPDATED',
          actorUserId: actor.userId,
          summary: status === AdultStatus.ACTIVE ? 'Adulto activado' : 'Adulto desactivado',
          payload: { status },
        },
        { session },
      );
      return adult;
    });
    await occurrenceService.reconcileAdult({ adultId });
    return serializeAdult(result);
  }

  return { create, list, listForUser, get, update, setStatus, occurrenceService };
}
