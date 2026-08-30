const publishingDateTimeOptions: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

export function formatPublishingDateTime(value: Date, timeZone: string) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      ...publishingDateTimeOptions,
      timeZone,
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      ...publishingDateTimeOptions,
      timeZone: 'UTC',
    });
  }

  const parts = new Map(
    formatter
      .formatToParts(value)
      .map((part) => [part.type, part.value] as const),
  );
  const year = parts.get('year');
  const month = parts.get('month');
  const day = parts.get('day');
  const hour = parts.get('hour');
  const minute = parts.get('minute');

  if (!year || !month || !day || !hour || !minute) {
    throw new Error('Unable to format publishing date and time.');
  }

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  };
}

export function publishingDisplayInstant(input: {
  createdAt: Date;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  status: string;
}) {
  if (input.status === 'published' && input.publishedAt) {
    return input.publishedAt;
  }
  return input.scheduledAt ?? input.createdAt;
}

export function isFuturePublishingSchedule(
  scheduledAt: Date,
  now = new Date(),
) {
  return scheduledAt.valueOf() > now.valueOf();
}
