/**
 * Adaptador HTTP de auth: traduce y nada más (ARCHITECTURE.md §3).
 */
import { AuthFailure, AuthenticationError } from './auth.service.js';
import { clearRefreshCookie, setRefreshCookie, REFRESH_COOKIE_NAME } from '../../lib/cookies.js';
import { logSecurityEvent, SecurityEvent } from '../../lib/securityLog.js';

const REUSE_FAILURES = new Set([AuthFailure.REUSE_DETECTED]);

export function createAuthController({ authService, env, adultService }) {
  async function login(req, res, next) {
    const { email, password } = req.validated.body;
    try {
      const result = await authService.login({ email, password });
      setRefreshCookie(res, result.refreshToken, env);
      logSecurityEvent(req, SecurityEvent.LOGIN_SUCCESS, {
        userId: result.user.id,
        sessionId: result.sessionId,
      });
      res.status(200).json({
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user,
        },
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logSecurityEvent(req, SecurityEvent.LOGIN_FAILURE, { reason: error.failure });
      }
      next(error);
    }
  }

  async function refresh(req, res, next) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    try {
      const result = await authService.refresh({ refreshToken: token });
      setRefreshCookie(res, result.refreshToken, env);
      logSecurityEvent(req, SecurityEvent.REFRESH, {
        userId: result.userId,
        sessionId: result.sessionId,
      });
      res.status(200).json({
        data: { accessToken: result.accessToken, expiresIn: result.expiresIn },
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        clearRefreshCookie(res, env);
        logSecurityEvent(
          req,
          REUSE_FAILURES.has(error.failure)
            ? SecurityEvent.REFRESH_REUSE
            : SecurityEvent.REFRESH_REJECTED,
          { reason: error.failure },
        );
      }
      next(error);
    }
  }

  async function logout(req, res, next) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    try {
      const result = await authService.logout({ refreshToken: token });
      clearRefreshCookie(res, env);
      logSecurityEvent(req, SecurityEvent.LOGOUT, {
        userId: result.userId ?? undefined,
        sessionId: result.sessionId ?? undefined,
        revoked: result.revoked,
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  async function me(req, res, next) {
    try {
      const adults = adultService
        ? await adultService.listForUser({ userId: req.actor.userId })
        : [];
      res.status(200).json({
        data: {
          user: req.actor.user.toPublicJSON(),
          adults,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  return { login, refresh, logout, me };
}
