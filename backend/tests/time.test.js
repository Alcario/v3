import { describe, expect, it } from 'vitest';
import { getLocalDateTime, localDateTimeToUtc, nextScheduledOccurrence } from '../src/lib/time.js';

describe('utilidades de tiempo de medicacion', () => {
  it('convierte horario local a UTC respetando DST', () => {
    const winter = localDateTimeToUtc({
      date: '2026-01-15',
      time: '09:00',
      timezone: 'America/New_York',
    });
    const summer = localDateTimeToUtc({
      date: '2026-07-15',
      time: '09:00',
      timezone: 'America/New_York',
    });

    expect(winter.toISOString()).toBe('2026-01-15T14:00:00.000Z');
    expect(summer.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('mantiene el mismo horario local para zonas distintas', () => {
    const buenosAires = localDateTimeToUtc({
      date: '2026-01-15',
      time: '09:00',
      timezone: 'America/Argentina/Buenos_Aires',
    });
    const madrid = localDateTimeToUtc({
      date: '2026-01-15',
      time: '09:00',
      timezone: 'Europe/Madrid',
    });

    expect(buenosAires.toISOString()).toBe('2026-01-15T12:00:00.000Z');
    expect(madrid.toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });

  it('calcula la fecha local alrededor de medianoche', () => {
    const local = getLocalDateTime({
      instant: new Date('2026-01-15T02:30:00.000Z'),
      timezone: 'America/Argentina/Buenos_Aires',
    });

    expect(local.toISODate()).toBe('2026-01-14');
    expect(local.toFormat('HH:mm')).toBe('23:30');
  });

  it('encuentra la proxima ocurrencia con domingo como dia 0', () => {
    const occurrence = nextScheduledOccurrence({
      schedule: {
        times: ['09:00'],
        daysOfWeek: [0],
        startDate: '2026-01-01',
        endDate: null,
      },
      timezone: 'America/Argentina/Buenos_Aires',
      now: new Date('2026-01-02T12:00:00.000Z'),
    });

    expect(occurrence).toMatchObject({
      localDate: '2026-01-04',
      localTime: '09:00',
      timezone: 'America/Argentina/Buenos_Aires',
    });
    expect(occurrence.at.toISOString()).toBe('2026-01-04T12:00:00.000Z');
  });
});
