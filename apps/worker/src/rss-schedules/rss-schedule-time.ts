import type { PortalRssScheduleWeekday } from '@workspace/contracts';

type SchedulableRssSchedule = {
  endDate: string | null;
  startDate: string | null;
  timeSlots: string[];
  timezone: string;
  weekdays: string[];
};

const weekdayByIndex: PortalRssScheduleWeekday[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

type LocalDateParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
};

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function nextRssScheduleRun(
  schedule: SchedulableRssSchedule,
  reference: Date,
): Date | null {
  const enabledWeekdays = new Set(
    schedule.weekdays.filter((weekday): weekday is PortalRssScheduleWeekday =>
      weekdayByIndex.includes(weekday as PortalRssScheduleWeekday),
    ),
  );
  const slots = [...new Set(schedule.timeSlots)]
    .filter((slot) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot))
    .sort();
  if (!enabledWeekdays.size || !slots.length) return null;

  const localReference = localParts(reference, schedule.timezone);
  const firstDay = new Date(
    Date.UTC(localReference.year, localReference.month - 1, localReference.day),
  );
  for (let dayOffset = 0; dayOffset < 370; dayOffset += 1) {
    const localDay = new Date(firstDay);
    localDay.setUTCDate(localDay.getUTCDate() + dayOffset);
    const year = localDay.getUTCFullYear();
    const month = localDay.getUTCMonth() + 1;
    const day = localDay.getUTCDate();
    const dateKey = dateKeyFor(year, month, day);
    if (schedule.startDate && dateKey < schedule.startDate) continue;
    if (schedule.endDate && dateKey > schedule.endDate) return null;
    if (!enabledWeekdays.has(weekdayByIndex[localDay.getUTCDay()])) continue;

    for (const slot of slots) {
      const [hour, minute] = slot.split(':').map(Number);
      if (hour === undefined || minute === undefined) continue;
      const candidate = zonedDateTimeToUtc(
        { day, hour, minute, month, year },
        schedule.timezone,
      );
      if (candidate > reference) return candidate;
    }
  }
  return null;
}

export function dateKeyInTimezone(date: Date, timezone: string) {
  const local = localParts(date, timezone);
  return dateKeyFor(local.year, local.month, local.day);
}

function localParts(date: Date, timezone: string): LocalDateParts {
  const formatter = dateFormatter(timezone);
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return {
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    month: values.month ?? 1,
    year: values.year ?? 1970,
  };
}

function zonedDateTimeToUtc(parts: LocalDateParts, timezone: string) {
  const localTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  let timestamp = localTimestamp;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = timezoneOffset(new Date(timestamp), timezone);
    const nextTimestamp = localTimestamp - offset;
    if (nextTimestamp === timestamp) break;
    timestamp = nextTimestamp;
  }
  return new Date(timestamp);
}

function timezoneOffset(date: Date, timezone: string) {
  const local = localParts(date, timezone);
  return (
    Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) -
    date.getTime()
  );
}

function dateFormatter(timezone: string) {
  const cached = dateFormatterCache.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    calendar: 'iso8601',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  });
  dateFormatterCache.set(timezone, formatter);
  return formatter;
}

function dateKeyFor(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}
