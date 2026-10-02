import { CaregiverAccess, CaregiverAccessStatus } from '../models/caregiverAccess.model.js';
import { AppError } from '../lib/errors.js';
import { logSecurityEvent, SecurityEvent } from '../lib/securityLog.js';

const inaccessible = () => new AppError('NOT_FOUND', 'El adulto solicitado no existe.');

/**
 * Comprueba el acceso actual contra MongoDB. El JWT solo identifica al actor y nunca
 * contiene la lista de adultos autorizados (SECURITY.md §4).
 */
export async function requireAdultAccess(req, _res, next) {
  const adultId = req.validated?.params?.adultId ?? req.params?.adultId;
  const userId = req.actor?.userId;

  if (!userId || !adultId) return next(inaccessible());

  try {
    const access = await CaregiverAccess.findOne({
      userId,
      adultId,
      status: CaregiverAccessStatus.ACTIVE,
    }).lean();

    if (!access) {
      logSecurityEvent(req, SecurityEvent.ACCESS_DENIED, {
        reason: 'ADULT_ACCESS_DENIED',
        userId,
        adultId,
      });
      return next(inaccessible());
    }

    req.adultAccess = {
      id: access._id.toString(),
      adultId: access.adultId.toString(),
      userId: access.userId.toString(),
      role: access.role,
      status: access.status,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...roles) {
  return function requireAdultRole(req, _res, next) {
    if (!req.adultAccess || !roles.includes(req.adultAccess.role)) {
      logSecurityEvent(req, SecurityEvent.ACCESS_DENIED, {
        reason: 'ADULT_ROLE_DENIED',
        userId: req.actor?.userId,
        adultId: req.adultAccess?.adultId ?? req.params?.adultId,
      });
      return next(new AppError('FORBIDDEN', 'No tenés permisos para esta operación.'));
    }
    return next();
  };
}
