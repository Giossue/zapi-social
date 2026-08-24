"use client"

/* eslint-disable react-hooks/refs -- `@dnd-kit` entrega su `ref` como un valor
   que hay que leer en el render para registrar el elemento arrastrable. El
   compilador de React lo cuenta como acceso a una referencia durante el
   render; es la forma que la librería documenta y no se arregla desde aquí. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { move } from "@dnd-kit/helpers"
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import { CollisionPriority } from "@dnd-kit/abstract"
import { useDroppable } from "@dnd-kit/react"
import { CalendarClock, CircleAlert, Images, Lock } from "lucide-react"

import { ApiError, boardsApi } from "@workspace/api-client"
import type { ContentBoardCard, ContentBoardColumn } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { useApiErrorMessage } from "@/lib/api-error-message"
import { loginPath } from "@/features/identity/login-redirect"

type ContentBoardState = Record<ContentBoardColumn, ContentBoardCard[]>

const columnOrder: readonly ContentBoardColumn[] = [
  "draft",
  "scheduled",
  "processing",
  "published",
  "failed",
]

const draggableColumns = ["draft", "scheduled"] as const

type DraggableColumn = (typeof draggableColumns)[number]

function isDraggable(column: ContentBoardColumn): column is DraggableColumn {
  return (draggableColumns as readonly ContentBoardColumn[]).includes(column)
}

const statusVariants: Record<
  ContentBoardColumn,
  "neutral" | "info" | "warning" | "success" | "destructive"
> = {
  draft: "neutral",
  scheduled: "info",
  processing: "warning",
  published: "success",
  failed: "destructive",
}

function emptyState(): ContentBoardState {
  return {
    draft: [],
    scheduled: [],
    processing: [],
    published: [],
    failed: [],
  }
}

function groupByStatus(cards: readonly ContentBoardCard[]) {
  const state = emptyState()
  for (const card of cards) state[card.status].push(card)
  return state
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

function ContentCard({ card }: { card: ContentBoardCard }) {
  const t = useTranslations("contentBoard")
  const format = useFormatter()

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-3 min-w-0 text-sm leading-5">
          {card.content || t("noContent")}
        </p>
        <Badge className="shrink-0" variant={statusVariants[card.status]}>
          {t(`status.${card.status}`)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="truncate">{card.accountName ?? t("noAccount")}</span>
        {card.mediaCount ? (
          <span className="flex items-center gap-1.5">
            <Images className="size-3.5" />
            {card.mediaCount}
          </span>
        ) : null}
        {card.scheduledAt ? (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5" />
            {format.dateTime(new Date(card.scheduledAt), "dateTime")}
          </span>
        ) : null}
      </div>
      {card.failureCode ? (
        <p className="text-sm text-destructive">
          {t("failureCode", { code: card.failureCode })}
        </p>
      ) : null}
    </article>
  )
}

function SortableContentCard({
  card,
  column,
  index,
}: {
  card: ContentBoardCard
  column: ContentBoardColumn
  index: number
}) {
  const { isDragging, ref } = useSortable({
    id: card.id,
    index,
    type: "card",
    accept: "card",
    group: column,
    disabled: !isDraggable(column),
    data: { type: "card", card },
  })

  return (
    <div className={cn("touch-none", isDragging && "opacity-30")} ref={ref}>
      <ContentCard card={card} />
    </div>
  )
}

function ContentColumn({
  cards,
  column,
}: {
  cards: readonly ContentBoardCard[]
  column: ContentBoardColumn
}) {
  const t = useTranslations("contentBoard")
  const dropTarget = useDroppable({
    id: column,
    type: "card-container",
    accept: "card",
    collisionPriority: CollisionPriority.Low,
    data: { type: "card-container", column },
  })
  const isLocked = !isDraggable(column)

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-t-xl border bg-muted/50 transition-colors",
        dropTarget.isDropTarget && !isLocked && "bg-muted/70"
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-1.5 truncate text-base leading-none font-medium">
            {t(`status.${column}`)}
            {isLocked ? (
              <Lock
                aria-label={t("lockedColumn")}
                className="size-3.5 text-muted-foreground"
              />
            ) : null}
          </h2>
          <p className="text-sm leading-none text-muted-foreground tabular-nums">
            {t("cardCount", { count: cards.length })}
          </p>
        </div>
      </div>
      <div
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
        ref={dropTarget.ref}
      >
        {cards.map((card, index) => (
          <SortableContentCard
            card={card}
            column={column}
            index={index}
            key={card.id}
          />
        ))}
        {cards.length ? null : (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {t("emptyColumn")}
          </p>
        )}
      </div>
    </section>
  )
}

export function ContentBoardPage() {
  const t = useTranslations("contentBoard")
  const router = useRouter()
  const apiErrorMessage = useApiErrorMessage()

  const [cards, setCards] = useState<ContentBoardCard[] | null>(null)
  const [state, setState] = useState<ContentBoardState>(emptyState)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const stateBeforeDrag = useRef<ContentBoardState>(emptyState())

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadFailed(false)
    try {
      const response = await boardsApi.contentBoard()
      setCards(response.cards)
      setState(groupByStatus(response.cards))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(loginPath())
        return
      }
      setLoadFailed(true)
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setIsLoading(false)
    }
  }, [apiErrorMessage, router])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  const total = useMemo(() => cards?.length ?? 0, [cards])

  async function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation
    if (!source || source.type !== "card") return
    if (event.canceled) {
      setState(stateBeforeDrag.current)
      return
    }

    const next = move(state, event)
    setState(next)

    const cardId = String(source.id)
    const status = columnOrder.find((column) =>
      next[column].some((card) => card.id === cardId)
    )
    if (!status || !isDraggable(status)) {
      setState(stateBeforeDrag.current)
      return
    }

    try {
      const response = await boardsApi.moveContentCard(cardId, { status })
      setCards(response.cards)
      setState(groupByStatus(response.cards))
      toast.success(t("statusChanged"))
    } catch (error) {
      setState(stateBeforeDrag.current)
      toast.error(apiErrorMessage(errorCode(error)))
    }
  }

  if (isLoading && !cards) return <PageLoading />

  if (loadFailed && !cards) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailed")}
      />
    )
  }

  return (
    <div
      className="flex h-[calc(100dvh-var(--dashboard-header-height))] min-h-0 min-w-0 flex-col overflow-hidden"
      data-content-padding="false"
    >
      <div className="flex shrink-0 flex-col gap-1 border-b px-4 py-3 lg:px-6">
        <h1 className="truncate text-lg font-semibold">{t("pageTitle")}</h1>
        <p className="truncate text-sm text-muted-foreground">
          {t("pageDescription", { count: total })}
        </p>
      </div>

      <DragDropProvider
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragOver={(event) => setState((current) => move(current, event))}
        onDragStart={() => {
          stateBeforeDrag.current = state
        }}
      >
        <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden bg-muted/25 px-4 pt-4 pb-0 [scrollbar-color:var(--border)_transparent] lg:px-5 lg:pt-5 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="inline-grid h-full min-w-full grid-cols-[repeat(5,minmax(18rem,1fr))] gap-4">
            {columnOrder.map((column) => (
              <ContentColumn
                cards={state[column]}
                column={column}
                key={column}
              />
            ))}
          </div>
        </div>
      </DragDropProvider>
    </div>
  )
}
