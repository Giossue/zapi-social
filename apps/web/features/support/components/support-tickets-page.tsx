"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  CircleCheck,
  CircleDot,
  CircleX,
  LifeBuoy,
  LockKeyhole,
  MessageSquare,
  Plus,
  X,
} from "lucide-react"

import { ApiError, supportApi } from "@workspace/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { MetricCard } from "@workspace/ui/components/metric-card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"
import { loginPath } from "@/features/identity/login-redirect"

import type {
  SupportCategory,
  SupportTicket,
  SupportTicketStatus,
} from "@/features/support/types/support"

const statusLabel: Record<SupportTicketStatus, string> = {
  open: "Abierto",
  resolved: "Resuelto",
  closed: "Cerrado",
}

const statusVariant: Record<
  SupportTicketStatus,
  "info" | "success" | "secondary"
> = {
  open: "info",
  resolved: "success",
  closed: "secondary",
}

type NewTicketValues = {
  categoryId: string
  subject: string
  description: string
}

const emptyTicketValues: NewTicketValues = {
  categoryId: "",
  subject: "",
  description: "",
}

type SupportCounts = Record<SupportTicketStatus, number>

const emptyCounts: SupportCounts = { open: 0, resolved: 0, closed: 0 }

function SupportMetrics({ counts }: { counts: SupportCounts }) {
  const t = useTranslations("support")
  const items = [
    {
      description: t("metrics.openDescription"),
      icon: CircleDot,
      label: t("metrics.open"),
      value: counts.open,
    },
    {
      description: t("metrics.resolvedDescription"),
      icon: CircleCheck,
      label: t("metrics.resolved"),
      value: counts.resolved,
    },
    {
      description: t("metrics.closedDescription"),
      icon: CircleX,
      label: t("metrics.closed"),
      value: counts.closed,
    },
  ]

  return (
    <CardGrid layout="xl-3">
      {items.map((item) => (
        <MetricCard key={item.label} {...item} />
      ))}
    </CardGrid>
  )
}

