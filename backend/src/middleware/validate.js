/**
 * Validación de entrada con Zod en el borde (SECURITY.md §5).
 *
 * El resultado validado se deja en `req.validated` y NO se mezcla con `req.body`:
 * un controlador que lee `req.validated.body` no puede colarse datos sin validar,
 * y evita el `mass assignment` de campos que fija el servidor (amenaza T2).
 *
 * Los esquemas de body deben declararse con `.strict()` para que una propiedad
 * desconocida sea un 400 y no algo que se ignora en silencio.
 */
import { validationError } from '../lib/errors.js';
import { zodIssuesToDetails } from './error.js';

const SOURCES = ['params', 'query', 'body'];

/**
 * @param {{ params?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, body?: import('zod').ZodTypeAny }} schemas
 */
export function validate(schemas) {
  return function validateRequest(req, _res, next) {
    const validated = {};
    const details = [];

    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (result.success) {
        validated[source] = result.data;
      } else {
        // Se acumulan los problemas de las tres fuentes en una sola respuesta,
        // prefijando el origen para que el frontend sepa a qué campo apuntar.
        details.push(
          ...zodIssuesToDetails(result.error).map((detail) => ({
            ...detail,
            path: detail.path ? `${source}.${detail.path}` : source,
          })),
        );
      }
    }

    if (details.length > 0) return next(validationError(details));

    // Preserve values validated by an earlier middleware layer (for example params
    // validated before a route validates its body).
    req.validated = { ...req.validated, ...validated };
    return next();
  };
}
