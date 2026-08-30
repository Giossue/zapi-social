"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { LifeBuoy, MessageSquare, Plus, ShieldX, X } from "lucide-react"

import { adminSupportApi, ApiError } from "@workspace/api-client"
import type {
  AdminSupportCategory,
  AdminSupportTicket,
  AdminSupportTicketStatus,
} from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { loginPath } from "@/features/identity/login-redirect"

import {
  AdminSupportNewCaseSheet,
  type NewCaseValues,
} from "./admin-support-new-case-sheet"
import {
  SupportCatalogPanel,
  type SupportCatalogItem,
} from "./support-catalog-panel"
import {
  fixtureUsers,
  initialLabels,
  initialTypes,
} from "../fixtures/support-catalog"

const statusVariant: Record<
  AdminSupportTicketStatus,
  "info" | "success" | "secondary"
> = { open: "info", resolved: "success", closed: "secondary" }

const pageSize = 10

function isLocalTicket(ticket: AdminSupportTicket) {
  return ticket.id.startsWith("local-")
}

export function AdminSupportPage() {
  const router = useRouter()
  const t = useTranslations("adminSupport")
  const format = useFormatter()
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([])
  const [categories, setCategories] = useState<AdminSupportCategory[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<AdminSupportTicketStatus | "all">("all")
  const [categoryId, setCategoryId] = useState("all")
  const [queue, setQueue] = useState<"all" | "awaiting">("all")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [localTickets, setLocalTickets] = useState<AdminSupportTicket[]>([])
  const [categoriesCatalog, setCategoriesCatalog] = useState<
    SupportCatalogItem[] | null
  >(null)
  const [labelsCatalog, setLabelsCatalog] = useState<SupportCatalogItem[]>([
    ...initialLabels,
  ])
  const [typesCatalog, setTypesCatalog] = useState<SupportCatalogItem[]>([
    ...initialTypes,
  ])

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await adminSupportApi.list({
        limit: pageSize,
        page,
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(status === "all" ? {} : { status }),
        ...(categoryId === "all" ? {} : { categoryId }),
        ...(queue === "awaiting" ? { awaitingReply: true } : {}),
      })
      setTickets(response.tickets)
      setCategories(response.categories)
      setTotal(response.total)
      setForbidden(false)
      setCategoriesCatalog(
        (current) =>
          current ??
          response.categories.map((category) => ({
            id: category.id,
            name: category.name,
            isActive: category.status === "active",
          }))
      )
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("Admin support request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [categoryId, page, query, queue, router, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const displayTickets = [...localTickets, ...tickets]
  const displayTotal = total + localTickets.length
  const pageCount = Math.max(1, Math.ceil(displayTotal / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = displayTotal ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = displayTotal ? rangeStart + displayTickets.length - 1 : 0
  const hasFilters = Boolean(
    query || status !== "all" || categoryId !== "all" || queue !== "all"
  )

  function clearFilters() {
    setQuery("")
    setStatus("all")
    setCategoryId("all")
    setQueue("all")
    setPage(1)
  }

  function createLocalTicket(values: NewCaseValues) {
    const user = fixtureUsers.find(
      (candidate) => candidate.id === values.userId
    )
    if (!user) return
    const category = (categoriesCatalog ?? []).find(
      (candidate) => candidate.id === values.categoryId
    )
    const now = new Date().toISOString()
    setLocalTickets((current) => [
      {
        id: `local-${current.length + 1}`,
        subject: values.subject,
        status: "open",
        category: {
          id: category?.id ?? "local-category",
          name: category?.name ?? t("noCategory"),
          slug: "local",
          description: "",
          status: "active",
        },
        workspace: {
          id: `local-workspace-${user.id}`,
          name: user.workspaceName,
        },
        requester: { id: user.id, displayName: user.name, email: user.email },
        commentCount: 0,
        awaitingReply: false,
        lastActivityAt: now,
        resolvedAt: null,
        createdAt: now,
      },
      ...current,
    ])
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

  if (isLoading && !tickets.length && !loadError) {
    return <PageLoading aria-label={t("loadingCases")} />
  }

  if (loadError) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={LifeBuoy}
        title={t("loadFailedTitle")}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader description={t("description")} title={t("title")} />
        <Tabs defaultValue="cases">
          <TabsList
            aria-label={t("tabsLabel")}
            className="flex h-auto flex-wrap"
          >
            <TabsTrigger value="cases">{t("tab.cases")}</TabsTrigger>
            <TabsTrigger value="categories">{t("tab.categories")}</TabsTrigger>
            <TabsTrigger value="labels">{t("tab.labels")}</TabsTrigger>
            <TabsTrigger value="types">{t("tab.types")}</TabsTrigger>
          </TabsList>
          <TabsContent className="flex flex-col gap-4" value="cases">
            <Card variant="subtle">
              <DataTableHeader
                action={
                  <Button
                    className="hidden sm:inline-flex"
                    onClick={() => setCreateOpen(true)}
                    size="sm"
                    type="button"
                  >
                    <Plus data-icon="inline-start" /> {t("newCase")}
                  </Button>
                }
                search={{
                  ariaLabel: t("searchAriaLabel"),
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
                    status !== "all" ||
                    categoryId !== "all" ||
                    queue !== "all" ? (
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
                    ariaLabel={t("filterQueue")}
                    label={t("queueColumn")}
                    onValueChange={(value) => {
                      setQueue(value as "all" | "awaiting")
                      setPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("unanswered"), value: "awaiting" },
                    ]}
                    value={queue}
                  />
                  <DataTableFilter
                    ariaLabel={t("filterStatus")}
                    label={t("statusColumn")}
                    onValueChange={(value) => {
                      setStatus(value as AdminSupportTicketStatus | "all")
                      setPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("status.open"), value: "open" },
                      { label: t("status.resolved"), value: "resolved" },
                      { label: t("status.closed"), value: "closed" },
                    ]}
                    value={status}
                  />
                  <DataTableFilter
                    ariaLabel={t("filterCategory")}
                    label={t("category")}
                    onValueChange={(value) => {
                      setCategoryId(value)
                      setPage(1)
                    }}
                    options={[
                      { label: t("allFeminine"), value: "all" },
                      ...categories.map((category) => ({
                        label: category.name,
                        value: category.id,
                      })),
                    ]}
                    value={categoryId}
                  />
                </DataTableToolbar>
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("caseColumn")}</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          {t("workspaceColumn")}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t("category")}
                        </TableHead>
                        <TableHead>{t("statusColumn")}</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          {t("activityColumn")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("actionColumn")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayTickets.length ? (
                        displayTickets.map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell>
                              <div className="flex min-w-48 flex-col gap-1">
                                <span className="font-medium">
                                  {ticket.subject}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {ticket.requester.displayName} ·{" "}
                                  {ticket.requester.email}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground lg:table-cell">
                              {ticket.workspace.name}
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground md:table-cell">
                              {ticket.category.name}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant={statusVariant[ticket.status]}>
                                  {t(`status.${ticket.status}`)}
                                </Badge>
                                {ticket.awaitingReply ? (
                                  <Badge variant="warning">
                                    {t("unanswered")}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground lg:table-cell">
                              {format.dateTime(
                                new Date(ticket.lastActivityAt),
                                "date"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isLocalTicket(ticket) ? (
                                <Button
                                  disabled
                                  size="sm"
                                  variant="brand-secondary"
                                >
                                  <MessageSquare data-icon="inline-start" />{" "}
                                  {t("viewCase")}
                                </Button>
                              ) : (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="brand-secondary"
                                >
                                  <Link href={`/admin/support/${ticket.id}`}>
                                    <MessageSquare data-icon="inline-start" />{" "}
                                    {t("viewCase")}
                                  </Link>
                                </Button>
                              )}
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
                          colSpan={6}
                          description={
                            hasFilters
                              ? t("emptyFilteredCases")
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
                  itemLabel={t("itemLabel")}
                  onNextPage={() =>
                    setPage((current) => Math.min(current + 1, pageCount))
                  }
                  onPreviousPage={() =>
                    setPage((current) => Math.max(current - 1, 1))
                  }
                  rangeEnd={rangeEnd}
                  rangeStart={rangeStart}
                  total={displayTotal}
                />
              </CardContent>
            </Card>
            <FloatingActionButton
              label={t("newCase")}
              onClick={() => setCreateOpen(true)}
            />
          </TabsContent>
          <TabsContent className="flex flex-col gap-4" value="categories">
            <SupportCatalogPanel
              copy={{
                createLabel: t("categories.create"),
                emptyDescription: t("categories.emptyDescription"),
                emptyTitle: t("categories.emptyTitle"),
                itemLabel: t("categories.itemLabel"),
                searchPlaceholder: t("categories.searchPlaceholder"),
                sheetDescription: t("categories.sheetDescription"),
              }}
              items={categoriesCatalog ?? []}
              onChange={setCategoriesCatalog}
            />
          </TabsContent>
          <TabsContent className="flex flex-col gap-4" value="labels">
            <SupportCatalogPanel
              copy={{
                createLabel: t("labelsCatalog.create"),
                emptyDescription: t("labelsCatalog.emptyDescription"),
                emptyTitle: t("labelsCatalog.emptyTitle"),
                itemLabel: t("labelsCatalog.itemLabel"),
                searchPlaceholder: t("labelsCatalog.searchPlaceholder"),
                sheetDescription: t("labelsCatalog.sheetDescription"),
              }}
              items={labelsCatalog}
              onChange={setLabelsCatalog}
            />
          </TabsContent>
          <TabsContent className="flex flex-col gap-4" value="types">
            <SupportCatalogPanel
              copy={{
                createLabel: t("types.create"),
                emptyDescription: t("types.emptyDescription"),
                emptyTitle: t("types.emptyTitle"),
                itemLabel: t("types.itemLabel"),
                searchPlaceholder: t("types.searchPlaceholder"),
                sheetDescription: t("types.sheetDescription"),
              }}
              items={typesCatalog}
              onChange={setTypesCatalog}
            />
          </TabsContent>
        </Tabs>
      </div>
      <AdminSupportNewCaseSheet
        categories={categoriesCatalog ?? []}
        labels={labelsCatalog}
        onCreate={createLocalTicket}
        onOpenChange={setCreateOpen}
        open={createOpen}
        types={typesCatalog}
        users={fixtureUsers}
      />
    </>
  )
}