function NewSupportTicketSheet({
  categories,
  onCreate,
  onOpenChange,
  open,
  pending,
}: {
  categories: readonly SupportCategory[]
  onCreate: (values: NewTicketValues) => Promise<boolean>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
}) {
  const t = useTranslations("support")
  const [values, setValues] = useState(emptyTicketValues)
  const canSubmit = Boolean(
    values.categoryId && values.subject.trim() && values.description.trim()
  )

  function close() {
    setValues(emptyTicketValues)
    onOpenChange(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(t("missingFields"))
      return
    }

    const created = await onCreate({
      categoryId: values.categoryId,
      subject: values.subject.trim(),
      description: values.description.trim(),
    })
    if (created) close()
  }

  return (
    <Sheet
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
      open={open}
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("createTitle")}</SheetTitle>
          <SheetDescription>{t("createDescription")}</SheetDescription>
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
                <FieldLabel htmlFor="support-category">
                  Categoría{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Select
                  onValueChange={(categoryId) =>
                    setValues((current) => ({ ...current, categoryId }))
                  }
                  value={values.categoryId}
                >
                  <SelectTrigger
                    aria-required="true"
                    className="w-full"
                    id="support-category"
                  >
                    <SelectValue placeholder={t("selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="support-subject">
                  Asunto{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="support-subject"
                  maxLength={250}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  placeholder={t("subjectPlaceholder")}
                  value={values.subject}
                />
                <FieldDescription>{t("subjectHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="support-description">
                  Descripción{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="support-description"
                  maxLength={5000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder={t("bodyPlaceholder")}
                  rows={6}
                  value={values.description}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              disabled={pending}
              onClick={close}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LifeBuoy data-icon="inline-start" />
              )}
              {t("createTicket")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

const pageSize = 10

export function SupportTicketsPage() {
  const t = useTranslations("support")
  const format = useFormatter()
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [counts, setCounts] = useState<SupportCounts>(emptyCounts)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SupportTicketStatus | "all">("all")
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [canView, setCanView] = useState(true)
  const [pending, setPending] = useState(false)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setCanView(false)
        return true
      }
      return false
    },
    [router]
  )

  const loadCounts = useCallback(async () => {
    const [open, resolved, closed] = await Promise.all([
      supportApi.list({ limit: 1, status: "open" }),
      supportApi.list({ limit: 1, status: "resolved" }),
      supportApi.list({ limit: 1, status: "closed" }),
    ])
    setCounts({
      open: open.total,
      resolved: resolved.total,
      closed: closed.total,
    })
  }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const [response] = await Promise.all([
        supportApi.list({
          limit: pageSize,
          page,
          ...(query.trim() ? { q: query.trim() } : {}),
          ...(status === "all" ? {} : { status }),
        }),
        loadCounts(),
      ])
      setTickets(response.tickets)
      setTotal(response.total)
      setCanView(true)
    } catch (error) {
      if (handleError(error)) return
      console.error("Support tickets request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError, loadCounts, page, query, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  useEffect(() => {
    let isCurrent = true
    void supportApi
      .categories()
      .then((response) => {
        if (isCurrent) setCategories(response)
      })
      .catch((error: unknown) => {
        if (handleError(error)) return
        console.error("Support categories request failed", error)
      })
    return () => {
      isCurrent = false
    }
  }, [handleError])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = total ? rangeStart + tickets.length - 1 : 0
  const hasFilters = Boolean(query || status !== "all")

  function clearFilters() {
    setQuery("")
    setStatus("all")
    setPage(1)
  }

  async function createTicket(values: NewTicketValues) {
    setPending(true)
    try {
      await supportApi.create(values)
      setPage(1)
      await load()
      toast.success(t("created"))
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Support ticket creation failed", error)
      toast.error(t("createFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  if (!canView) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={LockKeyhole}
            title={t("unavailableTitle")}
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !tickets.length && !loadError) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError) {
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
            description={t("loadFailedDescription")}
            icon={LifeBuoy}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <SupportMetrics counts={counts} />
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button
                className="hidden sm:inline-flex"
                onClick={() => setIsCreateOpen(true)}
                size="sm"
                type="button"
              >
                <Plus data-icon="inline-start" /> {t("newTicket")}
              </Button>
            }
            search={{
              ariaLabel: t("searchLabel"),
              onChange: (value) => {
                setQuery(value)
                setPage(1)
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
                  const next = value as SupportTicketStatus | "all"
                  setStatus(next)
                  setPage(1)
                }}
                options={[
                  { label: t("all"), value: "all" },
                  { label: t("filter.open"), value: "open" },
                  { label: t("filter.resolved"), value: "resolved" },
                  { label: t("filter.closed"), value: "closed" },
                ]}
                value={status}
              />
            </DataTableToolbar>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("ticket")}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("categoryColumn")}
                    </TableHead>
                    <TableHead>{t("statusColumn")}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("updated")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("actionColumn")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length ? (
                    tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <div className="flex min-w-48 flex-col gap-1">
                            <span className="font-medium">
                              {ticket.subject}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MessageSquare className="size-3.5" />
                              {ticket.commentCount}{" "}
                              {ticket.commentCount === 1
                                ? "respuesta"
                                : "respuestas"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {ticket.category.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[ticket.status]}>
                            {statusLabel[ticket.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {format.dateTime(new Date(ticket.updatedAt), {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="brand-secondary">
                            <Link href={`/portal/support/${ticket.id}`}>
                              <MessageSquare data-icon="inline-start" />{" "}
                              {t("viewTicket")}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyRow
                      colSpan={5}
                      action={
                        hasFilters ? (
                          <Button onClick={clearFilters} variant="outline">
                            {t("resetFilters")}
                          </Button>
                        ) : null
                      }
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
            </div>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel={t("cases")}
              onNextPage={() =>
                setPage((current) => Math.min(current + 1, pageCount))
              }
              onPreviousPage={() =>
                setPage((current) => Math.max(current - 1, 1))
              }
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={total}
            />
          </CardContent>
        </Card>

        <FloatingActionButton
          label={t("newTicket")}
          onClick={() => setIsCreateOpen(true)}
        />
      </div>
      <NewSupportTicketSheet
        categories={categories}
        onCreate={createTicket}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
        pending={pending}
      />
    </>
  )
}
