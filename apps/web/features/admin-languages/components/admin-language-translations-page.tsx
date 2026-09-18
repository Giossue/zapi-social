"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  CircleAlert,
  Download,
  Pencil,
  Save,
  ShieldX,
  Upload,
} from "lucide-react"

import { ApiError, adminLanguagesApi } from "@workspace/api-client"
import type { AdminTranslationsResponse } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Progress } from "@workspace/ui/components/progress"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@/components/table-pagination"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { PageLoading } from "@/components/page-loading"
import { useApiErrorMessage } from "@/lib/api-error-message"
import { loginPath } from "@/features/identity/login-redirect"

const pageSize = 50

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

export function AdminLanguageTranslationsPage({ code }: { code: string }) {
  const t = useTranslations("adminLanguages")
  const router = useRouter()
  const apiErrorMessage = useApiErrorMessage()

  const [data, setData] = useState<AdminTranslationsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [pending, setPending] = useState(false)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const importInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      setData(
        await adminLanguagesApi.translations(code, {
          q: query.trim() || undefined,
          missing: statusFilter === "missing",
          offset: (page - 1) * pageSize,
          limit: pageSize,
        })
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true)
        return
      }
      setLoadFailed(true)
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setIsLoading(false)
    }
  }, [apiErrorMessage, code, page, query, router, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  function openEditor(key: string, value: string | null) {
    setEditingKey(key)
    setDraft(value ?? "")
  }

  async function submitTranslation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingKey) return
    setPending(true)
    try {
      await adminLanguagesApi.saveTranslation(code, {
        key: editingKey,
        value: draft,
      })
      setEditingKey(null)
      await load()
      toast.success(t("translationSaved"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function exportJson() {
    setPending(true)
    try {
      const response = await adminLanguagesApi.exportTranslations(code)
      const blob = new Blob([JSON.stringify(response.messages, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${code}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setPending(true)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw new Error("invalid")
      const messages: Record<string, string> = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") messages[key] = value
      }
      const result = await adminLanguagesApi.importTranslations(code, {
        messages,
      })
      await load()
      if (result.rejected.length) {
        toast.warning(
          t("importPartial", {
            imported: result.imported,
            rejected: result.rejected.length,
          })
        )
      } else {
        toast.success(t("importDone", { imported: result.imported }))
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(apiErrorMessage(error.code))
      } else {
        toast.error(t("importInvalid"))
      }
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        description={t("forbiddenDescription")}
        icon={ShieldX}
        title={t("forbiddenTitle")}
      />
    )
  }

  if (notFound) {
    return (
      <EmptyState
        action={
          <Button asChild variant="brand-secondary">
            <Link href="/admin/languages">
              <ArrowLeft data-icon="inline-start" />
              {t("backToLanguages")}
            </Link>
          </Button>
        }
        description={t("notFoundDescription")}
        icon={CircleAlert}
        title={t("notFoundTitle")}
      />
    )
  }

  if (isLoading && !data) return <PageLoading aria-label={t("loading")} />

  if (loadFailed && !data) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    )
  }

  const language = data?.language
  const rows = data?.rows ?? []
  const filtered = data?.filtered ?? 0
  const pageCount = Math.max(1, Math.ceil(filtered / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = filtered ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = filtered
    ? Math.min(rangeStart + rows.length - 1, filtered)
    : 0

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("translationsDescription", {
            name: language?.name ?? code,
          })}
          title={t("translationsTitle", { name: language?.name ?? code })}
        />
        {language ? (
          <div className="flex items-center gap-3">
            <Progress
              className="w-40"
              value={
                language.total
                  ? (language.translated / language.total) * 100
                  : 0
              }
            />
            <span className="text-sm text-muted-foreground tabular-nums">
              {t("progressValue", {
                translated: language.translated,
                total: language.total,
              })}
            </span>
          </div>
        ) : null}
        <Card variant="subtle">
          <DataTableHeader
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="brand-secondary">
                  <Link href="/admin/languages">
                    <ArrowLeft data-icon="inline-start" />
                    {t("backToLanguages")}
                  </Link>
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => importInput.current?.click()}
                  size="sm"
                  type="button"
                  variant="brand-secondary"
                >
                  <Upload data-icon="inline-start" />
                  {t("importJson")}
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => void exportJson()}
                  size="sm"
                  type="button"
                  variant="brand-secondary"
                >
                  <Download data-icon="inline-start" />
                  {t("exportJson")}
                </Button>
              </div>
            }
            filters={
              <DataTableToolbar className="px-0">
                <DataTableFilter
                  ariaLabel={t("statusFilter")}
                  label={t("statusFilter")}
                  onValueChange={(value) => {
                    setStatusFilter(value)
                    setPage(1)
                  }}
                  options={[
                    { label: t("filterAll"), value: "all" },
                    { label: t("filterMissing"), value: "missing" },
                  ]}
                  value={statusFilter}
                />
              </DataTableToolbar>
            }
            search={{
              ariaLabel: t("translationsSearchLabel"),
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: t("translationsSearchPlaceholder"),
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            {rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="max-lg:hidden">
                      {t("keyColumn")}
                    </TableHead>
                    <TableHead>{t("sourceColumn")}</TableHead>
                    <TableHead>{t("valueColumn")}</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">{t("actionsColumn")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="max-w-56 max-lg:hidden">
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {row.key}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-72">
                        <span className="line-clamp-2 text-sm">
                          {row.source}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-72">
                        {row.value === null ? (
                          <span className="text-sm text-muted-foreground italic">
                            {t("missingValue")}
                          </span>
                        ) : (
                          <span className="line-clamp-2 text-sm">
                            {row.value}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          aria-label={t("editKey", { key: row.key })}
                          onClick={() => openEditor(row.key, row.value)}
                          size="icon-sm"
                          variant="brand-secondary"
                        >
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6">
                <EmptyState
                  description={t("noResultsDescription")}
                  icon={CircleAlert}
                  title={t("noResultsTitle")}
                />
              </div>
            )}
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel={t("itemLabel")}
              onNextPage={() => setPage((current) => current + 1)}
              onPreviousPage={() => setPage((current) => current - 1)}
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={filtered}
            />
          </CardContent>
        </Card>
      </div>

      <input
        accept="application/json"
        className="hidden"
        onChange={(event) => void importJson(event)}
        ref={importInput}
        type="file"
      />

      <Sheet
        onOpenChange={(open) => {
          if (!open) setEditingKey(null)
        }}
        open={Boolean(editingKey)}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
          <SheetHeader className="border-b">
            <SheetTitle>{t("editTitle")}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {editingKey}
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => void submitTranslation(event)}
          >
            <div className="flex flex-col gap-5 overflow-y-auto p-4">
              <Field>
                <FieldLabel>{t("sourceColumn")}</FieldLabel>
                <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  {rows.find((row) => row.key === editingKey)?.source ?? ""}
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="translation-value">
                  {t("valueColumn")}
                </FieldLabel>
                <Textarea
                  id="translation-value"
                  maxLength={4000}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={5}
                  value={draft}
                />
                <FieldDescription>{t("editHint")}</FieldDescription>
              </Field>
            </div>
            <SheetActions>
              <Button
                disabled={pending}
                onClick={() => setEditingKey(null)}
                type="button"
                variant="brand-secondary"
              >
                {t("cancel")}
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {t("save")}
              </Button>
            </SheetActions>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
