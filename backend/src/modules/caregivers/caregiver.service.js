import { Adult } from '../../models/adult.model.js';
import {
  CaregiverAccess,
  CaregiverAccessStatus,
  CaregiverRole,
} from '../../models/caregiverAccess.model.js';
import { User, UserStatus, normalizeEmail } from '../../models/user.model.js';
import { AppError } from '../../lib/errors.js';
import { withTransaction } from '../../lib/transactions.js';
import { createActivityService } from '../activity/activity.service.js';

const accessNotFound = () => new AppError('NOT_FOUND', 'El cuidador solicitado no existe.');
const adultNotFound = () => new AppError('NOT_FOUND', 'El adulto solicitado no existe.');
const conflict = () => new AppError('CONFLICT', 'Ese usuario ya tiene acceso a este adulto.');
const lastOwner = () =>
  new AppError('BUSINESS_RULE', 'No se puede dejar al adulto sin un OWNER activo.');

function serializeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
  };
}

function serializeAccess(access, user = access.userId) {
  return {
    id: access._id.toString(),
    user: serializeUser(user),
    role: access.role,
    status: access.status,
    createdAt: access.createdAt,
    revokedAt: access.revokedAt,
  };
}

async function lockAdult(session, adultId) {
  // Esta escritura toma el write lock del adulto durante la transacción. Así dos
  // cambios concurrentes de OWNER no pueden observar el mismo conteo y dejar cero.
  const adult = await Adult.findOneAndUpdate(
    { _id: adultId, deletedAt: null },
    { $set: { updatedAt: new Date() } },
    { new: true, session },
  );
  if (!adult) throw adultNotFound();
  return adult;
}

export function createCaregiverService() {
  const activityService = createActivityService();

  async function list({ adultId }) {
    const accesses = await CaregiverAccess.find({
      adultId,
      status: CaregiverAccessStatus.ACTIVE,
    })
      .populate({ path: 'userId', select: 'email firstName lastName status' })
      .sort({ createdAt: 1 });

    return {
      data: accesses.map((access) => serializeAccess(access)),
      meta: { total: accesses.length },
    };
  }

  async function grant({ adultId, actor, email, role }) {
    const result = await withTransaction(async (session) => {
      await lockAdult(session, adultId);
      const user = await User.findOne({
        email: normalizeEmail(email),
        status: UserStatus.ACTIVE,
      }).session(session);
      if (!user) throw accessNotFound();

      const existing = await CaregiverAccess.findOne({
        userId: user._id,
        adultId,
      }).session(session);

      if (existing?.status === CaregiverAccessStatus.ACTIVE) throw conflict();

      let access;
      if (existing) {
        access = await CaregiverAccess.findOneAndUpdate(
          { _id: existing._id, status: CaregiverAccessStatus.REVOKED },
          {
            $set: {
              role,
              status: CaregiverAccessStatus.ACTIVE,
              grantedByUserId: actor.userId,
              revokedAt: null,
            },
          },
          { new: true, session },
        );
      } else {
        [access] = await CaregiverAccess.create(
          [
            {
              userId: user._id,
              adultId,
              role,
              status: CaregiverAccessStatus.ACTIVE,
              grantedByUserId: actor.userId,
              revokedAt: null,
            },
          ],
          { session },
        );
      }

      await activityService.record(
        {
          adultId,
          type: 'CAREGIVER_GRANTED',
          actorUserId: actor.userId,
          summary: 'Acceso de cuidador otorgado',
          payload: { caregiverUserId: user._id.toString(), role },
        },
        { session },
      );
      return { access, user };
    });

    return serializeAccess(result.access, result.user);
  }

  async function changeRole({ adultId, accessId, actor, role }) {
    const result = await withTransaction(async (session) => {
      await lockAdult(session, adultId);
      const access = await CaregiverAccess.findOne({
        _id: accessId,
        adultId,
        status: CaregiverAccessStatus.ACTIVE,
      }).session(session);
      if (!access) throw accessNotFound();
      if (access.role === role) return { access, changed: false };

      if (access.role === CaregiverRole.OWNER && role === CaregiverRole.CAREGIVER) {
        const ownerCount = await CaregiverAccess.countDocuments({
          adultId,
          role: CaregiverRole.OWNER,
          status: CaregiverAccessStatus.ACTIVE,
        }).session(session);
        if (ownerCount <= 1) throw lastOwner();
      }

      access.role = role;
      await access.save({ session });
      await activityService.record(
        {
          adultId,
          type: 'CAREGIVER_ROLE_CHANGED',
          actorUserId: actor.userId,
          summary: 'Rol de cuidador actualizado',
          payload: { caregiverUserId: access.userId.toString(), role },
        },
        { session },
      );
      return { access, changed: true };
    });

    const access = await CaregiverAccess.findById(result.access._id).populate({
      path: 'userId',
      select: 'email firstName lastName status',
    });
    return serializeAccess(access);
  }

  async function revoke({ adultId, accessId, actor }) {
    const result = await withTransaction(async (session) => {
      await lockAdult(session, adultId);
      const access = await CaregiverAccess.findOne({
        _id: accessId,
        adultId,
        status: CaregiverAccessStatus.ACTIVE,
      }).session(session);
      if (!access) throw accessNotFound();

      if (access.role === CaregiverRole.OWNER) {
        const ownerCount = await CaregiverAccess.countDocuments({
          adultId,
          role: CaregiverRole.OWNER,
          status: CaregiverAccessStatus.ACTIVE,
        }).session(session);
        if (ownerCount <= 1) throw lastOwner();
      }

      access.status = CaregiverAccessStatus.REVOKED;
      access.revokedAt = new Date();
      await access.save({ session });
      await activityService.record(
        {
          adultId,
          type: 'CAREGIVER_REVOKED',
          actorUserId: actor.userId,
          summary: 'Acceso de cuidador revocado',
          payload: { caregiverUserId: access.userId.toString() },
        },
        { session },
      );
      return access;
    });

    return { id: result._id.toString(), status: result.status, revokedAt: result.revokedAt };
  }

  return { list, grant, changeRole, revoke };
}
