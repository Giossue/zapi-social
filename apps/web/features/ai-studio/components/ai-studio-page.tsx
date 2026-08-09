"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import Link from "next/link"
import { aiApi, ApiError, channelsApi, filesApi } from "@workspace/api-client"
import type {
  AiRequestKind,
  PortalAiDashboard,
  PortalAiPublishingSchedule,
  PortalAiRequest,
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
  Ellipsis,
  Eye,
  FileSearch,
  Filter,
  ListFilter,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { PageLoading } from "@workspace/ui/components/page-loading"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import {
  type AiStudioView,
  automations,
  creditRows,
  studioDestinations,
} from "@/features/ai-studio/fixtures/ai-studio"

const pageCopy: Record<AiStudioView, { description: string; title: string }> = {
  automation: {
    description:
      "Crea reglas que investigan, generan y dejan borradores listos para revisión.",
    title: "Automatizaciones",
  },
  content: {
    description:
      "Genera publicaciones consistentes con tu voz de marca y cada canal.",
    title: "Contenido con IA",
  },
  credits: {
    description:
      "Entiende el consumo de IA y controla el presupuesto de tu espacio de trabajo.",
    title: "Créditos y consumo",
  },
  history: {
    description:
      "Encuentra, reutiliza y descarga cualquier generación anterior.",
    title: "Historial de IA",
  },
  image: {
    description:
      "Crea piezas visuales desde una idea, una referencia o una campaña.",
    title: "Generador de imágenes",
  },
  overview: {
    description: "Crea, investiga y mejora contenido desde un solo lugar.",
    title: "AI Studio",
  },
  planner: {
    description:
      "Convierte un objetivo en un plan editorial equilibrado y listo para producir.",
    title: "Planificador inteligente",
  },
  repurpose: {
    description:
      "Transforma una pieza existente en variantes nativas para cada red.",
    title: "Reutilizar contenido",
  },
  review: {
    description:
      "Detecta problemas de claridad, marca, cumplimiento y rendimiento antes de publicar.",
    title: "Revisión inteligente",
  },
  search: {
    description:
      "Explora tendencias, preguntas e ideas con señales útiles para crear contenido.",
    title: "Investigación asistida",
  },
  settings: {
    description:
      "Define la voz, el idioma y las reglas que guían todas las generaciones.",
    title: "Configuración de IA",
  },
  timing: {
    description:
      "Descubre cuándo publicar según el rendimiento real de tus cuentas.",
    title: "Mejor hora para publicar",
  },
  video: {
    description:
      "Diseña el guion, las escenas y el clip final sin salir del flujo de trabajo.",
    title: "Generador de video",
  },
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function aiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "AI_PROVIDER_NOT_READY")
      return "El administrador todavía no habilitó un modelo para esta herramienta."
    if (error.code === "AI_CREDITS_INSUFFICIENT")
      return "No hay créditos suficientes para iniciar esta generación."
    if (error.code === "AI_REQUEST_RATE_LIMITED")
      return "Hay demasiadas solicitudes. Espera un momento e inténtalo otra vez."
  }
  return "No pudimos completar la operación."
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const requestKindLabels: Record<AiRequestKind, string> = {
  content: "Contenido",
  image: "Imagen",
  video: "Video",
  repurpose: "Reutilizar",
  planner: "Plan",
  review: "Revisión",
  timing: "Mejor hora",
  search: "Investigación",
  ai_publishing: "Publicación AI",
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
  const copy = pageCopy[view]

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {copy.description}
        </p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

function StatusBadge({ status }: { status: PortalAiRequest["status"] }) {
  const copy = {
    queued: "En cola",
    processing: "Procesando",
    succeeded: "Completado",
    failed: "Falló",
    cancelled: "Cancelado",
  }[status]
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
  async function retry() {
    try {
      await aiApi.retryRequest(request.id, {
        idempotencyKey: idempotencyKey("retry"),
      })
      toast.success("La generación volvió a la cola.")
      onChanged?.()
    } catch (error) {
      toast.error(aiErrorMessage(error))
    }
  }

  async function archive() {
    try {
      await aiApi.archiveRequest(request.id, { archived: true })
      toast.success("Generación archivada.")
      onChanged?.()
    } catch (error) {
      toast.error(aiErrorMessage(error))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Acciones para ${request.title}`}
          size="icon-sm"
          variant="brand-secondary"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() =>
              toast.info(
                request.result && Object.keys(request.result).length
                  ? JSON.stringify(request.result)
                  : "La generación todavía no tiene resultado."
              )
            }
          >
            <Eye />
            Vista previa
          </DropdownMenuItem>
          {request.status === "failed" || request.status === "cancelled" ? (
            <DropdownMenuItem onSelect={() => void retry()}>
              <Copy />
              Reintentar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void archive()} variant="destructive">
          <Trash2 />
          Archivar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function JobsTable({
  rows,
  onChanged,
}: {
  rows: PortalAiRequest[]
  onChanged?: () => void
}) {
  return (
    <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
      <TableHeader>
        <TableRow>
          <TableHead>Generación</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Consumo</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {row.id.slice(0, 8)}
                </p>
              </div>
            </TableCell>
            <TableCell>{requestKindLabels[row.kind]}</TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell>{row.costUnits} créditos</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(row.createdAt)}
            </TableCell>
            <TableCell className="text-right">
              <JobActions request={row} onChanged={onChanged} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Overview() {
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
    void load()
  }, [load])

  if (!dashboard) {
    if (!failed) return <PageLoading aria-label="Cargando AI Studio" />
    return (
      <Card variant="subtle">
        <EmptyState
          icon={CircleAlert}
          title="AI Studio no disponible"
          description="No pudimos cargar la actividad del espacio."
          action={
            <Button onClick={() => void load()} variant="brand-secondary">
              <RefreshCw data-icon="inline-start" /> Reintentar
            </Button>
          }
        />
      </Card>
    )
  }

  const metrics = [
    {
      label: "Créditos disponibles",
      value: dashboard.credits.unlimited
        ? "Sin límite"
        : String(dashboard.credits.balanceUnits),
      detail: `${dashboard.credits.usedUnits} usados en el ciclo`,
      icon: Coins,
    },
    {
      label: "Generaciones correctas",
      value: String(dashboard.counts.succeededThisCycle),
      detail: "Durante el ciclo actual",
      icon: Sparkles,
    },
    {
      label: "En proceso",
      value: String(dashboard.counts.queued + dashboard.counts.processing),
      detail: `${dashboard.counts.queued} en cola`,
      icon: Clock3,
    },
    {
      label: "Borradores creados",
      value: String(dashboard.counts.draftsThisCycle),
      detail: "Listos para revisión humana",
      icon: ShieldCheck,
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Button asChild>
            <Link href="/portal/ai-studio/ai-content">
              <WandSparkles data-icon="inline-start" />
              Crear contenido
            </Link>
          </Button>
        }
        view="overview"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card variant="subtle" key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardAction>
                <metric.icon className="size-4 text-muted-foreground" />
              </CardAction>
              <CardTitle className="text-2xl">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading font-medium">¿Qué quieres crear?</h2>
          <p className="text-sm text-muted-foreground">
            Elige una herramienta y parte de una estructura preparada.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        </div>
      </section>

      <Card variant="subtle">
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
          <CardDescription>
            Generaciones de este espacio de trabajo.
          </CardDescription>
          <CardAction>
            <Button asChild size="sm" variant="brand-secondary">
              <Link href="/portal/ai-studio/history">
                Ver historial <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {dashboard.recentRequests.length ? (
            <JobsTable
              rows={dashboard.recentRequests}
              onChanged={() => void load()}
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Aún no hay generaciones"
              description="Elige una herramienta para crear el primer resultado."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type CreationView = "content" | "image" | "video" | "repurpose" | "review"

const creationConfig: Record<
  CreationView,
  {
    button: string
    cost: string
    placeholder: string
    resultDescription: string
    resultTitle: string
  }
> = {
  content: {
    button: "Generar borradores",
    cost: "2 créditos",
    placeholder:
      "Ejemplo: anuncia el nuevo menú ejecutivo, disponible de lunes a viernes...",
    resultDescription: "Tres variantes adaptadas al canal seleccionado.",
    resultTitle: "Borradores generados",
  },
  image: {
    button: "Generar imágenes",
    cost: "4 créditos",
    placeholder:
      "Ejemplo: hamburguesa artesanal sobre mesa oscura, luz cálida, estilo editorial...",
    resultDescription: "Cuatro composiciones listas para revisar.",
    resultTitle: "Propuestas visuales",
  },
  repurpose: {
    button: "Crear variantes",
    cost: "2 créditos",
    placeholder:
      "Pega una publicación, artículo, transcripción o idea que ya tengas...",
    resultDescription: "La idea original adaptada sin perder su mensaje.",
    resultTitle: "Variantes por canal",
  },
  review: {
    button: "Analizar contenido",
    cost: "1 crédito",
    placeholder:
      "Pega aquí el contenido que quieres validar antes de publicarlo...",
    resultDescription: "Hallazgos priorizados y correcciones sugeridas.",
    resultTitle: "Informe de revisión",
  },
  video: {
    button: "Generar video",
    cost: "12 créditos",
    placeholder:
      "Ejemplo: video vertical de 15 segundos mostrando la preparación del producto...",
    resultDescription: "Guion, escenas y render dentro del mismo trabajo.",
    resultTitle: "Proyecto de video",
  },
}

function ContentResult({ request }: { request: PortalAiRequest }) {
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
              aria-label={`Copiar texto de ${variant.platform}`}
              onClick={() =>
                void navigator.clipboard
                  .writeText(variant.caption)
                  .then(() => toast.success("Texto copiado"))
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
            alt={`Propuesta ${index + 1}`}
            className="size-full object-cover"
            src={filesApi.previewUrl(asset.fileAssetId)}
          />
          <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              aria-label="Vista previa"
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
              aria-label="Descargar"
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
  const result = request.result as {
    fileAssetId?: string
    durationSeconds?: number
  }
  if (request.status === "queued" || request.status === "processing") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span>Render del video</span>
          <span className="text-muted-foreground">{request.progress}%</span>
        </div>
        <Progress value={request.progress} />
        <p className="text-xs text-muted-foreground">
          Puedes salir de esta página. El trabajo seguirá en segundo plano.
        </p>
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
            <Download data-icon="inline-start" /> Descargar video
          </a>
        </Button>
      ) : null}
    </div>
  )
}

function RepurposeResult({ request }: { request: PortalAiRequest }) {
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
                  .then(() => toast.success("Variante copiada"))
              }
              size="sm"
              variant="brand-secondary"
            >
              <Copy data-icon="inline-start" />
              Copiar
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
    ["Claridad", result.dimensions?.clarity],
    ["Voz de marca", result.dimensions?.brandVoice],
    ["Llamada a la acción", result.dimensions?.callToAction],
    ["Seguridad", result.dimensions?.safety],
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

function creationTitle(view: CreationView) {
  if (view === "repurpose") return "Contenido original"
  if (view === "review") return "Contenido para analizar"
  return "Describe lo que necesitas"
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
  const config = creationConfig[view]
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
      toast.error("Completa la instrucción para continuar.")
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
                  referenceAssetIds: referenceAssetIds.slice(0, 1),
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
      toast.success("Trabajo añadido a la cola.")
    } catch (error) {
      toast.error(aiErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function uploadReference(file: File) {
    setPending(true)
    try {
      const upload = await filesApi.startUpload({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        folderId: null,
      })
      await filesApi.upload(upload.id, file)
      setReferenceAssetIds([upload.id])
      toast.success("Referencia añadida.")
    } catch {
      toast.error("No pudimos subir la referencia.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Badge variant="warning">
            <Coins data-icon="inline-start" /> {config.cost}
          </Badge>
        }
        view={view}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{creationTitle(view)}</CardTitle>
              <CardDescription>
                La información sensible no debe incluirse en la instrucción.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${view}-brief`}>
                    Instrucción <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    id={`${view}-brief`}
                    onChange={(event) => setBrief(event.target.value)}
                    placeholder={config.placeholder}
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
                        Objetivo <RequiredMark />
                      </FieldLabel>
                      <Select value={objective} onValueChange={setObjective}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="engagement">
                              Generar interacción
                            </SelectItem>
                            <SelectItem value="sales">
                              Impulsar ventas
                            </SelectItem>
                            <SelectItem value="inform">Informar</SelectItem>
                            <SelectItem value="adaptar">
                              Adaptar a canales
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>
                        {isMedia ? "Formato" : "Tono"} <RequiredMark />
                      </FieldLabel>
                      <Select value={option} onValueChange={setOption}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {isMedia ? (
                              <>
                                {view === "image" ? (
                                  <SelectItem value="1:1">
                                    Cuadrado · 1:1
                                  </SelectItem>
                                ) : null}
                                <SelectItem value="9:16">
                                  Vertical · 9:16
                                </SelectItem>
                                <SelectItem value="16:9">
                                  Horizontal · 16:9
                                </SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="cercano">Cercano</SelectItem>
                                <SelectItem value="experto">Experto</SelectItem>
                                <SelectItem value="directo">Directo</SelectItem>
                              </>
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                ) : null}
                {view === "image" ? (
                  <div className="rounded-lg border border-dashed p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                        <Upload className="size-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Añadir referencia</p>
                        <p className="text-xs text-muted-foreground">
                          Imagen opcional para orientar estilo y composición.
                        </p>
                      </div>
                      <Button
                        onClick={() => fileInput.current?.click()}
                        size="sm"
                        type="button"
                        variant="brand-secondary"
                      >
                        <Upload data-icon="inline-start" />{" "}
                        {referenceAssetIds.length ? "Cambiar" : "Seleccionar"}
                      </Button>
                      <input
                        ref={fileInput}
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void uploadReference(file)
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
                <RefreshCw className="animate-spin" data-icon="inline-start" />
              ) : (
                <WandSparkles data-icon="inline-start" />
              )}
              {config.button}
            </Button>
          </div>
        </form>

        <Card variant="subtle">
          <CardHeader>
            <CardTitle>{config.resultTitle}</CardTitle>
            <CardDescription>{config.resultDescription}</CardDescription>
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
                title="La generación falló"
                description={
                  request.errorCode ??
                  "El proveedor no pudo completar el trabajo."
                }
              />
            ) : request ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3">
                <Progress className="max-w-sm" value={request.progress} />
                <p className="text-sm text-muted-foreground">
                  {request.status === "queued"
                    ? "Esperando turno"
                    : "Generando resultado"}{" "}
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
                    Aquí aparecerá el resultado
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Completa la instrucción y genera una primera versión.
                    Después podrás editarla o crear alternativas.
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

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!goal.trim()) return toast.error("Completa el objetivo del plan.")
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
      toast.success("Plan añadido a la cola.")
    } catch (error) {
      toast.error(aiErrorMessage(error))
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
              <CardTitle>Objetivo del plan</CardTitle>
              <CardDescription>
                Define el resultado y la frecuencia deseada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="planner-goal">
                    Objetivo <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    id="planner-goal"
                    onChange={(event) => setGoal(event.target.value)}
                    placeholder="Ejemplo: aumentar visitas al local durante agosto..."
                    rows={5}
                    value={goal}
                  />
                </Field>
                <Field>
                  <FieldLabel>
                    Duración <RequiredMark />
                  </FieldLabel>
                  <Select value={durationDays} onValueChange={setDurationDays}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="7">1 semana</SelectItem>
                        <SelectItem value="14">2 semanas</SelectItem>
                        <SelectItem value="31">1 mes</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>
                    Frecuencia <RequiredMark />
                  </FieldLabel>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="3">
                          3 publicaciones por semana
                        </SelectItem>
                        <SelectItem value="4">
                          4 publicaciones por semana
                        </SelectItem>
                        <SelectItem value="7">
                          Una publicación diaria
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="balance-formats">
                    Equilibrar formatos
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
              <RefreshCw className="animate-spin" data-icon="inline-start" />
            ) : (
              <CalendarPlus data-icon="inline-start" />
            )}
            Generar nuevo plan
          </Button>
        </form>
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Plan semanal</CardTitle>
            <CardDescription>
              Propuesta equilibrada por canal, formato y objetivo.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">
                {result?.items?.length ?? 0} ideas
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {request?.status === "succeeded" ? (
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha sugerida</TableHead>
                    <TableHead>Idea</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result?.items ?? []).map((row) => (
                    <TableRow key={row.idea}>
                      <TableCell className="text-muted-foreground">
                        {row.date}
                      </TableCell>
                      <TableCell className="max-w-64 font-medium whitespace-normal">
                        {row.idea}
                      </TableCell>
                      <TableCell>{row.platform}</TableCell>
                      <TableCell>{row.format}</TableCell>
                      <TableCell>
                        <Badge variant="success">Idea lista</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          aria-label={`Crear contenido para ${row.idea}`}
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
                </TableBody>
              </Table>
            ) : request ? (
              <div className="p-6">
                <Progress value={request.progress} />
                <p className="mt-2 text-sm text-muted-foreground">
                  Generando plan · {request.progress}%
                </p>
              </div>
            ) : (
              <EmptyState
                icon={CalendarPlus}
                title="Crea tu primer plan"
                description="Completa el objetivo y la frecuencia."
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
          prompt:
            "Analiza el historial de rendimiento y recomienda las mejores horas para publicar.",
          input: {
            socialAccountIds: [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            historyDays: 90,
          },
          idempotencyKey: idempotencyKey("timing"),
        })
      )
      toast.success("Análisis añadido a la cola.")
    } catch (error) {
      toast.error(aiErrorMessage(error))
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
            <RefreshCw
              className={pending ? "animate-spin" : undefined}
              data-icon="inline-start"
            />
            Actualizar análisis
          </Button>
        }
        view="timing"
      />
      <Alert>
        <Clock3 />
        <AlertTitle>Recomendación basada en una muestra</AlertTitle>
        <AlertDescription>
          Se analizan hasta 90 días. La confianza depende de la cantidad de
          publicaciones encontradas.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Mapa de oportunidades</CardTitle>
            <CardDescription>
              Más intensidad significa mayor probabilidad de rendimiento.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>Menor oportunidad</span>
              {heatLevels.map((level) => (
                <span className={`size-3 rounded-sm ${level}`} key={level} />
              ))}
              <span>Mayor oportunidad</span>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Recomendaciones por cuenta</CardTitle>
            <CardDescription>
              La mejor ventana próxima para cada audiencia.
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
                      {row.sampleCount} publicaciones en la muestra
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {row.confidence === "high"
                      ? "Alta"
                      : row.confidence === "medium"
                        ? "Media"
                        : "Baja"}
                  </Badge>
                </div>
              </div>
            ))}
            {!request ? (
              <EmptyState
                icon={Clock3}
                title="Aún no hay análisis"
                description="Pulsa Actualizar análisis para calcular horarios."
              />
            ) : request.status !== "succeeded" ? (
              <Progress value={request.progress} />
            ) : result?.recommendations?.length === 0 ? (
              <EmptyState
                icon={Clock3}
                title="Muestra insuficiente"
                description={`Se encontraron ${result.sampleSize ?? 0} publicaciones con datos útiles.`}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Research() {
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
      toast.error(aiErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader view="search" />
      <Card variant="subtle">
        <CardHeader>
          <CardTitle>Buscar señales</CardTitle>
          <CardDescription>
            Combina tendencias, formatos y preguntas frecuentes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 md:flex-row">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Tema para investigar"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tema, palabra clave o competidor..."
                value={query}
              />
            </InputGroup>
            <Button
              disabled={!query.trim() || pending}
              onClick={() => void research()}
            >
              <FileSearch data-icon="inline-start" />
              Investigar
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_20rem]">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Hallazgos destacados</CardTitle>
            <CardDescription>
              Resultados priorizados por relevancia y crecimiento.
            </CardDescription>
            <CardAction>
              <Button size="sm" variant="brand-secondary">
                <ListFilter data-icon="inline-start" />
                Filtrar
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
                      {item.title ?? "Sin título"}
                    </h3>
                  </div>
                  {item.score !== null ? (
                    <Badge variant="secondary">
                      {Math.round(item.score * 100)}% relevancia
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
                      Crear contenido
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
            {!request ? (
              <EmptyState
                icon={FileSearch}
                title="Busca dentro de tu contenido"
                description="Encuentra captions, borradores y generaciones anteriores."
              />
            ) : request.status !== "succeeded" ? (
              <Progress value={request.progress} />
            ) : result?.results?.length === 0 ? (
              <EmptyState
                icon={FileSearch}
                title="Sin coincidencias"
                description="Prueba con otras palabras."
              />
            ) : null}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Preguntas de la audiencia</CardTitle>
              <CardDescription>
                Ideas detectadas alrededor del tema.
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
              <CardTitle>Resumen IA</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                La búsqueda revisa contenido real de este espacio. No consulta
                tendencias externas ni inventa métricas.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function History() {
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<PortalAiRequest[] | null>(null)
  const load = useCallback(async () => {
    try {
      setRows(
        (
          await aiApi.listRequests({
            search: query.trim() || undefined,
            limit: 100,
          })
        ).requests
      )
    } catch (error) {
      toast.error(aiErrorMessage(error))
      setRows([])
    }
  }, [query])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  function exportHistory() {
    if (!rows?.length) return toast.info("No hay filas para exportar.")
    const csv = [
      "id,titulo,tipo,estado,creditos,fecha",
      ...rows.map((row) =>
        [row.id, row.title, row.kind, row.status, row.costUnits, row.createdAt]
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
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Button onClick={exportHistory} variant="brand-secondary">
            <Download data-icon="inline-start" />
            Exportar
          </Button>
        }
        view="history"
      />
      <Card variant="subtle">
        <CardHeader className="border-b">
          <CardTitle>Generaciones</CardTitle>
          <CardDescription>
            Todos los resultados creados por el equipo.
          </CardDescription>
          <CardAction className="flex gap-2">
            <InputGroup className="w-64">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Buscar generaciones"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar..."
                value={query}
              />
            </InputGroup>
            <Button
              aria-label="Filtrar historial"
              size="icon"
              variant="brand-secondary"
            >
              <Filter />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {rows === null ? (
            <PageLoading aria-label="Cargando historial" />
          ) : rows.length ? (
            <JobsTable rows={rows} onChanged={() => void load()} />
          ) : (
            <EmptyState
              icon={FileSearch}
              title="Sin generaciones"
              description="No encontramos resultados para esta búsqueda."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Automation() {
  const [rows, setRows] = useState(automations)

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Button
            onClick={() => toast.info("Asistente de automatización abierto")}
          >
            <Plus data-icon="inline-start" />
            Nueva automatización
          </Button>
        }
        view="automation"
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Reglas activas</CardTitle>
            <CardDescription>
              La IA crea borradores; una persona conserva la aprobación final.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Automatización</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Próxima ejecución</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.cadence}</TableCell>
                    <TableCell>{row.drafts}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.next}
                    </TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`Activar ${row.name}`}
                        checked={row.status}
                        onCheckedChange={(checked) =>
                          setRows((current) =>
                            current.map((item) =>
                              item.name === row.name
                                ? { ...item, status: checked }
                                : item
                            )
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={`Acciones para ${row.name}`}
                            size="icon-sm"
                            variant="brand-secondary"
                          >
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={() =>
                                toast.success("Ejecución simulada")
                              }
                            >
                              <Play />
                              Ejecutar ahora
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => toast.info("Editor abierto")}
                            >
                              <Settings2 />
                              Editar regla
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive">
                            <Trash2 />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Próximas ejecuciones</CardTitle>
              <CardDescription>Cola del espacio de trabajo.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {rows
                .filter((row) => row.status)
                .map((row) => (
                  <div className="flex items-start gap-3" key={row.name}>
                    <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-muted">
                      <Clock3 className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{row.next}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.name}
                      </p>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
          <Alert>
            <ShieldCheck />
            <AlertTitle>Aprobación humana activa</AlertTitle>
            <AlertDescription>
              Ninguna automatización publica directamente. Todos los resultados
              llegan como borrador.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}

function Settings() {
  const [brandName, setBrandName] = useState("Zapi Burger")
  const [description, setDescription] = useState(
    "Restaurante casual con productos artesanales, frescos y una comunicación cercana."
  )

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader view="settings" />
      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand">Voz de marca</TabsTrigger>
          <TabsTrigger value="defaults">Preferencias</TabsTrigger>
          <TabsTrigger value="safety">Seguridad</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="brand">
          <form
            className="flex flex-col gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              toast.success("Voz de marca guardada")
            }}
          >
            <Card variant="subtle">
              <CardHeader>
                <CardTitle>Identidad de la marca</CardTitle>
                <CardDescription>
                  La IA usará esta información en cada herramienta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="brand-name">
                        Nombre de marca <RequiredMark />
                      </FieldLabel>
                      <Input
                        id="brand-name"
                        onChange={(event) => setBrandName(event.target.value)}
                        value={brandName}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        Personalidad <RequiredMark />
                      </FieldLabel>
                      <Select defaultValue="friendly">
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="friendly">
                              Cercana y enérgica
                            </SelectItem>
                            <SelectItem value="premium">
                              Elegante y sobria
                            </SelectItem>
                            <SelectItem value="expert">
                              Experta y educativa
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="brand-description">
                      Descripción <RequiredMark />
                    </FieldLabel>
                    <Textarea
                      id="brand-description"
                      onChange={(event) => setDescription(event.target.value)}
                      rows={5}
                      value={description}
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Palabras que sí usamos</FieldLabel>
                      <Input defaultValue="fresco, artesanal, compartir, sabor" />
                    </Field>
                    <Field>
                      <FieldLabel>Palabras que evitamos</FieldLabel>
                      <Input defaultValue="barato, imperdible, el mejor" />
                    </Field>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button
                disabled={!brandName.trim() || !description.trim()}
                type="submit"
              >
                <Save data-icon="inline-start" />
                Guardar voz de marca
              </Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent className="mt-4" value="defaults">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Valores predeterminados</CardTitle>
              <CardDescription>
                Se aplican al abrir una herramienta nueva.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel>Idioma</FieldLabel>
                    <Select defaultValue="es">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">Inglés</SelectItem>
                          <SelectItem value="pt">Portugués</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Variante regional</FieldLabel>
                    <Select defaultValue="ec">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="ec">Ecuador</SelectItem>
                          <SelectItem value="mx">México</SelectItem>
                          <SelectItem value="es">España</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Longitud</FieldLabel>
                    <Select defaultValue="medium">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="short">Breve</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="long">Detallada</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent className="mt-4" value="safety">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Controles de seguridad</CardTitle>
              <CardDescription>
                Reglas del espacio de trabajo para reducir riesgo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {[
                [
                  "Solicitar revisión antes de publicar",
                  "Siempre enviar la salida de IA a borradores.",
                ],
                [
                  "Advertir sobre afirmaciones sensibles",
                  "Marcar salud, finanzas, garantías y comparaciones.",
                ],
                [
                  "Ocultar datos personales",
                  "Detectar información personal dentro de instrucciones.",
                ],
              ].map(([title, detail], index) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  key={title}
                >
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                  <Switch defaultChecked={index !== 2} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Credits() {
  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Button
            onClick={() => toast.info("Configuración de presupuesto simulada")}
          >
            <Settings2 data-icon="inline-start" />
            Configurar presupuesto
          </Button>
        }
        view="credits"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Saldo disponible", "84", "créditos"],
          ["Consumidos este mes", "37", "de 100 incluidos"],
          ["Presupuesto usado", "37%", "$18,50 estimados"],
          ["Próxima renovación", "1 sep", "100 créditos"],
        ].map(([label, value, detail]) => (
          <Card variant="subtle" key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
            <CardDescription>
              Consumo y recargas del periodo actual.
            </CardDescription>
            <CardAction>
              <Button size="sm" variant="brand-secondary">
                <Download data-icon="inline-start" />
                Descargar
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditRows.map((row) => (
                  <TableRow key={`${row.date}-${row.detail}`}>
                    <TableCell className="text-muted-foreground">
                      {row.date}
                    </TableCell>
                    <TableCell className="font-medium">{row.type}</TableCell>
                    <TableCell>{row.detail}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Presupuesto mensual</CardTitle>
              <CardDescription>
                Alerta antes de agotar el límite.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>$18,50 usados</span>
                  <span className="text-muted-foreground">de $50</span>
                </div>
                <Progress value={37} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Alerta al 80%</p>
                  <p className="text-xs text-muted-foreground">
                    Notificar administradores
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Costo por herramienta</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {[
                ["Texto y revisión", "1–2"],
                ["Imágenes", "4"],
                ["Video", "12"],
                ["Planificador", "3"],
              ].map(([tool, value]) => (
                <div
                  className="flex items-center justify-between text-sm"
                  key={tool}
                >
                  <span className="text-muted-foreground">{tool}</span>
                  <span className="font-medium">{value} créditos</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function FunctionalAutomation() {
  const [rows, setRows] = useState<PortalAiPublishingSchedule[] | null>(null)
  const [accounts, setAccounts] = useState<PortalChannelAccount[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [prompt, setPrompt] = useState("")
  const [time, setTime] = useState("09:00")
  const [accountId, setAccountId] = useState("")
  const [pending, setPending] = useState(false)
  const load = useCallback(async () => {
    try {
      const [schedules, channels] = await Promise.all([
        aiApi.listPublishingSchedules(),
        channelsApi.list({ limit: 50 }),
      ])
      setRows(schedules)
      setAccounts(
        channels.accounts.filter((account) => account.status === "connected")
      )
      setAccountId(
        (current) =>
          current ||
          channels.accounts.find((account) => account.status === "connected")
            ?.id ||
          ""
      )
    } catch (error) {
      toast.error(aiErrorMessage(error))
      setRows([])
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !prompt.trim() || !accountId)
      return toast.error("Completa nombre, instrucción y cuenta.")
    setPending(true)
    try {
      await aiApi.createPublishingSchedule({
        name: name.trim(),
        prompt: prompt.trim(),
        status: "active",
        frequency: "daily",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        preferredTime: time,
        weekdays: [],
        tone: "cercano",
        targetSocialAccountIds: [accountId],
      })
      setName("")
      setPrompt("")
      setShowForm(false)
      await load()
      toast.success("Automatización creada.")
    } catch (error) {
      toast.error(aiErrorMessage(error))
    } finally {
      setPending(false)
    }
  }
  async function toggle(row: PortalAiPublishingSchedule, checked: boolean) {
    try {
      await aiApi.updatePublishingSchedule(row.id, {
        status: checked ? "active" : "paused",
      })
      await load()
    } catch (error) {
      toast.error(aiErrorMessage(error))
    }
  }
  async function run(row: PortalAiPublishingSchedule) {
    try {
      await aiApi.runPublishingSchedule(row.id)
      toast.success("Ejecución añadida a la cola.")
    } catch (error) {
      toast.error(aiErrorMessage(error))
    }
  }
  async function remove(row: PortalAiPublishingSchedule) {
    try {
      await aiApi.removePublishingSchedule(row.id)
      await load()
      toast.success("Automatización eliminada.")
    } catch (error) {
      toast.error(aiErrorMessage(error))
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        actions={
          <Button onClick={() => setShowForm((value) => !value)}>
            <Plus data-icon="inline-start" /> Nueva automatización
          </Button>
        }
        view="automation"
      />
      {showForm ? (
        <form className="flex flex-col gap-3" noValidate onSubmit={create}>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Nueva automatización</CardTitle>
              <CardDescription>
                Generará borradores; nunca publicará sin revisión humana.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>
                      Nombre <RequiredMark />
                    </FieldLabel>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>
                      Hora <RequiredMark />
                    </FieldLabel>
                    <Input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>
                    Instrucción <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    rows={4}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>
                    Cuenta de destino <RequiredMark />
                  </FieldLabel>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button
              disabled={pending || !name.trim() || !prompt.trim() || !accountId}
              type="submit"
            >
              <Save data-icon="inline-start" /> Guardar automatización
            </Button>
          </div>
        </form>
      ) : null}
      <Card variant="subtle">
        <CardHeader>
          <CardTitle>Reglas activas</CardTitle>
          <CardDescription>
            La IA crea borradores; una persona conserva la aprobación final.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {rows === null ? (
            <PageLoading />
          ) : rows.length ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Automatización</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Próxima ejecución</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {row.frequency === "daily"
                        ? `Diario · ${row.preferredTime}`
                        : `Semanal · ${row.preferredTime}`}
                    </TableCell>
                    <TableCell>{formatDate(row.nextRunAt)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={row.status === "active"}
                        onCheckedChange={(checked) => void toggle(row, checked)}
                        aria-label={`Activar ${row.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="brand-secondary">
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => void run(row)}>
                            <Play /> Ejecutar ahora
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => void remove(row)}
                          >
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Aún no hay automatizaciones"
              description={
                accounts.length
                  ? "Crea una regla para producir borradores automáticamente."
                  : "Conecta primero una cuenta social para elegir un destino."
              }
            />
          )}
        </CardContent>
      </Card>
      <Alert>
        <ShieldCheck />
        <AlertTitle>Aprobación humana activa</AlertTitle>
        <AlertDescription>
          Ninguna automatización publica directamente. Todos los resultados
          llegan como borrador.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function FunctionalSettings() {
  const [settings, setSettings] = useState<PortalAiSettings | null>(null)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    void aiApi
      .getSettings()
      .then(setSettings)
      .catch((error) => toast.error(aiErrorMessage(error)))
  }, [])
  if (!settings)
    return <PageLoading aria-label="Cargando configuración de IA" />
  const currentSettings = settings
  const safetyItems: Array<
    [
      string,
      "requireHumanReview" | "warnSensitiveClaims" | "redactPersonalData",
    ]
  > = [
    ["Revisión antes de publicar", "requireHumanReview"],
    ["Advertir afirmaciones sensibles", "warnSensitiveClaims"],
    ["Ocultar datos personales", "redactPersonalData"],
  ]
  async function save() {
    if (
      !currentSettings.brandName.trim() ||
      !currentSettings.brandDescription.trim() ||
      !currentSettings.brandPersonality.trim()
    )
      return toast.error("Completa los campos obligatorios.")
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
      toast.success("Configuración de IA guardada.")
    } catch (error) {
      toast.error(aiErrorMessage(error))
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
          <TabsTrigger value="brand">Voz de marca</TabsTrigger>
          <TabsTrigger value="defaults">Preferencias</TabsTrigger>
          <TabsTrigger value="safety">Seguridad</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="brand">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Identidad de la marca</CardTitle>
              <CardDescription>
                La IA usará esta información en cada herramienta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>
                      Nombre de marca <RequiredMark />
                    </FieldLabel>
                    <Input
                      value={settings.brandName}
                      onChange={(event) =>
                        update({ brandName: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>
                      Personalidad <RequiredMark />
                    </FieldLabel>
                    <Input
                      value={settings.brandPersonality}
                      onChange={(event) =>
                        update({ brandPersonality: event.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>
                    Descripción <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    rows={4}
                    value={settings.brandDescription}
                    onChange={(event) =>
                      update({ brandDescription: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Voz de marca</FieldLabel>
                  <Textarea
                    rows={3}
                    value={settings.brandVoice}
                    onChange={(event) =>
                      update({ brandVoice: event.target.value })
                    }
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Palabras que sí usamos</FieldLabel>
                    <Input
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
                    <FieldLabel>Palabras que evitamos</FieldLabel>
                    <Input
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
              <CardTitle>Valores predeterminados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Idioma</FieldLabel>
                  <Select
                    value={settings.language}
                    onValueChange={(language) => update({ language })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">Inglés</SelectItem>
                      <SelectItem value="pt">Portugués</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Tono predeterminado</FieldLabel>
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
              <CardTitle>Controles de seguridad</CardTitle>
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
          <Save data-icon="inline-start" /> Guardar configuración
        </Button>
      </div>
    </div>
  )
}

function FunctionalCredits() {
  const [credits, setCredits] = useState<PortalCreditsResponse | null>(null)
  const [budget, setBudget] = useState("")
  const [alertPercent, setAlertPercent] = useState("80")
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const load = useCallback(async () => {
    try {
      const next = await aiApi.getCredits()
      setCredits(next)
      setBudget(
        next.budget.monthlyMicrousd === null
          ? ""
          : String(next.budget.monthlyMicrousd / 1_000_000)
      )
      setAlertPercent(String(next.budget.alertPercent))
      setAlertsEnabled(next.budget.alertsEnabled)
    } catch (error) {
      toast.error(aiErrorMessage(error))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  if (!credits) return <PageLoading aria-label="Cargando créditos" />
  const currentCredits = credits
  async function saveBudget() {
    try {
      setCredits(
        await aiApi.updateBudget({
          monthlyMicrousd: budget.trim()
            ? Math.round(Number(budget) * 1_000_000)
            : null,
          alertPercent: Number(alertPercent),
          alertsEnabled,
        })
      )
      toast.success("Presupuesto guardado.")
    } catch (error) {
      toast.error(aiErrorMessage(error))
    }
  }
  function exportLedger() {
    const csv = [
      "fecha,tipo,accion,creditos",
      ...currentCredits.entries.map((entry) =>
        [entry.createdAt, entry.type, entry.action, entry.units].join(",")
      ),
    ].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "creditos-ai.csv"
    link.click()
    URL.revokeObjectURL(url)
  }
  const kindCost = Object.fromEntries(
    credits.costs.map((item) => [item.kind, item.units])
  )
  return (
    <div className="flex flex-col gap-6">
      <StudioHeader view="credits" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          [
            "Saldo disponible",
            credits.unlimited ? "Sin límite" : String(credits.balanceUnits),
            "créditos",
          ],
          ["Consumidos", String(credits.usedUnits), "en el ciclo"],
          [
            "Próxima renovación",
            credits.cycleEndsAt ? formatDate(credits.cycleEndsAt) : "Sin fecha",
            "ciclo actual",
          ],
        ].map(([label, value, detail]) => (
          <Card variant="subtle" key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
            <CardAction>
              <Button
                size="sm"
                variant="brand-secondary"
                onClick={exportLedger}
              >
                <Download data-icon="inline-start" /> Descargar
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>{entry.type}</TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell className="text-right">{entry.units}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Presupuesto mensual</CardTitle>
              <CardDescription>
                Vacío significa sin límite monetario.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field>
                <FieldLabel>Límite USD</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Alerta al %</FieldLabel>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={alertPercent}
                  onChange={(event) => setAlertPercent(event.target.value)}
                />
              </Field>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Alertas activas</span>
                <Switch
                  checked={alertsEnabled}
                  onCheckedChange={setAlertsEnabled}
                />
              </div>
              <Button
                className="w-full"
                disabled={
                  Number(alertPercent) < 1 ||
                  Number(alertPercent) > 100 ||
                  (budget !== "" && Number(budget) < 0)
                }
                onClick={() => void saveBudget()}
              >
                <Save data-icon="inline-start" /> Guardar presupuesto
              </Button>
            </CardContent>
          </Card>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Costo por herramienta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(kindCost).map(([kind, cost]) => (
                <div className="flex justify-between text-sm" key={kind}>
                  <span className="text-muted-foreground">
                    {requestKindLabels[kind as AiRequestKind]}
                  </span>
                  <Badge variant="warning">{cost} créditos</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
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
  if (view === "history") return <History />
  if (view === "automation") return <FunctionalAutomation />
  if (view === "settings") return <FunctionalSettings />
  if (view === "credits") return <FunctionalCredits />
  return <Overview />
}
