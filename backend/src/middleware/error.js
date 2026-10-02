/**
 * Manejo centralizado de errores.
 *
 * Reglas (API.md §2, SECURITY.md T11):
 *  - Toda respuesta de error tiene la misma forma, con `requestId`.
 *  - Un error inesperado devuelve 500 con mensaje genérico: nunca stack, nunca
 *    detalle de Mongo, nunca el mensaje interno, en ningún entorno.
 *  - Los 5xx se loguean con el error completo; los 4xx, solo con su código.
 */
import { ZodError } from 'zod';
import { AppError, internalError, payloadTooLarge, validationError } from '../lib/errors.js';

/**
 * ZodError -> `details` del contrato: `[{ path, message }]` (API.md §2).
 *
 * Caso especial `unrecognized_keys`: Zod 4 reporta las claves desconocidas en
 * `issue.keys` y deja `path` apuntando al objeto, no al campo. Se expande a un detalle
 * por clave para que el frontend pueda señalar el campo que sobra.
 */
export function zodIssuesToDetails(error) {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
      return issue.keys.map((key) => ({
        path: [...issue.path, key].join('.'),
        message: 'propiedad no reconocida',
      }));
    }
    return [{ path: issue.path.join('.'), message: issue.message }];
  });
}

/** Traduce cualquier error a un AppError. */
function toAppError(err) {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return validationError(zodIssuesToDetails(err));
  }

  // Errores de `express.json()`
  if (err?.type === 'entity.too.large') {
    return payloadTooLarge();
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return validationError(
      [{ path: 'body', message: 'JSON inválido' }],
      'El cuerpo de la solicitud no es JSON válido.',
    );
  }

  return internalError(err);
}

export function createErrorHandler(logger) {
  // Express identifica el error handler por su aridad de 4 argumentos.
  return function errorHandler(err, req, res, _next) {
    const appError = toAppError(err);
    const log = req.log ?? logger;

    if (appError.httpStatus >= 500) {
      // El error original, con stack, va al log del servidor y a ningún otro lado.
      log?.error({ err: appError.cause ?? err, code: appError.code }, 'Error no controlado');
    } else {
      log?.warn({ code: appError.code, status: appError.httpStatus }, 'Solicitud rechazada');
    }

    if (appError.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(appError.retryAfterSeconds));
    }

    const body = {
      error: {
        code: appError.code,
        message: appError.message,
        requestId: req.id,
      },
    };
    if (appError.details) body.error.details = appError.details;

    res.status(appError.httpStatus).json(body);
  };
}
