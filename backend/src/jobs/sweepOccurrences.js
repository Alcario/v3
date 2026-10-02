import cron from 'node-cron';
import { createOccurrenceService } from '../modules/occurrences/occurrence.service.js';

export function runSweepOccurrences({
  occurrenceService = createOccurrenceService(),
  now = new Date(),
} = {}) {
  return occurrenceService.sweep({ now });
}

export function startSweepOccurrencesJob({
  occurrenceService = createOccurrenceService(),
  logger,
} = {}) {
  const task = cron.schedule('*/10 * * * *', async () => {
    const startedAt = Date.now();
    try {
      const result = await runSweepOccurrences({ occurrenceService });
      logger?.info(
        { ...result, durationMs: Date.now() - startedAt },
        'Sweeper de ocurrencias completado',
      );
    } catch (error) {
      logger?.error(
        { err: { name: error.name, message: error.message } },
        'Fallo el sweeper de ocurrencias',
      );
    }
  });
  return task;
}
