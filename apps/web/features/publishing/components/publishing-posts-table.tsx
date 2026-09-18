"use client"

import { type MouseEvent, useMemo, useState } from "react"
import { FilePenLine, RotateCcw, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { useFormatter, useTranslations } from "next-intl"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { TableResetFiltersButton } from "@/components/table-reset-filters-button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  TABLE_EMPTY_ICON,
  TableEmptyRow,
} from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@/components/table-pagination"
import { Spinner } from "@workspace/ui/components/spinner"
import type {
  PublishingPost,
  PublishingProvider,
  PublishingStatus,
} from "@/features/publishing/types/publishing-calendar"

const PAGE_SIZE = 10

const providerLabels: Record<PublishingProvider, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
}

const statusVariants: Record<
  PublishingStatus,
  "neutral" | "success" | "warning" | "destructive"
> = {
  draft: "neutral",
  failed: "destructive",
  processing: "warning",
  published: "success",
  scheduled: "neutral",
}

function PostActions({
  onContinue,
  onDelete,
  onRetry,
  post,
}: {
  onContinue?: (post: PublishingPost) => void
  onDelete?: (post: PublishingPost) => boolean | void | Promise<boolean | void>
  onRetry?: (post: PublishingPost) => void
  post: PublishingPost
}) {
  const t = useTranslations("publishing.table")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)

  async function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (!onDelete || deletePending) return

    setDeletePending(true)
    try {
      const deleted = await onDelete(post)
      if (deleted !== false) setDeleteOpen(false)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {post.status === "draft" && onContinue ? (
        <Button
          onClick={() => onContinue(post)}
          size="sm"
          type="button"
          variant="brand-secondary"
        >
          <FilePenLine data-icon="inline-start" />
          {t("edit")}
        </Button>
      ) : null}
      {post.status === "failed" && post.recoverable && onRetry ? (
        <Button onClick={() => onRetry(post)} size="sm" type="button">
          <RotateCcw data-icon="inline-start" />
          {t("retry")}
        </Button>
      ) : null}
      {post.status === "draft" && onDelete ? (
        <AlertDialog
          onOpenChange={(nextOpen) => !deletePending && setDeleteOpen(nextOpen)}
          open={deleteOpen}
        >
          <AlertDialogTrigger asChild>
            <Button
              aria-label={t("deleteLabel", { title: post.title })}
              size="icon-sm"
              type="button"
              variant="brand-secondary"
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteDescription", { title: post.title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deletePending}
                variant="brand-secondary"
              >
                {t("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deletePending}
                onClick={confirmDelete}
                type="button"
                variant="destructive"
              >
                {deletePending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Trash2 data-icon="inline-start" />
                )}
                {deletePending ? t("deleting") : t("deleteAction")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  )
}

export function PublishingPostsTable({
  onContinue,
  onDelete,
  onRetry,
  posts,
}: {
  onContinue?: (post: PublishingPost) => void
  onDelete?: (post: PublishingPost) => boolean | void | Promise<boolean | void>
  onRetry?: (post: PublishingPost) => void
  posts: PublishingPost[]
}) {
  const t = useTranslations("publishing.table")
  const format = useFormatter()
  const [query, setQuery] = useState("")
  const [provider, setProvider] = useState<PublishingProvider | "all">("all")
  const [status, setStatus] = useState<PublishingStatus | "all">("all")
  const [page, setPage] = useState(1)
  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es")
    return posts.filter((post) => {
      const matchesQuery =
        !normalized ||
        `${post.title} ${post.channel}`
          .toLocaleLowerCase("es")
          .includes(normalized)
      return (
        matchesQuery &&
        (provider === "all" || post.provider === provider) &&
        (status === "all" || post.status === status)
      )
    })
  }, [posts, provider, query, status])
  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagePosts = filteredPosts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )
  const hasFilters = Boolean(query || provider !== "all" || status !== "all")
  const emptyProps = hasFilters
    ? {
        description: t("empty.filtered.description"),
        icon: TABLE_EMPTY_ICON,
        title: t("empty.filtered.title"),
      }
    : {
        description: t("empty.activity.description"),
        icon: TABLE_EMPTY_ICON,
        title: t("empty.activity.title"),
      }
  const pageRangeStart = filteredPosts.length
    ? (currentPage - 1) * PAGE_SIZE + 1
    : 0
  const pageRangeEnd = Math.min(currentPage * PAGE_SIZE, filteredPosts.length)

  function clearFilters() {
    setQuery("")
    setProvider("all")
    setStatus("all")
    setPage(1)
  }

  return (
    <Card variant="subtle">
      <DataTableHeader
        filters={
          <DataTableToolbar className="px-0">
            <DataTableFilter
              ariaLabel={t("filterProviderLabel")}
              label={t("provider")}
              onValueChange={(value) => {
                setProvider(value as PublishingProvider | "all")
                setPage(1)
              }}
              options={[
                { label: t("allProviders"), value: "all" },
                { label: providerLabels.facebook, value: "facebook" },
                { label: providerLabels.instagram, value: "instagram" },
                { label: providerLabels.whatsapp, value: "whatsapp" },
              ]}
              value={provider}
            />
            <DataTableFilter
              ariaLabel={t("filterStatusLabel")}
              label={t("status")}
              onValueChange={(value) => {
                setStatus(value as PublishingStatus | "all")
                setPage(1)
              }}
              options={[
                { label: t("allStatuses"), value: "all" },
                { label: t("statusLabel.draft"), value: "draft" },
                { label: t("statusLabel.scheduled"), value: "scheduled" },
                { label: t("statusLabel.processing"), value: "processing" },
                { label: t("statusLabel.failed"), value: "failed" },
                { label: t("statusLabel.published"), value: "published" },
              ]}
              value={status}
            />
          </DataTableToolbar>
        }
        search={{
          ariaLabel: t("searchLabel"),
          onChange: (value) => {
            setQuery(value)
            setPage(1)
          },
          placeholder: t("searchLabel"),
          value: query,
        }}
      />
      <CardContent className="flex flex-col gap-4 px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">{t("post")}</TableHead>
              <TableHead className="hidden md:table-cell">
                {t("account")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("date")}
              </TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="pr-4 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagePosts.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="max-w-72 pl-4">
                  <p className="truncate font-medium">
                    {post.title || t("untitled")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {post.hasMedia ? t("withMedia") : t("textOnly")}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <p className="max-w-48 truncate">{post.channel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {providerLabels[post.provider]}
                  </p>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                  {format.dateTime(new Date(`${post.date}T12:00:00Z`), {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}{" "}
                  · {post.time === "now" ? t("now") : post.time}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariants[post.status]}>
                    {t(`statusLabel.${post.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="inline-flex">
                    <PostActions
                      onContinue={onContinue}
                      onDelete={onDelete}
                      onRetry={onRetry}
                      post={post}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {pagePosts.length === 0 ? (
              <TableEmptyRow
                action={
                  hasFilters ? (
                    <TableResetFiltersButton onClickAction={clearFilters} />
                  ) : undefined
                }
                colSpan={5}
                {...emptyProps}
              />
            ) : null}
          </TableBody>
        </Table>

        <TablePagination
          canGoNext={currentPage < pageCount}
          canGoPrevious={currentPage > 1}
          itemLabel={t("itemLabel")}
          onNextPage={() => setPage((value) => value + 1)}
          onPreviousPage={() => setPage((value) => value - 1)}
          rangeEnd={pageRangeEnd}
          rangeStart={pageRangeStart}
          total={filteredPosts.length}
        />
      </CardContent>
    </Card>
  )
}
