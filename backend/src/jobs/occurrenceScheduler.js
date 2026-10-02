import { createOccurrenceService } from '../modules/occurrences/occurrence.service.js';
import {
  runMaterializeOccurrences,
  startMaterializeOccurrencesJob,
} from './materializeOccurrences.js';
import { startSweepOccurrencesJob } from './sweepOccurrences.js';

export async function startOccurrenceScheduler({ logger } = {}) {
  const occurrenceService = createOccurrenceService();
  const materializer = startMaterializeOccurrencesJob({ occurrenceService, logger });
  const sweeper = startSweepOccurrencesJob({ occurrenceService, logger });
  try {
    const result = await runMaterializeOccurrences({ occurrenceService });
    logger?.info(result, 'Materializacion inicial de ocurrencias completada');
  } catch (error) {
    logger?.error(
      { err: { name: error.name, message: error.message } },
      'Fallo la materializacion inicial de ocurrencias',
    );
  }
  return {
    stop() {
      materializer.stop();
      sweeper.stop();
    },
  };
}
