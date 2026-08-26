"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  CircleAlert,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react"

import { ApiError, adminSettingsApi } from "@workspace/api-client"
import type { AdminStaticPage } from "@workspace/contracts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"

import { MarkdownEditor } from "@/components/markdown-editor"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@/components/table-pagination"
import { toast } from "@workspace/ui/components/toast"
import { loginPath } from "@/features/identity/login-redirect"

const pageSize = 10

type PublicationFilter = "all" | "published" | "draft"

const emptyPage: AdminStaticPage = {
  slug: "",
  title: "",
  content: "",
  isPublished: false,
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

export function StaticPagesSettingsPage() {
  const t = useTranslations("staticPages")
  const router = useRouter()
  const [pages, setPages] = useState<AdminStaticPage[] | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<PublicationFilter>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [draft, setDraft] = useState<AdminStaticPage>(emptyPage)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AdminStaticPage | null>(null)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return true
      }
      return false
    },
    [router]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await adminSettingsApi.staticPages()
      setPages(response.pages)
      setForbidden(false)
    } catch (error) {
      if (handleError(error)) return
      console.error("Static pages request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  async function persist(next: AdminStaticPage[]) {
    setPending(true)
    try {
      const response = await adminSettingsApi.saveStaticPages({ pages: next })
      setPages(response.pages)
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Static pages save failed", error)
      toast.error(t("saveFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pages) return
    const slug = draft.slug.trim() || slugify(draft.title)
    if (!draft.title.trim() || !slug) {
      toast.error(t("titleRequired"))
      return
    }
    const entry = { ...draft, slug }
    const collides = pages.some(
      (page) => page.slug === slug && page.slug !== editingSlug
    )
    if (collides) {
      toast.error(t("slugTaken"))
      return
    }
    const next = editingSlug
      ? pages.map((page) => (page.slug === editingSlug ? entry : page))
      : [...pages, entry]
    if (await persist(next)) {
      setIsSheetOpen(false)
      toast.success(editingSlug ? t("updated") : t("created"))
    }
  }

  async function remove(page: AdminStaticPage) {
    if (!pages) return
    if (await persist(pages.filter((item) => item.slug !== page.slug))) {
      setToDelete(null)
      toast.success(t("deleted"))
    }
  }

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={ShieldCheck}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !pages) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError || !pages) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void load()}
                variant="brand-secondary"
              />
            }
            description={t("loadFailed")}
            icon={CircleAlert}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredPages = pages.filter((page) => {
    const matchesQuery =
      !normalizedQuery ||
      page.title.toLowerCase().includes(normalizedQuery) ||
      page.slug.toLowerCase().includes(normalizedQuery)
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" ? page.isPublished : !page.isPublished)
    return matchesQuery && matchesStatus
  })
  const hasFilters = Boolean(query || statusFilter !== "all")
  const pageCount = Math.max(1, Math.ceil(filteredPages.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)
  const visiblePages = filteredPages.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )
  const rangeStart = filteredPages.length ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = filteredPages.length
    ? rangeStart + visiblePages.length - 1
    : 0

  function clearFilters() {
    setQuery("")
    setStatusFilter("all")
    setCurrentPage(1)
  }

  function openCreate() {
    setDraft(emptyPage)
    setEditingSlug(null)
    setIsSheetOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader description={t("description")} title={t("title")} />
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button
                className="hidden sm:inline-flex"
                onClick={openCreate}
                size="sm"
                type="button"
              >
                <Plus data-icon="inline-start" /> {t("create")}
              </Button>
            }
            search={{
              ariaLabel: t("searchAria"),
              onChange: (value) => {
                setQuery(value)
                setCurrentPage(1)
              },
              placeholder: t("searchPlaceholder"),
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar
              actions={
                hasFilters ? (
                  <Button
                    onClick={clearFilters}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <X /> {t("clear")}
                  </Button>
                ) : undefined
              }
            >
              <DataTableFilter
                ariaLabel={t("filterStatus")}
                label={t("statusColumn")}
                onValueChange={(value) => {
                  setStatusFilter(value as PublicationFilter)
                  setCurrentPage(1)
                }}
                options={[
                  { label: t("filter.all"), value: "all" },
                  { label: t("filter.published"), value: "published" },
                  { label: t("filter.draft"), value: "draft" },
                ]}
                value={statusFilter}
              />
            </DataTableToolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pageColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePages.length ? (
                  visiblePages.map((page) => (
                    <TableRow key={page.slug}>
                      <TableCell>
                        <div className="flex min-w-40 flex-col">
                          <span className="font-medium">{page.title}</span>
                          <span className="text-sm text-muted-foreground">
                            /{page.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={page.isPublished ? "success" : "neutral"}
                        >
                          {page.isPublished ? t("published") : t("draft")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={t("openActions", {
                                title: page.title,
                              })}
                              className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                              size="icon-sm"
                              variant="brand-secondary"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" size="compact">
                            <DropdownMenuItem
                              onSelect={() => {
                                setDraft(page)
                                setEditingSlug(page.slug)
                                setIsSheetOpen(true)
                              }}
                              size="compact"
                            >
                              <Pencil />
                              {t("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => setToDelete(page)}
                              size="compact"
                              variant="destructive"
                            >
                              <Trash2 />
                              {t("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    action={
                      hasFilters ? (
                        <Button onClick={clearFilters} variant="outline">
                          {t("resetFilters")}
                        </Button>
                      ) : null
                    }
                    colSpan={3}
                    description={
                      hasFilters
                        ? t("emptyFilteredDescription")
                        : t("emptyDescription")
                    }
                    title={hasFilters ? t("noMatches") : t("emptyTitle")}
                  />
                )}
              </TableBody>
            </Table>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel={t("itemLabel")}
              onNextPage={() =>
                setCurrentPage((current) => Math.min(current + 1, pageCount))
              }
              onPreviousPage={() =>
                setCurrentPage((current) => Math.max(current - 1, 1))
              }
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={filteredPages.length}
            />
          </CardContent>
        </Card>
        <FloatingActionButton label={t("create")} onClick={openCreate} />
      </div>

      <Sheet onOpenChange={setIsSheetOpen} open={isSheetOpen}>
        <SheetContent
          className="w-full gap-0 p-0 sm:max-w-none data-[side=right]:sm:w-full data-[side=right]:sm:border-l-0"
          side="right"
        >
          <SheetHeader className="border-b">
            <SheetTitle>
              {editingSlug ? t("editTitle") : t("create")}
            </SheetTitle>
            <SheetDescription>{t("sheetDescription")}</SheetDescription>
          </SheetHeader>
          <form
            aria-busy={pending}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => void submit(event)}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="page-title">
                    Título{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                    <span className="sr-only"> {t("required")}</span>
                  </FieldLabel>
                  <Input
                    aria-required="true"
                    disabled={pending}
                    id="page-title"
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    value={draft.title}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="page-slug">{t("slug")}</FieldLabel>
                  <Input
                    disabled={pending}
                    id="page-slug"
                    onChange={(event) =>
                      setDraft({ ...draft, slug: event.target.value })
                    }
                    placeholder={t("slugPlaceholder")}
                    value={draft.slug}
                  />
                  <FieldDescription>{t("slugHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="page-content">{t("content")}</FieldLabel>
                  <MarkdownEditor
                    className="min-h-96"
                    disabled={pending}
                    id="page-content"
                    onChange={(content) => setDraft({ ...draft, content })}
                    value={draft.content}
                  />
                  <FieldDescription>{t("contentHint")}</FieldDescription>
                </Field>
                <Field orientation="horizontal">
                  <Switch
                    checked={draft.isPublished}
                    disabled={pending}
                    id="page-published"
                    onCheckedChange={(checked) =>
                      setDraft({ ...draft, isPublished: checked })
                    }
                  />
                  <FieldLabel htmlFor="page-published">
                    <FieldContent>
                      <FieldTitle>{t("published")}</FieldTitle>
                      <FieldDescription>{t("publishedHint")}</FieldDescription>
                    </FieldContent>
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </div>
            <SheetActions>
              <Button
                disabled={pending}
                onClick={() => setIsSheetOpen(false)}
                type="button"
                variant="brand-secondary"
              >
                {t("cancel")}
              </Button>
              <Button disabled={pending || !draft.title.trim()} type="submit">
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                {t("save")}
              </Button>
            </SheetActions>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        onOpenChange={(open) => !open && setToDelete(null)}
        open={Boolean(toDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", { title: toDelete?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                if (toDelete) void remove(toDelete)
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
