/**
 * Adaptador HTTP del módulo de salud: traduce, no decide.
 *
 * Los healthchecks son la única excepción documentada al envoltorio `{ data }` /
 * `{ error }` de la API (decisión D025): son infraestructura, no recursos, y los
 * consume un monitor externo que espera un documento de estado plano.
 */
import { getLiveness, getReadiness } from './health.service.js';

export function liveness(_req, res) {
  res.status(200).json(getLiveness());
}

export async function readiness(_req, res, next) {
  try {
    const result = await getReadiness();
    res.status(result.status === 'ok' ? 200 : 503).json(result);
  } catch (error) {
    next(error);
  }
}
