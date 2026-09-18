"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import Link from "next/link"
import {
  aiApi,
  ApiError,
  authApi,
  channelsApi,
  filesApi,
} from "@workspace/api-client"
import type {
  AiRequestKind,
  PortalAiDashboard,
  PortalAiPublishingSchedule,
  PortalAiRequest,
  PortalAiRequestsResponse,
  PortalAiSettings,
  PortalChannelAccount,
  PortalCreditsResponse,
} from "@workspace/contracts"

import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Coins,
  Copy,
  Download,
  Eye,
  FileSearch,
  ListFilter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Progress } from "@workspace/ui/components/progress"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@/components/page-loading"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@/components/table-pagination"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"

import { useApiErrorMessage } from "@/lib/api-error-message"

import {
  type AiStudioView,
  studioDestinations,
} from "@/features/ai-studio/fixtures/ai-studio"
import {
  type AiAutomationRow,
  AiAutomationSurface,
  type AiCreditMovementRow,
  AiCreditsSurface,
  type AiHistoryRow,
  AiHistorySurface,
  type AiOperationalViewState,
  DownloadTableButton,
} from "@/features/ai-studio/components/ai-studio-operations"

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

function aiLoadState(
  error: unknown
): Exclude<AiOperationalViewState, "loading" | "ready"> {
  return error instanceof ApiError && error.status === 403
    ? "forbidden"
    : "error"
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function usePolledRequest() {
  const [request, setRequest] = useState<PortalAiRequest | null>(null)
  useEffect(() => {
    if (
      !request ||
      (request.status !== "queued" && request.status !== "processing")
    )
      return
    const timer = window.setInterval(() => {
      void aiApi
        .getRequest(request.id)
        .then(setRequest)
        .catch(() => undefined)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [request])
  return [request, setRequest] as const
}

function StudioHeader({
  actions,
  view,
}: {
  actions?: React.ReactNode
  view: AiStudioView
}) {
  const t = useTranslations("aiStudio.views")

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t(`${view}.title` as "overview.title")}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t(`${view}.description` as "overview.description")}
        </p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

function StatusBadge({ status }: { status: PortalAiRequest["status"] }) {
  const t = useTranslations("aiStudio.operations")
  const copy = t(`historyStatusBadge.${status}`)
  if (status === "succeeded") return <Badge variant="success">{copy}</Badge>
  if (status === "failed") return <Badge variant="destructive">{copy}</Badge>
  return <Badge variant="secondary">{copy}</Badge>
}

function JobActions({
  request,
  onChanged,
}: {
  request: PortalAiRequest
  onChanged?: () => void
}) {
  const t = useTranslations("aiStudio.studio")
  const apiErrorMessage = useApiErrorMessage()
  const [pending, setPending] = useState(false)

  async function retry() {
    setPending(true)
    try {
      await aiApi.retryRequest(request.id, {
        idempotencyKey: idempotencyKey("retry"),
      })
      toast.success(t("retryQueued"))
      onChanged?.()
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function archive() {
    setPending(true)
    try {
      await aiApi.archiveRequest(request.id, { archived: true })
      toast.success(t("archived"))
      onChanged?.()
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("actionsFor", { title: request.title })}
          disabled={pending}
          size="icon-sm"
          variant="brand-secondary"
        >
          {pending ? (
            <Spinner aria-label={t("processing")} />
          ) : (
            <MoreHorizontal />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() =>
              toast.info(
                request.result && Object.keys(request.result).length
                  ? JSON.stringify(request.result)
                  : t("noResultYet")
              )
            }
          >
            <Eye />
            {t("preview")}
          </DropdownMenuItem>
          {request.status === "failed" || request.status === "cancelled" ? (
            <DropdownMenuItem onSelect={() => void retry()}>
              <Copy />
              {t("retry")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void archive()} variant="destructive">
          <Trash2 />
          {t("archive")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function JobsTable({
  action,
  onChanged,
  rows,
}: {
  action?: React.ReactNode
  onChanged?: () => void
  rows: PortalAiRequest[]
}) {
  const t = useTranslations("aiStudio.studio")
  const tOps = useTranslations("aiStudio.operations")
  const format = useFormatter()
  const [query, setQuery] = useState("")
  const [kindFilter, setKindFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)

  const kindOptions = Array.from(new Set(rows.map((row) => row.kind)))
  const statusOptions = Array.from(new Set(rows.map((row) => row.status)))
  const normalizedQuery = query.trim().toLocaleLowerCase("es")
  const hasFilters = Boolean(
    normalizedQuery || kindFilter !== "all" || statusFilter !== "all"
  )
  const filteredRows = rows.filter(
    (row) =>
      (kindFilter === "all" || row.kind === kindFilter) &&
      (statusFilter === "all" || row.status === statusFilter) &&
      (!normalizedQuery ||
        row.title.toLocaleLowerCase("es").includes(normalizedQuery))
  )
  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / AI_TABLE_PAGE_SIZE)
  )
  const currentPage = Math.min(page, pageCount)
  const visibleRows = filteredRows.slice(
    (currentPage - 1) * AI_TABLE_PAGE_SIZE,
    currentPage * AI_TABLE_PAGE_SIZE
  )

  function clearFilters() {
    setQuery("")
    setKindFilter("all")
    setStatusFilter("all")
    setPage(1)
  }

  return (
    <>
      <DataTableHeader
        action={action}
        filters={
          <DataTableToolbar
            className="px-0"
            actions={
              kindFilter !== "all" || statusFilter !== "all" ? (
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
              ariaLabel={t("filterKind")}
              label={tOps("type")}
              onValueChange={(value) => {
                setKindFilter(value)
                setPage(1)
              }}
              options={[
                { label: t("all"), value: "all" },
                ...kindOptions.map((kind) => ({
                  label: tOps(`kind.${kind}`),
                  value: kind,
                })),
              ]}
              value={kindFilter}
            />
            <DataTableFilter
              ariaLabel={t("filterStatus")}
              label={tOps("status")}
              onValueChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
              options={[
                { label: t("all"), value: "all" },
                ...statusOptions.map((status) => ({
                  label: tOps(`historyStatusBadge.${status}`),
                  value: status,
                })),
              ]}
              value={statusFilter}
            />
          </DataTableToolbar>
        }
        search={{
          ariaLabel: tOps("history.searchLabel"),
          onChange: (value) => {
            setQuery(value)
            setPage(1)
          },
          placeholder: tOps("history.searchPlaceholder"),
          value: query,
        }}
      />
      <CardContent className="flex flex-col gap-4 px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tOps("history.generation")}</TableHead>
              <TableHead className="hidden md:table-cell">
                {tOps("type")}
              </TableHead>
              <TableHead>{tOps("status")}</TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("usage")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {tOps("date")}
              </TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.id.slice(0, 8)}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {tOps(`kind.${row.kind}`)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {t("credits", { count: row.costUnits })}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {row.createdAt
                    ? format.dateTime(new Date(row.createdAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <JobActions request={row} onChanged={onChanged} />
                </TableCell>
              </TableRow>
            ))}
            {filteredRows.length === 0 ? (
              <TableEmptyRow
                action={
                  hasFilters ? (
                    <Button onClick={clearFilters} variant="outline">
                      {t("clearFilters")}
                    </Button>
                  ) : null
                }
                colSpan={6}
                description={
                  hasFilters
                    ? t("emptyFilteredDescription")
                    : t("emptyDescription")
                }
                title={hasFilters ? t("noMatches") : tOps("history.emptyTitle")}
              />
            ) : null}
          </TableBody>
        </Table>
        <TablePagination
          canGoNext={currentPage < pageCount}
          canGoPrevious={currentPage > 1}
          itemLabel={t("generations")}
          onNextPage={() => setPage(currentPage + 1)}
          onPreviousPage={() => setPage(currentPage - 1)}
          rangeEnd={Math.min(
            currentPage * AI_TABLE_PAGE_SIZE,
            filteredRows.length
          )}
          rangeStart={
            filteredRows.length ? (currentPage - 1) * AI_TABLE_PAGE_SIZE + 1 : 0
          }
          total={filteredRows.length}
        />
      </CardContent>
    </>
  )
}

function Overview() {
  const t = useTranslations("aiStudio.studio")
  const tOps = useTranslations("aiStudio.operations")
  const [dashboard, setDashboard] = useState<PortalAiDashboard | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(async () => {
    setFailed(false)
    try {
      setDashboard(await aiApi.dashboard())
    } catch {
      setFailed(true)
      setDashboard(null)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  if (!dashboard) {
    if (!failed) return <PageLoading aria-label={t("loading")} />
    return (
      <Card variant="subtle">
        <EmptyState
          icon={CircleAlert}
          title={t("loadFailedTitle")}
          description={t("loadFailedDescription")}
          action={
            <Button onClick={() => void load()} variant="brand-secondary">
              <RefreshCw data-icon="inline-start" /> {t("retry")}
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Button asChild>
            <Link href="/portal/ai-studio/ai-content">
              <WandSparkles data-icon="inline-start" />
              {tOps("createContent")}
            </Link>
          </Button>
        }
        view="overview"
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading font-medium">{t("pickToolTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("pickToolDescription")}
          </p>
        </div>
        <CardGrid>
          {studioDestinations.slice(1, 9).map((item) => (
            <Link className="group" href={item.href} key={item.view}>
              <Card
                variant="subtle"
                className="h-full transition-colors group-hover:bg-muted/40"
                size="sm"
              >
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
                    <item.icon className="size-4" />
                  </div>
                  <CardTitle className="flex items-center justify-between gap-2">
                    {item.label}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </CardGrid>
      </section>

      <section className="flex flex-col gap-3">
        <CollectionHeader
          description={tOps("history.description")}
          level="h2"
          title={t("recentActivity")}
        />
        <Card variant="subtle">
          <JobsTable
            action={
              <Button asChild size="sm" variant="brand-secondary">
                <Link href="/portal/ai-studio/history">
                  {tOps("viewHistory")} <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            }
            onChanged={() => void load()}
            rows={dashboard.recentRequests}
          />
        </Card>
      </section>
    </div>
  )
}

type CreationView = "content" | "image" | "video" | "repurpose" | "review"

const creationCostUnits: Record<CreationView, number> = {
  content: 2,
  image: 4,
  repurpose: 2,
  review: 1,
  video: 12,
}

function ContentResult({ request }: { request: PortalAiRequest }) {
  const t = useTranslations("aiStudio.creation")
  const result = request.result as {
    variants?: Array<{ platform: string; caption: string; hashtags?: string[] }>
  }
  const variants = result.variants ?? []

  return (
    <div className="flex flex-col gap-3">
      {variants.map((variant) => (
        <div
          className="rounded-lg border p-3"
          key={`${variant.platform}-${variant.caption}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="secondary">{variant.platform}</Badge>
            <Button
              aria-label={t("copyVariant", { platform: variant.platform })}
              onClick={() =>
                void navigator.clipboard
                  .writeText(variant.caption)
                  .then(() => toast.success(t("textCopied")))
              }
              size="icon-xs"
              variant="brand-secondary"
            >
              <Copy />
            </Button>
          </div>
          <p className="text-sm leading-relaxed">{variant.caption}</p>
          {variant.hashtags?.length ? (
            <p className="mt-2 text-xs text-primary">
              {variant.hashtags.join(" ")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function ImageResult({ request }: { request: PortalAiRequest }) {
  const t = useTranslations("aiStudio.creation")
  const result = request.result as {
    assets?: Array<{
      fileAssetId: string
      width: number | null
      height: number | null
    }>
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {(result.assets ?? []).map((asset, index) => (
        <div
          className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
          key={asset.fileAssetId}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={t("proposalAlt", { index: index + 1 })}
            className="size-full object-cover"
            src={filesApi.previewUrl(asset.fileAssetId)}
          />
          <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              aria-label={t("preview")}
              asChild
              size="icon-sm"
              variant="brand-secondary"
            >
              <a
                href={filesApi.previewUrl(asset.fileAssetId)}
                target="_blank"
                rel="noreferrer"
              >
                <Eye />
              </a>
            </Button>
            <Button
              aria-label={t("download")}
              asChild
              size="icon-sm"
              variant="brand-secondary"
            >
              <a href={filesApi.downloadUrl(asset.fileAssetId)}>
                <Download />
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function VideoResult({ request }: { request: PortalAiRequest }) {
  const t = useTranslations("aiStudio.creation")
  const result = request.result as {
    fileAssetId?: string
    durationSeconds?: number
  }
  if (request.status === "queued" || request.status === "processing") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span>{t("videoRender")}</span>
          <span className="text-muted-foreground">{request.progress}%</span>
        </div>
        <Progress value={request.progress} />
        <p className="text-xs text-muted-foreground">{t("backgroundWork")}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
        {result.fileAssetId ? (
          <video
            className="size-full object-contain"
            controls
            src={filesApi.previewUrl(result.fileAssetId)}
          />
        ) : null}
        <Badge className="absolute top-3 left-3" variant="secondary">
          {result.durationSeconds ?? 0}s
        </Badge>
      </div>
      {result.fileAssetId ? (
        <Button asChild variant="brand-secondary">
          <a href={filesApi.downloadUrl(result.fileAssetId)}>
            <Download data-icon="inline-start" /> {t("downloadVideo")}
          </a>
        </Button>
      ) : null}
    </div>
  )
}

function RepurposeResult({ request }: { request: PortalAiRequest }) {
  const t = useTranslations("aiStudio.creation")
  const result = request.result as {
    strategy?: string
    variants?: Array<{ platform: string; format: string; content: string }>
  }
  const variants = result.variants ?? []
  return (
    <Tabs defaultValue={variants[0]?.platform}>
      <TabsList>
        {variants.map((variant) => (
          <TabsTrigger key={variant.platform} value={variant.platform}>
            {variant.platform}
          </TabsTrigger>
        ))}
      </TabsList>
      {variants.map((variant) => (
        <TabsContent
          className="rounded-lg border p-4"
          key={variant.platform}
          value={variant.platform}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium">{variant.format}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.strategy}
              </p>
            </div>
            <Button
              onClick={() =>
                void navigator.clipboard
                  .writeText(variant.content)
                  .then(() => toast.success(t("variantCopied")))
              }
              size="sm"
              variant="brand-secondary"
            >
              <Copy data-icon="inline-start" />
              {t("copy")}
            </Button>
          </div>
          <Separator className="my-4" />
          <p className="text-sm leading-relaxed">{variant.content}</p>
        </TabsContent>
      ))}
    </Tabs>
  )
}

function ReviewResult({ request }: { request: PortalAiRequest }) {
  const t = useTranslations("aiStudio.creation")
  const result = request.result as {
    score?: number
    verdict?: string
    dimensions?: {
      clarity?: number
      brandVoice?: number
      callToAction?: number
      safety?: number
    }
    risks?: string[]
    corrections?: string[]
    revisedContent?: string
  }
  const dimensions = [
    [t("dimension.clarity"), result.dimensions?.clarity],
    [t("dimension.brandVoice"), result.dimensions?.brandVoice],
    [t("dimension.callToAction"), result.dimensions?.callToAction],
    [t("dimension.safety"), result.dimensions?.safety],
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {dimensions.map(([label, score]) => (
          <div className="rounded-lg border p-3" key={String(label)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{score}</p>
          </div>
        ))}
      </div>
      <Alert>
        <CircleAlert />
        <AlertTitle>Puntuación general: {result.score ?? 0}/100</AlertTitle>
        <AlertDescription>{result.verdict}</AlertDescription>
      </Alert>
      {(result.corrections ?? []).map((item) => (
        <div
          className="flex items-start gap-2 rounded-lg border p-3"
          key={item}
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">{item}</p>
        </div>
      ))}
    </div>
  )
}

function creationTitleKey(view: CreationView) {
  if (view === "repurpose") return "promptTitle.repurpose" as const
  if (view === "review") return "promptTitle.review" as const
  return "promptTitle.default" as const
}

function CreationResult({
  view,
  request,
}: {
  view: CreationView
  request: PortalAiRequest
}) {
  if (view === "content") return <ContentResult request={request} />
  if (view === "image") return <ImageResult request={request} />
  if (view === "video") return <VideoResult request={request} />
  if (view === "repurpose") return <RepurposeResult request={request} />
  return <ReviewResult request={request} />
}

function CreationWorkspace({ view }: { view: CreationView }) {
  const apiErrorMessage = useApiErrorMessage()
  const t = useTranslations("aiStudio.creation")
  const [brief, setBrief] = useState("")
  const [objective, setObjective] = useState(
    view === "repurpose" ? "adaptar" : "engagement"
  )
  const [option, setOption] = useState(
    view === "image" ? "1:1" : view === "video" ? "9:16" : "cercano"
  )
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>([])
  const [request, setRequest] = useState<PortalAiRequest | null>(null)
  const [pending, setPending] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const costUnits = creationCostUnits[view]
  const isMedia = view === "image" || view === "video"

  useEffect(() => {
    if (
      !request ||
      (request.status !== "queued" && request.status !== "processing")
    )
      return
    const timer = window.setInterval(() => {
      void aiApi
        .getRequest(request.id)
        .then(setRequest)
        .catch(() => undefined)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [request])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!brief.trim()) {
      toast.error(t("missingPrompt"))
      return
    }
    setPending(true)
    try {
      const input =
        view === "content"
          ? {
              objective,
              tone: option,
              language: "es",
              platforms: ["instagram", "facebook", "linkedin"],
              variantCount: 3,
              includeHashtags: true,
            }
          : view === "image"
            ? {
                objective,
                aspectRatio: option,
                quality: "medium",
                referenceAssetIds,
              }
            : view === "video"
              ? {
                  objective,
                  aspectRatio: option,
                  durationSeconds: 8,
                  referenceAssetIds,
                }
              : view === "repurpose"
                ? {
                    objective,
                    tone: option,
                    language: "es",
                    platforms: ["instagram", "tiktok", "email"],
                  }
                : { objective: "calidad", language: "es", platforms: [] }
      setRequest(
        await aiApi.createRequest({
          kind: view,
          prompt: brief.trim(),
          input,
          idempotencyKey: idempotencyKey(view),
        })
      )
      toast.success(t("jobQueued"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function uploadReferences(files: File[]) {
    const maximum = view === "video" ? 9 : 10
    const available = maximum - referenceAssetIds.length
    const selected = files.slice(0, available)
    if (!selected.length) {
      toast.error(t("referenceLimit", { max: maximum }))
      return
    }
    if (
      selected.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 30 * 1024 * 1024
      )
    ) {
      toast.error(t("invalidReference"))
      return
    }
    setPending(true)
    try {
      const uploadedIds = await Promise.all(
        selected.map(async (file) => {
          const upload = await filesApi.startUpload({
            name: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            folderId: null,
          })
          await filesApi.upload(upload.id, file)
          return upload.id
        })
      )
      setReferenceAssetIds((current) => [...current, ...uploadedIds])
      toast.success(
        uploadedIds.length === 1
          ? t("referenceAdded")
          : t("referencesAdded", { count: uploadedIds.length })
      )
    } catch {
      toast.error(t("referenceFailed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Badge variant="warning">
            <Coins data-icon="inline-start" /> {t("cost", { count: costUnits })}
          </Badge>
        }
        view={view}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t(creationTitleKey(view))}</CardTitle>
              <CardDescription>{t("sensitiveDataHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${view}-brief`}>
                    {t("brief")} <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    id={`${view}-brief`}
                    onChange={(event) => setBrief(event.target.value)}
                    placeholder={t(
                      `${view}.placeholder` as "content.placeholder"
                    )}
                    rows={7}
                    value={brief}
                  />
                  <FieldDescription>
                    {brief.length}/2.000 caracteres
                  </FieldDescription>
                </Field>
                {view !== "review" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>
                        {t("goalLabel")} <RequiredMark />
                      </FieldLabel>
                      <Select value={objective} onValueChange={setObjective}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="engagement">
                              {t("goal.engagement")}
                            </SelectItem>
                            <SelectItem value="sales">
                              {t("goalSales")}
                            </SelectItem>
                            <SelectItem value="inform">
                              {t("objective.inform")}
                            </SelectItem>
                            <SelectItem value="adaptar">
                              {t("goalAdapt")}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>
                        {isMedia ? t("format") : t("tone")} <RequiredMark />
                      </FieldLabel>
                      <Select value={option} onValueChange={setOption}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {isMedia ? (
                              <>
                                <SelectItem value="1:1">
                                  {t("ratioSquare")}
                                </SelectItem>
                                <SelectItem value="9:16">
                                  {t("ratioVertical")}
                                </SelectItem>
                                <SelectItem value="16:9">
                                  {t("ratioHorizontal")}
                                </SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="cercano">
                                  {t("tones.cercano")}
                                </SelectItem>
                                <SelectItem value="experto">
                                  {t("tones.experto")}
                                </SelectItem>
                                <SelectItem value="directo">
                                  {t("tones.directo")}
                                </SelectItem>
                              </>
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                ) : null}
                {isMedia ? (
                  <div className="rounded-lg border border-dashed p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                        <Upload className="size-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {t("addReferences")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {view === "video"
                            ? t("referenceHintVideo")
                            : t("referenceHintImage")}
                        </p>
                      </div>
                      <Button
                        onClick={() => fileInput.current?.click()}
                        size="sm"
                        type="button"
                        variant="brand-secondary"
                      >
                        <Upload data-icon="inline-start" />{" "}
                        {referenceAssetIds.length
                          ? t("addMore", { count: referenceAssetIds.length })
                          : t("select")}
                      </Button>
                      <input
                        ref={fileInput}
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? [])
                          if (files.length) void uploadReferences(files)
                          event.target.value = ""
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button disabled={!brief.trim() || pending} type="submit">
              {pending ? (
                <Spinner
                  aria-label={t("generating")}
                  data-icon="inline-start"
                />
              ) : (
                <WandSparkles data-icon="inline-start" />
              )}
              {t(`${view}.button` as "content.button")}
            </Button>
          </div>
        </form>

        <Card variant="subtle">
          <CardHeader>
            <CardTitle>
              {t(`${view}.resultTitle` as "content.resultTitle")}
            </CardTitle>
            <CardDescription>
              {t(`${view}.resultDescription` as "content.resultDescription")}
            </CardDescription>
            {request ? (
              <CardAction>
                <StatusBadge status={request.status} />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {request?.status === "succeeded" ? (
              <CreationResult view={view} request={request} />
            ) : request?.status === "failed" ? (
              <EmptyState
                icon={CircleAlert}
                title={t("generationFailed")}
                description={request.errorCode ?? t("providerFailed")}
              />
            ) : request ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3">
                <Progress className="max-w-sm" value={request.progress} />
                <p className="text-sm text-muted-foreground">
                  {request.status === "queued"
                    ? t("waiting")
                    : t("generatingResult")}{" "}
                  · {request.progress}%
                </p>
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {t("resultPlaceholder")}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {t("resultPlaceholderHint")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Planner() {
  const apiErrorMessage = useApiErrorMessage()
  const t = useTranslations("aiStudio.pages")
  const tOps = useTranslations("aiStudio.operations")
  const [goal, setGoal] = useState("")
  const [durationDays, setDurationDays] = useState("7")
  const [frequency, setFrequency] = useState("4")
  const [request, setRequest] = usePolledRequest()
  const [pending, setPending] = useState(false)
  const result = request?.result as
    | {
        items?: Array<{
          date: string
          idea: string
          platform: string
          format: string
        }>
      }
    | undefined
  const ideas = result?.items ?? []
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(ideas.length / AI_TABLE_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleIdeas = ideas.slice(
    (currentPage - 1) * AI_TABLE_PAGE_SIZE,
    currentPage * AI_TABLE_PAGE_SIZE
  )

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!goal.trim()) return toast.error(t("planner.missingGoal"))
    setPending(true)
    try {
      setRequest(
        await aiApi.createRequest({
          kind: "planner",
          prompt: goal.trim(),
          input: {
            durationDays: Number(durationDays),
            frequencyPerWeek: Number(frequency),
            platforms: ["instagram", "facebook", "tiktok"],
          },
          idempotencyKey: idempotencyKey("planner"),
        })
      )
      toast.success(t("planner.queued"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader view="planner" />
      <div className="grid items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <form className="flex flex-col gap-3" noValidate onSubmit={generate}>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t("planner.goalTitle")}</CardTitle>
              <CardDescription>{t("planner.goalDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="planner-goal">
                    {tOps("goal")}
                    <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    id="planner-goal"
                    onChange={(event) => setGoal(event.target.value)}
                    placeholder={t("planner.goalPlaceholder")}
                    rows={5}
                    value={goal}
                  />
                </Field>
                <Field>
                  <FieldLabel>
                    {t("planner.duration")} <RequiredMark />
                  </FieldLabel>
                  <Select value={durationDays} onValueChange={setDurationDays}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="7">
                          {t("planner.duration1Week")}
                        </SelectItem>
                        <SelectItem value="14">
                          {t("planner.duration2Weeks")}
                        </SelectItem>
                        <SelectItem value="31">
                          {t("planner.duration1Month")}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>
                    {tOps("frequency")}
                    <RequiredMark />
                  </FieldLabel>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="3">
                          {t("planner.frequency3")}
                        </SelectItem>
                        <SelectItem value="4">
                          {t("planner.frequency4")}
                        </SelectItem>
                        <SelectItem value="7">{t("planner.daily")}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="balance-formats">
                    {tOps("balanceFormats")}
                  </FieldLabel>
                  <Switch defaultChecked id="balance-formats" />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <Button
            className="ml-auto flex"
            disabled={!goal.trim() || pending}
            type="submit"
          >
            {pending ? (
              <Spinner
                aria-label={tOps("generating")}
                data-icon="inline-start"
              />
            ) : (
              <CalendarPlus data-icon="inline-start" />
            )}
            {t("generateNewPlan")}
          </Button>
        </form>
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>{t("planner.weeklyPlan")}</CardTitle>
            <CardDescription>
              {t("planner.weeklyPlanDescription")}
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">
                {t("planner.ideaCount", { count: ideas.length })}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0">
            {request?.status === "succeeded" ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("planner.suggestedDate")}</TableHead>
                      <TableHead>{tOps("ideaColumn")}</TableHead>
                      <TableHead className="hidden md:table-cell">
                        {tOps("channel")}
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {tOps("format")}
                      </TableHead>
                      <TableHead>{tOps("status")}</TableHead>
                      <TableHead className="text-right">
                        {t("actionColumn")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleIdeas.map((row) => (
                      <TableRow key={row.idea}>
                        <TableCell className="text-muted-foreground">
                          {row.date}
                        </TableCell>
                        <TableCell className="max-w-64 font-medium whitespace-normal">
                          {row.idea}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {row.platform}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {row.format}
                        </TableCell>
                        <TableCell>
                          <Badge variant="success">
                            {t("planner.ideaReady")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            aria-label={t("createContentFor", {
                              idea: row.idea,
                            })}
                            asChild
                            size="icon-sm"
                            variant="brand-secondary"
                          >
                            <Link href="/portal/ai-studio/ai-content">
                              <ChevronRight />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {ideas.length === 0 ? (
                      <TableEmptyRow
                        colSpan={6}
                        description={t("planner.emptyIdeasDescription")}
                        title={t("planner.emptyIdeasTitle")}
                      />
                    ) : null}
                  </TableBody>
                </Table>
                <TablePagination
                  canGoNext={currentPage < pageCount}
                  canGoPrevious={currentPage > 1}
                  itemLabel={tOps("ideasLabel")}
                  onNextPage={() => setPage(currentPage + 1)}
                  onPreviousPage={() => setPage(currentPage - 1)}
                  rangeEnd={Math.min(
                    currentPage * AI_TABLE_PAGE_SIZE,
                    ideas.length
                  )}
                  rangeStart={
                    ideas.length
                      ? (currentPage - 1) * AI_TABLE_PAGE_SIZE + 1
                      : 0
                  }
                  total={ideas.length}
                />
              </>
            ) : request ? (
              <div className="p-6">
                <Progress value={request.progress} />
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("planner.generating", { progress: request.progress })}
                </p>
              </div>
            ) : (
              <EmptyState
                icon={CalendarPlus}
                title={t("planner.emptyTitle")}
                description={t("planner.emptyDescription")}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const heatLevels = [
  "bg-primary/10",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/70",
  "bg-primary",
]
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

function Timing() {
  const apiErrorMessage = useApiErrorMessage()
  const t = useTranslations("aiStudio.pages")
  const [request, setRequest] = usePolledRequest()
  const [pending, setPending] = useState(false)
  const result = request?.result as
    | {
        timezone?: string
        sampleSize?: number
        recommendations?: Array<{
          weekday: number
          hour: number
          sampleCount: number
          confidence: "low" | "medium" | "high"
        }>
      }
    | undefined
  async function analyze() {
    setPending(true)
    try {
      setRequest(
        await aiApi.createRequest({
          kind: "timing",
          prompt: t("timing.prompt"),
          input: {
            socialAccountIds: [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            historyDays: 90,
          },
          idempotencyKey: idempotencyKey("timing"),
        })
      )
      toast.success(t("timing.queued"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Button
            disabled={pending}
            onClick={() => void analyze()}
            variant="brand-secondary"
          >
            {pending ? (
              <Spinner aria-label={t("analyzing")} data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            {t("refreshAnalysis")}
          </Button>
        }
        view="timing"
      />
      <Alert>
        <Clock3 />
        <AlertTitle>{t("timing.sampleWarning")}</AlertTitle>
        <AlertDescription>
          {t("timing.sampleWarningDescription")}
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>{t("timing.mapTitle")}</CardTitle>
            <CardDescription>{t("timing.mapDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[4rem_repeat(7,minmax(2.5rem,1fr))] gap-1 text-center text-xs">
                <span />
                {weekdays.map((day) => (
                  <span className="py-1 text-muted-foreground" key={day}>
                    {day}
                  </span>
                ))}
                {["08:00", "12:00", "16:00", "18:00", "20:00"].map((time) => [
                  <span
                    className="flex items-center text-muted-foreground"
                    key={`${time}-label`}
                  >
                    {time}
                  </span>,
                  ...weekdays.map((day, column) => (
                    <div
                      className={`h-10 rounded-md ${heatLevels[Math.min(4, result?.recommendations?.filter((item) => item.weekday === (column + 1) % 7 && Math.abs(item.hour - Number(time.slice(0, 2))) <= 1).length ?? 0)]}`}
                      key={`${time}-${day}`}
                      title={`${day} ${time}`}
                    />
                  )),
                ])}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>{t("timing.lowOpportunity")}</span>
              {heatLevels.map((level) => (
                <span className={`size-3 rounded-sm ${level}`} key={level} />
              ))}
              <span>{t("timing.highOpportunity")}</span>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>{t("timing.perAccount")}</CardTitle>
            <CardDescription>
              {t("timing.perAccountDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(result?.recommendations ?? []).map((row) => (
              <div
                className="rounded-lg border p-3"
                key={`${row.weekday}-${row.hour}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {weekdays[(row.weekday + 6) % 7]} ·{" "}
                      {String(row.hour).padStart(2, "0")}:00
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("timing.sampleCount", { count: row.sampleCount })}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {t(`timing.confidence.${row.confidence}`)}
                  </Badge>
                </div>
              </div>
            ))}
            {!request ? (
              <EmptyState
                icon={Clock3}
                title={t("timing.emptyTitle")}
                description={t("timing.emptyDescription")}
              />
            ) : request.status !== "succeeded" ? (
              <Progress value={request.progress} />
            ) : result?.recommendations?.length === 0 ? (
              <EmptyState
                icon={Clock3}
                title={t("timing.insufficientSample")}
                description={t("timing.sampleFound", {
                  count: result.sampleSize ?? 0,
                })}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Research() {
  const apiErrorMessage = useApiErrorMessage()
  const t = useTranslations("aiStudio.pages")
  const [query, setQuery] = useState("")
  const [request, setRequest] = usePolledRequest()
  const [pending, setPending] = useState(false)
  const result = request?.result as
    | {
        mode?: string
        results?: Array<{
          id: string
          type: string
          title: string | null
          excerpt: string
          score: number | null
        }>
      }
    | undefined
  async function research() {
    if (!query.trim()) return
    setPending(true)
    try {
      setRequest(
        await aiApi.createRequest({
          kind: "search",
          prompt: query.trim(),
          input: { types: [], limit: 20 },
          idempotencyKey: idempotencyKey("search"),
        })
      )
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader view="search" />
      <Card variant="subtle">
        <CardHeader>
          <CardTitle>{t("research.title")}</CardTitle>
          <CardDescription>{t("research.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 md:flex-row">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label={t("research.topicLabel")}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("research.topicPlaceholder")}
                value={query}
              />
            </InputGroup>
            <Button
              disabled={!query.trim() || pending}
              onClick={() => void research()}
            >
              <FileSearch data-icon="inline-start" />
              {t("researchAction")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_20rem]">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>{t("research.findings")}</CardTitle>
            <CardDescription>
              {t("research.findingsDescription")}
            </CardDescription>
            <CardAction>
              <Button size="sm" variant="brand-secondary">
                <ListFilter data-icon="inline-start" />
                {t("filter")}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(result?.results ?? []).map((item) => (
              <div className="rounded-lg border p-4" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Badge variant="secondary">{item.type}</Badge>
                    <h3 className="mt-2 font-medium">
                      {item.title ?? t("research.untitled")}
                    </h3>
                  </div>
                  {item.score !== null ? (
                    <Badge variant="secondary">
                      {t("research.relevance", {
                        score: Math.round(item.score * 100),
                      })}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.excerpt}
                </p>
                <div className="mt-3 flex justify-end">
                  <Button asChild size="sm" variant="brand-secondary">
                    <Link href="/portal/ai-studio/ai-content">
                      <WandSparkles data-icon="inline-start" />
                      {t("createContent")}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
            {!request ? (
              <EmptyState
                icon={FileSearch}
                title={t("research.emptyTitle")}
                description={t("research.emptyDescription")}
              />
            ) : request.status !== "succeeded" ? (
              <Progress value={request.progress} />
            ) : result?.results?.length === 0 ? (
              <EmptyState
                icon={FileSearch}
                title={t("research.noMatchesTitle")}
                description={t("research.noMatchesDescription")}
              />
            ) : null}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t("research.questions")}</CardTitle>
              <CardDescription>
                {t("research.questionsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(result?.results ?? []).slice(0, 4).map((item) => (
                <button
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm hover:bg-muted/50"
                  key={item.id}
                  onClick={() =>
                    setQuery(item.title ?? item.excerpt.slice(0, 80))
                  }
                  type="button"
                >
                  <span>{item.title ?? item.excerpt.slice(0, 80)}</span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t("research.summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("research.scopeNotice")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function FunctionalSettings() {
  const apiErrorMessage = useApiErrorMessage()
  const t = useTranslations("aiStudio.pages")
  const tt = useTranslations("aiStudio.tools")
  const [settings, setSettings] = useState<PortalAiSettings | null>(null)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    void aiApi
      .getSettings()
      .then(setSettings)
      .catch((error) => toast.error(apiErrorMessage(errorCode(error))))
  }, [apiErrorMessage])
  if (!settings) return <PageLoading aria-label={t("settings.loading")} />
  const currentSettings = settings
  const safetyItems: Array<
    [
      string,
      "requireHumanReview" | "warnSensitiveClaims" | "redactPersonalData",
    ]
  > = [
    [t("settings.requireHumanReview"), "requireHumanReview"],
    [t("settings.warnSensitiveClaims"), "warnSensitiveClaims"],
    [t("settings.redactPersonalData"), "redactPersonalData"],
  ]
  async function save() {
    if (
      !currentSettings.brandName.trim() ||
      !currentSettings.brandDescription.trim() ||
      !currentSettings.brandPersonality.trim()
    )
      return toast.error(t("settings.missingFields"))
    setPending(true)
    try {
      setSettings(
        await aiApi.updateSettings({
          brandName: currentSettings.brandName,
          brandDescription: currentSettings.brandDescription,
          brandPersonality: currentSettings.brandPersonality,
          brandVoice: currentSettings.brandVoice,
          preferredWords: currentSettings.preferredWords,
          forbiddenWords: currentSettings.forbiddenWords,
          defaultTone: currentSettings.defaultTone,
          language: currentSettings.language,
          requireHumanReview: currentSettings.requireHumanReview,
          warnSensitiveClaims: currentSettings.warnSensitiveClaims,
          redactPersonalData: currentSettings.redactPersonalData,
        })
      )
      toast.success(t("settings.saved"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }
  const update = (patch: Partial<PortalAiSettings>) =>
    setSettings((current) => (current ? { ...current, ...patch } : current))
  return (
    <div className="flex flex-col gap-6">
      <StudioHeader view="settings" />
      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand">{t("settings.brandVoice")}</TabsTrigger>
          <TabsTrigger value="defaults">
            {t("settings.preferences")}
          </TabsTrigger>
          <TabsTrigger value="safety">{t("settings.safety")}</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="brand">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t("settings.brandIdentity")}</CardTitle>
              <CardDescription>
                {t("settings.brandIdentityDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>
                      {t("settings.brandName")} <RequiredMark />
                    </FieldLabel>
                    <Input
                      placeholder={t("settings.brandNamePlaceholder")}
                      value={settings.brandName}
                      onChange={(event) =>
                        update({ brandName: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>
                      {tt("personality")} <RequiredMark />
                    </FieldLabel>
                    <Input
                      placeholder={t("settings.brandPersonalityPlaceholder")}
                      value={settings.brandPersonality}
                      onChange={(event) =>
                        update({ brandPersonality: event.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>
                    {t("settings.brandDescription")} <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    placeholder={t("settings.brandDescriptionPlaceholder")}
                    rows={4}
                    value={settings.brandDescription}
                    onChange={(event) =>
                      update({ brandDescription: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("settings.brandVoice")}</FieldLabel>
                  <Textarea
                    placeholder={t("settings.brandVoicePlaceholder")}
                    rows={3}
                    value={settings.brandVoice}
                    onChange={(event) =>
                      update({ brandVoice: event.target.value })
                    }
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>{t("settings.wordsUse")}</FieldLabel>
                    <Input
                      placeholder={t("settings.wordsUsePlaceholder")}
                      value={settings.preferredWords.join(", ")}
                      onChange={(event) =>
                        update({
                          preferredWords: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("settings.wordsAvoid")}</FieldLabel>
                    <Input
                      placeholder={t("settings.wordsAvoidPlaceholder")}
                      value={settings.forbiddenWords.join(", ")}
                      onChange={(event) =>
                        update({
                          forbiddenWords: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent className="mt-4" value="defaults">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t("settings.defaults")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>{t("settings.language")}</FieldLabel>
                  <Select
                    value={settings.language}
                    onValueChange={(language) => update({ language })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">{tt("language.es")}</SelectItem>
                      <SelectItem value="en">{tt("language.en")}</SelectItem>
                      <SelectItem value="pt">{tt("language.pt")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>{t("settings.defaultTone")}</FieldLabel>
                  <Input
                    value={settings.defaultTone}
                    onChange={(event) =>
                      update({ defaultTone: event.target.value })
                    }
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent className="mt-4" value="safety">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t("settings.safetyControls")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {safetyItems.map(([label, key]) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={key}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={currentSettings[key]}
                    onCheckedChange={(checked) => update({ [key]: checked })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <div className="flex justify-end">
        <Button
          disabled={
            pending ||
            !settings.brandName.trim() ||
            !settings.brandDescription.trim() ||
            !settings.brandPersonality.trim()
          }
          onClick={() => void save()}
        >
          <Save data-icon="inline-start" /> {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

const AI_TABLE_PAGE_SIZE = 10

function OperationalHistory() {
  const t = useTranslations("aiStudio.pages")
  const tOps = useTranslations("aiStudio.operations")
  const format = useFormatter()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [kindFilter, setKindFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PortalAiRequestsResponse | null>(null)
  const [viewState, setViewState] = useState<AiOperationalViewState>("loading")
  const loadSequence = useRef(0)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setViewState("loading")

    try {
      const response = await aiApi.listRequests({
        kind: kindFilter === "all" ? undefined : (kindFilter as AiRequestKind),
        limit: AI_TABLE_PAGE_SIZE,
        page,
        search: query.trim() || undefined,
        status:
          statusFilter === "all"
            ? undefined
            : (statusFilter as PortalAiRequest["status"]),
      })

      if (sequence !== loadSequence.current) return
      if (page > 1 && response.total > 0 && response.requests.length === 0) {
        setPage((current) => Math.max(1, current - 1))
        return
      }

      setResult(response)
      setViewState("ready")
    } catch (error) {
      if (sequence !== loadSequence.current) return
      setResult(null)
      setViewState(aiLoadState(error))
    }
  }, [kindFilter, page, query, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const requestsById = useMemo(
    () =>
      new Map((result?.requests ?? []).map((request) => [request.id, request])),
    [result]
  )
  const rows = useMemo<AiHistoryRow[]>(
    () =>
      (result?.requests ?? []).map((request) => ({
        cost: `${request.costUnits} ${request.costUnits === 1 ? "crédito" : "créditos"}`,
        date: request.createdAt
          ? format.dateTime(new Date(request.createdAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "—",
        id: request.id,
        kind: tOps(`kind.${request.kind}`),
        status: request.status,
        subtitle: request.prompt.trim()
          ? request.prompt.trim().slice(0, 72)
          : t("operational.noPrompt"),
        title: request.title,
      })),
    [format, result, t, tOps]
  )
  const hasFilters = Boolean(
    query.trim() || statusFilter !== "all" || kindFilter !== "all"
  )

  function exportHistory() {
    if (!result?.requests.length)
      return toast.info(t("operational.nothingToExport"))

    const csv = [
      "titulo,tipo,estado,creditos,fecha",
      ...result.requests.map((request) =>
        [
          request.title,
          tOps(`kind.${request.kind}`),
          request.status,
          request.costUnits,
          request.createdAt,
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n")
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "historial-ai.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AiHistorySurface
      action={
        <DownloadTableButton
          disabled={!result?.requests.length}
          label={t("operational.export")}
          onClick={exportHistory}
        />
      }
      hasFilters={hasFilters}
      kindFilter={kindFilter}
      onClearFilters={() => {
        setQuery("")
        setStatusFilter("all")
        setKindFilter("all")
        setPage(1)
      }}
      onKindFilterChange={(value) => {
        setKindFilter(value)
        setPage(1)
      }}
      onNextPage={() => setPage((current) => current + 1)}
      onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
      onQueryChange={(value) => {
        setQuery(value)
        setPage(1)
      }}
      onRetry={() => void load()}
      onStatusFilterChange={(value) => {
        setStatusFilter(value)
        setPage(1)
      }}
      page={page}
      pageSize={AI_TABLE_PAGE_SIZE}
      query={query}
      renderActions={(row) => {
        const request = requestsById.get(row.id)
        return request ? (
          <JobActions request={request} onChanged={() => void load()} />
        ) : null
      }}
      rows={rows}
      state={viewState}
      statusFilter={statusFilter}
      total={result?.total ?? 0}
    />
  )
}

function OperationalAutomation() {
  const apiErrorMessage = useApiErrorMessage()
  const t = useTranslations("aiStudio.pages")
  const format = useFormatter()
  const [schedules, setSchedules] = useState<PortalAiPublishingSchedule[]>([])
  const [accounts, setAccounts] = useState<PortalChannelAccount[]>([])
  const [viewState, setViewState] = useState<AiOperationalViewState>("loading")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [prompt, setPrompt] = useState("")
  const [time, setTime] = useState("09:00")
  const [accountId, setAccountId] = useState("")
  const [pendingCreate, setPendingCreate] = useState(false)
  const [busyRowId, setBusyRowId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AiAutomationRow | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)
  const [canManage, setCanManage] = useState(false)

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setViewState("loading")
    try {
      const [nextSchedules, channels, session] = await Promise.all([
        aiApi.listPublishingSchedules(),
        channelsApi.list({ limit: 50 }),
        authApi.session(),
      ])
      const connectedAccounts = channels.accounts.filter(
        (account) => account.status === "connected"
      )

      setSchedules(nextSchedules)
      setAccounts(connectedAccounts)
      setCanManage(
        session.area === "portal" && session.workspace.role !== "member"
      )
      setAccountId((current) =>
        connectedAccounts.some((account) => account.id === current)
          ? current
          : (connectedAccounts[0]?.id ?? "")
      )
      setViewState("ready")
    } catch (error) {
      setSchedules([])
      setAccounts([])
      setCanManage(false)
      setViewState(aiLoadState(error))
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const filteredSchedules = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return schedules.filter(
      (schedule) =>
        (!normalizedQuery ||
          `${schedule.name} ${schedule.prompt}`
            .toLocaleLowerCase("es")
            .includes(normalizedQuery)) &&
        (statusFilter === "all" || schedule.status === statusFilter)
    )
  }, [query, schedules, statusFilter])
  const visibleSchedules = filteredSchedules.slice(
    (page - 1) * AI_TABLE_PAGE_SIZE,
    page * AI_TABLE_PAGE_SIZE
  )
  const rows = useMemo<AiAutomationRow[]>(
    () =>
      visibleSchedules.map((schedule) => ({
        cadence: `${t(`operational.frequency.${schedule.frequency}`)} · ${schedule.preferredTime}`,
        id: schedule.id,
        name: schedule.name,
        nextRun: schedule.nextRunAt
          ? format.dateTime(new Date(schedule.nextRunAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "—",
        status: schedule.status,
      })),
    [format, t, visibleSchedules]
  )

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !prompt.trim() || !time || !accountId)
      return toast.error(t("operational.missingFields"))

    setPendingCreate(true)
    try {
      await aiApi.createPublishingSchedule({
        frequency: "daily",
        name: name.trim(),
        preferredTime: time,
        prompt: prompt.trim(),
        status: "active",
        targetSocialAccountIds: [accountId],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC",
        tone: "cercano",
        weekdays: [],
      })
      setName("")
      setPrompt("")
      setShowForm(false)
      setPage(1)
      await load(false)
      toast.success(t("operational.automationCreated"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPendingCreate(false)
    }
  }

  async function toggle(row: AiAutomationRow, checked: boolean) {
    setBusyRowId(row.id)
    try {
      await aiApi.updatePublishingSchedule(row.id, {
        status: checked ? "active" : "paused",
      })
      await load(false)
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setBusyRowId(null)
    }
  }

  async function run(row: AiAutomationRow) {
    setBusyRowId(row.id)
    try {
      await aiApi.runPublishingSchedule(row.id)
      toast.success(t("operational.runQueued"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setBusyRowId(null)
    }
  }

  async function remove() {
    if (!pendingDelete) return
    setDeleting(true)
    setBusyRowId(pendingDelete.id)
    try {
      await aiApi.removePublishingSchedule(pendingDelete.id)
      await load(false)
      setPage(1)
      setPendingDelete(null)
      toast.success(t("operational.automationDeleted"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setDeleting(false)
      setBusyRowId(null)
    }
  }

  return (
    <AiAutomationSurface
      accountId={accountId}
      accounts={accounts.map((account) => ({
        id: account.id,
        label: account.displayName,
      }))}
      busyRowId={busyRowId}
      canManage={canManage}
      deleting={deleting}
      formOpen={showForm}
      hasFilters={Boolean(query.trim() || statusFilter !== "all")}
      name={name}
      onAccountIdChange={setAccountId}
      onClearFilters={() => {
        setQuery("")
        setStatusFilter("all")
        setPage(1)
      }}
      onConfirmDelete={() => void remove()}
      onDeleteOpenChange={(open) => {
        if (!open && !deleting) setPendingDelete(null)
      }}
      onFormOpenChange={setShowForm}
      onNameChange={setName}
      onNextPage={() => setPage((current) => current + 1)}
      onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
      onPromptChange={setPrompt}
      onQueryChange={(value) => {
        setQuery(value)
        setPage(1)
      }}
      onRequestDelete={setPendingDelete}
      onRetry={() => void load()}
      onRun={(row) => void run(row)}
      onStatusFilterChange={(value) => {
        setStatusFilter(value)
        setPage(1)
      }}
      onSubmit={create}
      onTimeChange={setTime}
      onToggle={(row, checked) => void toggle(row, checked)}
      page={page}
      pageSize={AI_TABLE_PAGE_SIZE}
      pendingCreate={pendingCreate}
      pendingDelete={pendingDelete}
      prompt={prompt}
      query={query}
      rows={rows}
      state={viewState}
      statusFilter={statusFilter}
      time={time}
      total={filteredSchedules.length}
    />
  )
}

function OperationalCredits() {
  const apiErrorMessage = useApiErrorMessage()
  const t = useTranslations("aiStudio.pages")
  const format = useFormatter()
  const [credits, setCredits] = useState<PortalCreditsResponse | null>(null)
  const [viewState, setViewState] = useState<AiOperationalViewState>("loading")
  const [query, setQuery] = useState("")
  const [movementType, setMovementType] = useState("all")
  const [page, setPage] = useState(1)
  const [budget, setBudget] = useState("")
  const [alertPercent, setAlertPercent] = useState("80")
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [pendingBudget, setPendingBudget] = useState(false)
  const [budgetEditable, setBudgetEditable] = useState(true)

  const applyCredits = useCallback((next: PortalCreditsResponse) => {
    setCredits(next)
    setBudget(
      next.budget.monthlyMicrousd === null
        ? ""
        : String(next.budget.monthlyMicrousd / 1_000_000)
    )
    setAlertPercent(String(next.budget.alertPercent))
    setAlertsEnabled(next.budget.alertsEnabled)
  }, [])

  const load = useCallback(async () => {
    setViewState("loading")
    try {
      const [nextCredits, session] = await Promise.all([
        aiApi.getCredits(),
        authApi.session(),
      ])
      applyCredits(nextCredits)
      setBudgetEditable(
        session.area === "portal" && session.workspace.role !== "member"
      )
      setViewState("ready")
    } catch (error) {
      setCredits(null)
      setViewState(aiLoadState(error))
    }
  }, [applyCredits])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return (credits?.entries ?? []).filter(
      (entry) =>
        (!normalizedQuery ||
          `${entry.action} ${entry.type}`
            .toLocaleLowerCase("es")
            .includes(normalizedQuery)) &&
        (movementType === "all" || entry.type === movementType)
    )
  }, [credits, movementType, query])
  const visibleEntries = filteredEntries.slice(
    (page - 1) * AI_TABLE_PAGE_SIZE,
    page * AI_TABLE_PAGE_SIZE
  )
  const movements = useMemo<AiCreditMovementRow[]>(
    () =>
      visibleEntries.map((entry) => ({
        credits: entry.units > 0 ? `+${entry.units}` : String(entry.units),
        date: entry.createdAt
          ? format.dateTime(new Date(entry.createdAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "—",
        detail: entry.action,
        id: entry.id,
        type: entry.type,
      })),
    [format, visibleEntries]
  )

  async function saveBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAlert = Number(alertPercent)
    const parsedBudget = Number(budget)

    if (
      !alertPercent.trim() ||
      !Number.isFinite(parsedAlert) ||
      parsedAlert < 1 ||
      parsedAlert > 100 ||
      (budget !== "" && (!Number.isFinite(parsedBudget) || parsedBudget < 0))
    ) {
      toast.error(t("operational.invalidBudget"))
      return
    }

    setPendingBudget(true)
    try {
      applyCredits(
        await aiApi.updateBudget({
          alertPercent: parsedAlert,
          alertsEnabled,
          monthlyMicrousd: budget.trim()
            ? Math.round(parsedBudget * 1_000_000)
            : null,
        })
      )
      toast.success(t("operational.budgetSaved"))
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setBudgetEditable(false)
        toast.error(t("operational.budgetForbidden"))
      } else {
        toast.error(apiErrorMessage(errorCode(error)))
      }
    } finally {
      setPendingBudget(false)
    }
  }

  function exportLedger() {
    if (!filteredEntries.length) return toast.info(t("operational.noMovements"))

    const csv = [
      "fecha,tipo,accion,creditos",
      ...filteredEntries.map((entry) =>
        [entry.createdAt, entry.type, entry.action, entry.units]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n")
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "creditos-ai.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AiCreditsSurface
      alertPercent={alertPercent}
      alertsEnabled={alertsEnabled}
      budget={budget}
      budgetEditable={budgetEditable}
      hasFilters={Boolean(query.trim() || movementType !== "all")}
      movementType={movementType}
      movements={movements}
      onAlertPercentChange={setAlertPercent}
      onAlertsEnabledChange={setAlertsEnabled}
      onBudgetChange={setBudget}
      onClearFilters={() => {
        setQuery("")
        setMovementType("all")
        setPage(1)
      }}
      onMovementTypeChange={(value) => {
        setMovementType(value)
        setPage(1)
      }}
      onNextPage={() => setPage((current) => current + 1)}
      onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
      onQueryChange={(value) => {
        setQuery(value)
        setPage(1)
      }}
      onRetry={() => void load()}
      onSaveBudget={saveBudget}
      page={page}
      pageSize={AI_TABLE_PAGE_SIZE}
      pendingBudget={pendingBudget}
      query={query}
      state={viewState}
      tableAction={
        <DownloadTableButton
          disabled={!filteredEntries.length}
          label={t("operational.download")}
          onClick={exportLedger}
        />
      }
      total={filteredEntries.length}
    />
  )
}

export function AiStudio({ view }: { view: AiStudioView }) {
  if (view === "overview") return <Overview />
  if (
    view === "content" ||
    view === "image" ||
    view === "video" ||
    view === "repurpose" ||
    view === "review"
  )
    return <CreationWorkspace view={view} />
  if (view === "planner") return <Planner />
  if (view === "timing") return <Timing />
  if (view === "search") return <Research />
  if (view === "history") return <OperationalHistory />
  if (view === "automation") return <OperationalAutomation />
  if (view === "settings") return <FunctionalSettings />
  if (view === "credits") return <OperationalCredits />
  return <Overview />
}
