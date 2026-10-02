import cron from 'node-cron';
import {
  createOccurrenceService,
  HORIZON_HOURS,
} from '../modules/occurrences/occurrence.service.js';

export function runMaterializeOccurrences({
  occurrenceService = createOccurrenceService(),
  now = new Date(),
} = {}) {
  return occurrenceService.materializeAll({ now, horizonHours: HORIZON_HOURS });
}

export function startMaterializeOccurrencesJob({
  occurrenceService = createOccurrenceService(),
  logger,
} = {}) {
  const task = cron.schedule('5 * * * *', async () => {
    const startedAt = Date.now();
    try {
      const result = await runMaterializeOccurrences({ occurrenceService });
      logger?.info(
        { ...result, durationMs: Date.now() - startedAt },
        'Materializacion de ocurrencias completada',
      );
    } catch (error) {
      logger?.error(
        { err: { name: error.name, message: error.message } },
        'Fallo la materializacion de ocurrencias',
      );
    }
  });
  return task;
}
