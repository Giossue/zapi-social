import { nextRssScheduleRun } from './rss-schedule-time';

describe('nextRssScheduleRun', () => {
  const baseSchedule = {
    endDate: null,
    startDate: null,
    timeSlots: ['09:00'],
    timezone: 'America/Guayaquil',
    weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  };

  it('uses the persisted schedule timezone instead of the worker timezone', () => {
    const next = nextRssScheduleRun(
      baseSchedule,
      new Date('2026-08-05T13:00:00.000Z'),
    );

    expect(next?.toISOString()).toBe('2026-08-05T14:00:00.000Z');
  });

  it('moves to the next enabled weekday', () => {
    const next = nextRssScheduleRun(
      { ...baseSchedule, weekdays: ['mon'] },
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(next?.toISOString()).toBe('2026-08-10T14:00:00.000Z');
  });

  it('does not return a slot after the configured end date', () => {
    const next = nextRssScheduleRun(
      { ...baseSchedule, endDate: '2026-08-05', weekdays: ['mon'] },
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(next).toBeNull();
  });
});
