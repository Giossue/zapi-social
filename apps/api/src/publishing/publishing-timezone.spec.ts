import { formatPublishingDateTime } from './publishing-timezone';

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
