/**
 * Rutas de salud, sin versionar (decisión D025): `/health` y `/ready`.
 *
 * Quedan fuera de `/api/v1` porque no son parte del contrato de la API: las consume
 * el monitoreo y el reverse proxy, y no deben romperse al versionar la API.
 */
import { Router } from 'express';
import { liveness, readiness } from './health.controller.js';

export function createHealthRouter() {
  const router = Router();
  router.get('/health', liveness);
  router.get('/ready', readiness);
  return router;
}
