/**
 * Servicio de salud. Único lugar donde se decide qué significa "vivo" y "listo".
 *
 *  - Liveness  (`/health`): el proceso responde. No mira dependencias.
 *  - Readiness (`/ready`) : las dependencias críticas responden de verdad.
 *
 * No devuelve versiones, rutas internas, URIs ni nombres de host: un healthcheck
 * es público y no tiene que contar nada del sistema.
 */
import { pingDb } from '../../config/db.js';

export function getLiveness() {
  return { status: 'ok' };
}

export async function getReadiness({ pingTimeoutMs = 2000 } = {}) {
  const dbUp = await pingDb({ timeoutMs: pingTimeoutMs });
  return {
    status: dbUp ? 'ok' : 'unavailable',
    checks: { db: dbUp ? 'up' : 'down' },
  };
}
