import { DateTime, IANAZone } from 'luxon';

export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export function isValidTimezone(value) {
  return typeof value === 'string' && IANAZone.isValidZone(value);
}

export function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function dateOnlyToDate(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function dateToDateOnly(value) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function isValidTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function localDateTimeToUtc({ date, time, timezone }) {
  if (!isValidDateOnly(date) || !isValidTime(time) || !isValidTimezone(timezone)) return null;
  const local = DateTime.fromISO(`${date}T${time}`, { zone: timezone, setZone: true });
  return local.isValid ? local.toUTC().toJSDate() : null;
}

export function getLocalDateTime({ instant = new Date(), timezone }) {
  if (!isValidTimezone(timezone)) return null;
  return DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(timezone);
}

export function nextScheduledOccurrence({ schedule, timezone, now = new Date() }) {
  if (!schedule || !isValidTimezone(timezone)) return null;
  const nowUtc = DateTime.fromJSDate(now, { zone: 'utc' });
  const localNow = nowUtc.setZone(timezone);
  let cursor = DateTime.fromISO(schedule.startDate, { zone: timezone }).startOf('day');
  if (!cursor.isValid) return null;
  if (cursor < localNow.startOf('day')) cursor = localNow.startOf('day');

  const days = new Set(schedule.daysOfWeek);
  const times = [...schedule.times].sort();
  for (let offset = 0; offset <= 370; offset += 1) {
    const date = cursor.plus({ days: offset }).startOf('day');
    const dateOnly = date.toISODate();
    if (!dateOnly) return null;
    if (schedule.endDate && dateOnly > schedule.endDate) return null;

    // Luxon uses Monday=1 ... Sunday=7; Chatio uses Sunday=0 ... Saturday=6.
    const dayOfWeek = date.weekday % 7;
    if (!days.has(dayOfWeek)) continue;

    for (const time of times) {
      const candidate = DateTime.fromISO(`${dateOnly}T${time}`, {
        zone: timezone,
        setZone: true,
      });
      if (candidate.isValid && candidate.toUTC() >= nowUtc) {
        return {
          at: candidate.toUTC().toJSDate(),
          localDate: dateOnly,
          localTime: time,
          timezone,
        };
      }
    }
  }
  return null;
}

/**
 * Enumerates concrete instants for a wall-clock schedule in a bounded interval.
 * The returned local fields are kept alongside UTC so callers never need to
 * reinterpret a historical occurrence after a timezone change.
 */
export function scheduledOccurrencesBetween({ schedule, timezone, from, to }) {
  if (!schedule || !isValidTimezone(timezone) || !(from instanceof Date) || !(to instanceof Date)) {
    return [];
  }
  if (from >= to || !isValidDateOnly(schedule.startDate)) return [];

  const fromUtc = DateTime.fromJSDate(from, { zone: 'utc' });
  const toUtc = DateTime.fromJSDate(to, { zone: 'utc' });
  let cursor = fromUtc.setZone(timezone).startOf('day');
  const lastLocalDate = toUtc.setZone(timezone).startOf('day');
  const days = new Set(schedule.daysOfWeek);
  const times = [...schedule.times].sort();
  const occurrences = [];

  for (let offset = 0; offset <= 370 && cursor <= lastLocalDate; offset += 1) {
    const dateOnly = cursor.toISODate();
    if (!dateOnly) break;
    if (dateOnly >= schedule.startDate && (!schedule.endDate || dateOnly <= schedule.endDate)) {
      const dayOfWeek = cursor.weekday % 7;
      if (days.has(dayOfWeek)) {
        for (const time of times) {
          const candidate = DateTime.fromISO(`${dateOnly}T${time}`, {
            zone: timezone,
            setZone: true,
          });
          if (candidate.isValid && candidate.toUTC() >= fromUtc && candidate.toUTC() < toUtc) {
            occurrences.push({
              at: candidate.toUTC().toJSDate(),
              localDate: dateOnly,
              localTime: time,
              timezone,
            });
          }
        }
      }
    }
    cursor = cursor.plus({ days: 1 });
  }

  return occurrences;
}
