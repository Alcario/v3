/**
 * Contrato de errores de la API (API.md §2).
 *
 * Un solo envoltorio para todas las respuestas de error:
 *   { "error": { "code", "message", "details?", "requestId" } }
 *
 * `message` está en español y es apto para mostrarse al usuario. `details` solo
 * aparece en errores de validación. Nunca se expone un stack ni detalles internos.
 */

/** Códigos del contrato y su status HTTP. La tabla completa está en API.md §2. */
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
  PAYLOAD_TOO_LARGE: 413,
  BUSINESS_RULE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
});

/**
 * Error operacional conocido: su `message` se le muestra al cliente tal cual.
 * Todo lo que no sea un `AppError` se trata como fallo inesperado y se convierte
 * en `INTERNAL_ERROR` con mensaje genérico.
 */
export class AppError extends Error {
  /**
   * @param {keyof typeof ERROR_CODES} code
   * @param {string} message Mensaje en español, apto para el usuario final.
   * @param {{ details?: Array<{path: string, message: string}>, cause?: unknown, retryAfterSeconds?: number }} [options]
   */
  constructor(code, message, options = {}) {
    super(message);
    if (!(code in ERROR_CODES)) {
      throw new TypeError(`Código de error desconocido: ${code}`);
    }
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = ERROR_CODES[code];
    this.isOperational = true;
    if (options.details) this.details = options.details;
    if (options.cause !== undefined) this.cause = options.cause;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export const validationError = (details, message = 'Los datos enviados no son válidos.') =>
  new AppError('VALIDATION_ERROR', message, { details });

export const notFound = (message = 'La ruta solicitada no existe.') =>
  new AppError('NOT_FOUND', message);

export const payloadTooLarge = (message = 'El contenido enviado es demasiado grande.') =>
  new AppError('PAYLOAD_TOO_LARGE', message);

export const rateLimited = (retryAfterSeconds) =>
  new AppError('RATE_LIMITED', 'Demasiadas solicitudes. Probá de nuevo en un momento.', {
    retryAfterSeconds,
  });

export const internalError = (cause) =>
  new AppError(
    'INTERNAL_ERROR',
    'Hubo un problema de nuestro lado. Probá de nuevo en un momento.',
    {
      cause,
    },
  );
