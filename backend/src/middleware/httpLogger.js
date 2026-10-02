/**
 * Log de acceso HTTP.
 *
 * Qué se loguea: requestId, método, path (sin query), status y duración.
 * Qué NO se loguea (SECURITY.md §8): el body, los headers sensibles y el query string
 * —que puede llevar identificadores o datos personales—.
 */
import pinoHttp from 'pino-http';
import { REQUEST_ID_HEADER } from './requestId.js';

/** Rutas que no generan log de acceso: el monitoreo las golpea cada pocos segundos. */
const SILENT_PATHS = new Set(['/health']);

export function createHttpLogger(logger) {
  return pinoHttp({
    logger,
    genReqId: (req) => req.id,
    autoLogging: {
      ignore: (req) => SILENT_PATHS.has(new URL(req.url, 'http://local').pathname),
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${res.statusCode}`,
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        // Solo el pathname: el query string queda fuera del log a propósito.
        path: new URL(req.url, 'http://local').pathname,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
      err: (err) => ({ type: err.name, message: err.message, code: err.code }),
    },
    customProps: (req) => ({ [REQUEST_ID_HEADER]: req.id }),
  });
}
