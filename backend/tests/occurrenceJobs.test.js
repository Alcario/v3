import { describe, expect, it, vi } from 'vitest';
import { runMaterializeOccurrences } from '../src/jobs/materializeOccurrences.js';
import { runSweepOccurrences } from '../src/jobs/sweepOccurrences.js';

describe('jobs de ocurrencias', () => {
  it('invoca el materializador con el horizonte aprobado de 48 horas', async () => {
    const occurrenceService = { materializeAll: vi.fn().mockResolvedValue({ createdCount: 2 }) };
    const now = new Date('2026-10-02T11:00:00.000Z');

    await runMaterializeOccurrences({ occurrenceService, now });

    expect(occurrenceService.materializeAll).toHaveBeenCalledWith({
      now,
      horizonHours: 48,
    });
  });

  it('invoca el sweeper con el reloj inyectado', async () => {
    const occurrenceService = { sweep: vi.fn().mockResolvedValue({ missedCount: 1 }) };
    const now = new Date('2026-10-02T15:00:00.000Z');

    await runSweepOccurrences({ occurrenceService, now });

    expect(occurrenceService.sweep).toHaveBeenCalledWith({ now });
  });
});
