/**
 * Ruta inexistente -> 404 con el envoltorio estándar.
 *
 * El mensaje es genérico a propósito: no se refleja la ruta pedida en la respuesta.
 * El detalle queda en el log del servidor, que es donde hace falta para diagnosticar.
 */
import { notFound } from '../lib/errors.js';

export function notFoundHandler(req, _res, next) {
  req.log?.warn({ method: req.method }, 'Ruta inexistente');
  next(notFound());
}
