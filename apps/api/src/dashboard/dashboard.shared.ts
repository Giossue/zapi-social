export const DASHBOARD_WINDOW_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function windowStarts(): { currentStart: Date; previousStart: Date } {
  const today = startOfUtcDay(new Date());
  const currentStart = new Date(
    today.getTime() - (DASHBOARD_WINDOW_DAYS - 1) * DAY_MS,
  );
  const previousStart = new Date(
    currentStart.getTime() - DASHBOARD_WINDOW_DAYS * DAY_MS,
  );
  return { currentStart, previousStart };
}

export function dayKeys(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10),
  );
}

export function buildDayCounts(
  counts: Map<string, number>,
  keys: string[],
): { date: string; count: number }[] {
  return keys.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export function buildComparisonSeries(
  counts: Map<string, number>,
  currentStart: Date,
  previousStart: Date,
): { date: string; current: number; previous: number }[] {
  const currentKeys = dayKeys(currentStart, DASHBOARD_WINDOW_DAYS);
  const previousKeys = dayKeys(previousStart, DASHBOARD_WINDOW_DAYS);
  return currentKeys.map((date, index) => ({
    date,
    current: counts.get(date) ?? 0,
    previous: counts.get(previousKeys[index] ?? '') ?? 0,
  }));
}

export function buildKpiChange(
  current: number,
  previous: number,
): { direction: 'up' | 'down'; label: string } | null {
  if (previous <= 0 || current === previous) return null;
  const percent = ((current - previous) / previous) * 100;
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0) return null;
  return {
    direction: rounded > 0 ? 'up' : 'down',
    label: `${rounded > 0 ? '+' : ''}${rounded}%`,
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  'whatsapp-status': 'WhatsApp Status',
  x: 'X',
};

export function providerLabel(providerKey: string | null): string {
  if (!providerKey) return 'Sin canal';
  const label = PROVIDER_LABELS[providerKey];
  if (label) return label;
  return providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
}

const AI_KIND_LABELS: Record<string, string> = {
  ai_publishing: 'AI Publishing',
  content: 'Contenido',
  image: 'Imagen',
  planner: 'Planner',
  repurpose: 'Repurpose',
  review: 'Revisión',
  search: 'Búsqueda',
  timing: 'Timing',
  video: 'Vídeo',
};

export function aiKindLabel(kind: string): string {
  return AI_KIND_LABELS[kind] ?? kind;
}
