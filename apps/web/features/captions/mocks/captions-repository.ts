import { captionsFixture } from "@/features/captions/fixtures/captions"
import type {
  Caption,
  CaptionDraft,
  CaptionFilters,
  CaptionMetrics,
} from "@/features/captions/types/captions"

const mockNow = "2026-08-02T09:00:00.000Z"

function cloneCaption(caption: Caption): Caption {
  return { ...caption, tags: [...caption.tags] }
}

export async function listCaptionsMock(): Promise<Caption[]> {
  return captionsFixture.map(cloneCaption)
}

export function filterCaptionsMock(
  captions: readonly Caption[],
  filters: CaptionFilters
): Caption[] {
  const query = filters.query.trim().toLocaleLowerCase("es")

  return captions.filter((caption) => {
    const matchesQuery =
      !query ||
      [caption.name, caption.content, caption.notes ?? "", ...caption.tags]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(query)
    const matchesSource =
      filters.sourceType === "all" || caption.sourceType === filters.sourceType
    const matchesStatus =
      filters.status === "all" || caption.status === filters.status

    return matchesQuery && matchesSource && matchesStatus
  })
}

export function getCaptionMetricsMock(
  captions: readonly Caption[]
): CaptionMetrics {
  return captions.reduce<CaptionMetrics>(
    (metrics, caption) => ({
      total: metrics.total + 1,
      ai: metrics.ai + (caption.sourceType === "ai" ? 1 : 0),
      manual: metrics.manual + (caption.sourceType === "manual" ? 1 : 0),
      active: metrics.active + (caption.status === "active" ? 1 : 0),
    }),
    { total: 0, ai: 0, manual: 0, active: 0 }
  )
}

export async function createCaptionMock(
  captions: readonly Caption[],
  draft: CaptionDraft
): Promise<Caption> {
  return {
    ...draft,
    id: `caption_mock_${captions.length + 1}`,
    tags: [...draft.tags],
    updatedAt: mockNow,
  }
}

export async function updateCaptionMock(
  caption: Caption,
  draft: CaptionDraft
): Promise<Caption> {
  return { ...caption, ...draft, tags: [...draft.tags], updatedAt: mockNow }
}

export async function deleteCaptionMock(id: string): Promise<string> {
  return id
}
