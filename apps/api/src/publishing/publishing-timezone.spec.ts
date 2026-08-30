import {
  formatPublishingDateTime,
  isFuturePublishingSchedule,
  publishingDisplayInstant,
} from './publishing-timezone';

describe('formatPublishingDateTime', () => {
  it('uses the user IANA timezone instead of UTC', () => {
    expect(
      formatPublishingDateTime(
        new Date('2026-08-24T18:00:52.601Z'),
        'America/Guayaquil',
      ),
    ).toEqual({ date: '2026-08-24', time: '13:00' });
  });

  it('moves the calendar date when the local timezone crosses midnight', () => {
    expect(
      formatPublishingDateTime(
        new Date('2026-08-24T02:30:00.000Z'),
        'America/Guayaquil',
      ),
    ).toEqual({ date: '2026-08-23', time: '21:30' });
  });

  it('falls back to UTC for an invalid legacy timezone', () => {
    expect(
      formatPublishingDateTime(
        new Date('2026-08-24T18:00:52.601Z'),
        'Invalid/Timezone',
      ),
    ).toEqual({ date: '2026-08-24', time: '18:00' });
  });
});

describe('publishingDisplayInstant', () => {
  const createdAt = new Date('2026-08-24T18:00:52.601Z');
  const publishedAt = new Date('2026-08-24T20:25:11.091Z');
  const scheduledAt = new Date('2026-08-24T19:30:00.000Z');

  it('shows the real completion time for a published post', () => {
    expect(
      publishingDisplayInstant({
        createdAt,
        publishedAt,
        scheduledAt,
        status: 'published',
      }),
    ).toBe(publishedAt);
  });

  it('keeps the scheduled time while a post is pending', () => {
    expect(
      publishingDisplayInstant({
        createdAt,
        publishedAt: null,
        scheduledAt,
        status: 'scheduled',
      }),
    ).toBe(scheduledAt);
  });
});

describe('isFuturePublishingSchedule', () => {
  const now = new Date('2026-08-30T15:30:00.000Z');

  it('allows only scheduled times that are after the current instant', () => {
    expect(
      isFuturePublishingSchedule(new Date('2026-08-30T15:45:00.000Z'), now),
    ).toBe(true);
    expect(isFuturePublishingSchedule(now, now)).toBe(false);
    expect(
      isFuturePublishingSchedule(new Date('2026-08-30T15:15:00.000Z'), now),
    ).toBe(false);
  });
});
