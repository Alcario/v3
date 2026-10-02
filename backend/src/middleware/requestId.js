/**
 * Identificador de correlación por request.
 *
 * Se reutiliza el `x-request-id` entrante (útil detrás de Nginx) solo si tiene un
 * formato seguro: un valor arbitrario del cliente terminaría en los logs, y eso
 * habilita inyección en el log.
 */
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function requestId(req, res, next) {
  const incoming = req.get(REQUEST_ID_HEADER);
  req.id = REQUEST_ID_PATTERN.test(incoming ?? '') ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
}
