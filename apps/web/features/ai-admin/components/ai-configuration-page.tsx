"use client"

import { adminAiApi, ApiError } from "@workspace/api-client"
import type {
  AdminAiConfiguration,
  AdminAiModel,
  AdminAiProviderKey,
  AdminAiRoute,
  AdminAiUsage,
  AiRequestKind,
  AiReasoningEffort,
} from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Switch } from "@workspace/ui/components/switch"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import {
  Activity,
  Circle,
  CircleAlert,
  CircleDollarSign,
  CircleX,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Route,
  Save,
  Settings2,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

const TABLE_PAGE_SIZE = 10

const kindLabels: Record<AiRequestKind, string> = {
  content: "Crear contenido",
  image: "Crear imagen",
  video: "Crear video",
  repurpose: "Reutilizar contenido",
  planner: "Planificador",
  review: "Revisión",
  timing: "Mejor horario",
  search: "Búsqueda inteligente",
  ai_publishing: "Publicación AI",
}

const reasoningLabels: Record<AiReasoningEffort, string> = {
  none: "Ninguno",
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  xhigh: "Muy alto",
  max: "Máximo",
}

type RouteShape = {
  capability: "text" | "image" | "video"
  internal: boolean
  media: boolean
  primaryModes: string[]
  referenceModes: string[]
}

function routeShape(kind: AiRequestKind): RouteShape {
  return {
    capability:
      kind === "image" ? "image" : kind === "video" ? "video" : "text",
    internal: kind === "timing" || kind === "search",
    media: kind === "image" || kind === "video",
    primaryModes: kind === "image" ? ["text-to-image"] : ["text-to-video"],
    referenceModes:
      kind === "image"
        ? ["image-to-image"]
        : ["image-to-video", "reference-to-video"],
  }
}

const capabilityLabels = {
  text: "Texto",
  image: "Imagen",
  video: "Video",
} as const

const tierLabels = {
  quality: "Máxima calidad",
  balanced: "Equilibrado",
  economy: "Económico",
  specialized: "Especializado",
} as const

const readinessCopy = {
  ready: { icon: CheckCircle2, label: "Listo", variant: "success" as const },
  disabled: {
    icon: Circle,
    label: "Deshabilitado",
    variant: "neutral" as const,
  },
  incomplete: {
    icon: CircleAlert,
    label: "Incompleto",
    variant: "warning" as const,
  },
  untested: {
    icon: CircleAlert,
    label: "Sin probar",
    variant: "warning" as const,
  },
  error: { icon: CircleX, label: "Error", variant: "destructive" as const },
}

type ProviderDraft = {
  apiKey: string
  enabled: boolean
  tested: boolean
}

const emptyProviderDrafts: Record<AdminAiProviderKey, ProviderDraft> = {
  openai: { apiKey: "", enabled: false, tested: false },
  atlascloud: { apiKey: "", enabled: false, tested: false },
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "AI_PROVIDER_CONFIGURATION_INVALID") {
      return "La clave no es válida o todavía no fue probada."
    }
    if (error.code === "AI_MODEL_ROUTE_INVALID") {
      return "La ruta usa un modelo incompatible, deshabilitado o obsoleto."
    }
  }
  return "No pudimos completar la operación."
}

function money(microusd: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(microusd / 1_000_000)
}

function number(value: number) {
  return new Intl.NumberFormat("es-EC").format(value)
}

export function AiConfigurationPage() {
  const [configuration, setConfiguration] =
    useState<AdminAiConfiguration | null>(null)
  const [usage, setUsage] = useState<AdminAiUsage | null>(null)
  const [providerDrafts, setProviderDrafts] = useState(emptyProviderDrafts)
  const [pending, setPending] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [usageError, setUsageError] = useState(false)
  const [modelQuery, setModelQuery] = useState("")
  const [modelProviderFilter, setModelProviderFilter] = useState("all")
  const [modelCapabilityFilter, setModelCapabilityFilter] = useState("all")
  const [modelEnabledFilter, setModelEnabledFilter] = useState("all")
  const [modelPage, setModelPage] = useState(1)
  const [routeQuery, setRouteQuery] = useState("")
  const [routeCapabilityFilter, setRouteCapabilityFilter] = useState("all")
  const [routeStatusFilter, setRouteStatusFilter] = useState("all")
  const [routePage, setRoutePage] = useState(1)
  const [editingRouteKind, setEditingRouteKind] =
    useState<AiRequestKind | null>(null)

  const hasModelFilters = Boolean(
    modelQuery.trim() ||
    modelProviderFilter !== "all" ||
    modelCapabilityFilter !== "all" ||
    modelEnabledFilter !== "all"
  )
  const filteredModels = useMemo(() => {
    const normalized = modelQuery.trim().toLocaleLowerCase("es")
    return (configuration?.models ?? []).filter((model) => {
      if (
        modelProviderFilter !== "all" &&
        model.providerKey !== modelProviderFilter
      )
        return false
      if (
        modelCapabilityFilter !== "all" &&
        model.capability !== modelCapabilityFilter
      )
        return false
      if (
        modelEnabledFilter !== "all" &&
        model.enabled !== (modelEnabledFilter === "enabled")
      )
        return false
      if (!normalized) return true
      return [
        model.label,
        model.modelId,
        model.providerKey,
        model.capability,
      ].some((value) => value.toLocaleLowerCase("es").includes(normalized))
    })
  }, [
    configuration?.models,
    modelCapabilityFilter,
    modelEnabledFilter,
    modelProviderFilter,
    modelQuery,
  ])
  const modelPageCount = Math.max(
    1,
    Math.ceil(filteredModels.length / TABLE_PAGE_SIZE)
  )
  const safeModelPage = Math.min(modelPage, modelPageCount)
  const visibleModels = filteredModels.slice(
    (safeModelPage - 1) * TABLE_PAGE_SIZE,
    safeModelPage * TABLE_PAGE_SIZE
  )
  const modelRangeStart = filteredModels.length
    ? (safeModelPage - 1) * TABLE_PAGE_SIZE + 1
    : 0
  const modelRangeEnd = filteredModels.length
    ? modelRangeStart + visibleModels.length - 1
    : 0

  const hasRouteFilters = Boolean(
    routeQuery.trim() ||
    routeCapabilityFilter !== "all" ||
    routeStatusFilter !== "all"
  )
  const filteredRoutes = useMemo(() => {
    const normalized = routeQuery.trim().toLocaleLowerCase("es")
    return (configuration?.routes ?? []).filter((route) => {
      if (
        routeCapabilityFilter !== "all" &&
        routeShape(route.kind).capability !== routeCapabilityFilter
      )
        return false
      if (
        routeStatusFilter !== "all" &&
        route.enabled !== (routeStatusFilter === "enabled")
      )
        return false
      if (!normalized) return true
      return kindLabels[route.kind].toLocaleLowerCase("es").includes(normalized)
    })
  }, [
    configuration?.routes,
    routeCapabilityFilter,
    routeQuery,
    routeStatusFilter,
  ])
  const routePageCount = Math.max(
    1,
    Math.ceil(filteredRoutes.length / TABLE_PAGE_SIZE)
  )
  const safeRoutePage = Math.min(routePage, routePageCount)
  const visibleRoutes = filteredRoutes.slice(
    (safeRoutePage - 1) * TABLE_PAGE_SIZE,
    safeRoutePage * TABLE_PAGE_SIZE
  )
  const routeRangeStart = filteredRoutes.length
    ? (safeRoutePage - 1) * TABLE_PAGE_SIZE + 1
    : 0
  const routeRangeEnd = filteredRoutes.length
    ? routeRangeStart + visibleRoutes.length - 1
    : 0

  const load = useCallback(async () => {
    setLoadError(false)
    setForbidden(false)
    setUsageError(false)
    try {
      const nextConfiguration = await adminAiApi.configuration()
      setConfiguration(nextConfiguration)
      setProviderDrafts((current) => ({
        openai: {
          ...current.openai,
          enabled:
            nextConfiguration.providers.find(
              (provider) => provider.providerKey === "openai"
            )?.enabled ?? false,
        },
        atlascloud: {
          ...current.atlascloud,
          enabled:
            nextConfiguration.providers.find(
              (provider) => provider.providerKey === "atlascloud"
            )?.enabled ?? false,
        },
      }))
    } catch (error) {
      setForbidden(error instanceof ApiError && error.status === 403)
      setLoadError(true)
      setConfiguration(null)
      setUsage(null)
      return
    }

    try {
      setUsage(await adminAiApi.usage(30))
    } catch {
      setUsage(null)
      setUsageError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function testProvider(providerKey: AdminAiProviderKey) {
    if (!configuration) return
    const provider = configuration.providers.find(
      (candidate) => candidate.providerKey === providerKey
    )
    const draft = providerDrafts[providerKey]
    if (!provider?.apiKeyConfigured && draft.apiKey.trim().length < 20) {
      toast.error(
        `Ingresa una clave de ${provider?.label ?? "proveedor"} válida.`
      )
      return
    }
    setPending(`provider-test-${providerKey}`)
    try {
      await adminAiApi.testProvider(
        providerKey,
        draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}
      )
      setProviderDrafts((current) => ({
        ...current,
        [providerKey]: { ...current[providerKey], tested: true },
      }))
      toast.success(`Conexión con ${provider?.label} correcta.`)
      await load()
    } catch (error) {
      setProviderDrafts((current) => ({
        ...current,
        [providerKey]: { ...current[providerKey], tested: false },
      }))
      toast.error(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function saveProvider(providerKey: AdminAiProviderKey) {
    if (!configuration) return
    const provider = configuration.providers.find(
      (candidate) => candidate.providerKey === providerKey
    )
    const draft = providerDrafts[providerKey]
    if (!provider?.apiKeyConfigured && draft.apiKey.trim().length < 20) {
      toast.error("Ingresa y prueba la clave antes de guardar.")
      return
    }
    if (draft.enabled && !draft.tested && provider?.readiness !== "ready") {
      toast.error(`Prueba la conexión antes de habilitar ${provider?.label}.`)
      return
    }
    setPending(`provider-save-${providerKey}`)
    try {
      const next = await adminAiApi.updateProvider(providerKey, {
        enabled: draft.enabled,
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
      })
      setConfiguration(next)
      setProviderDrafts((current) => ({
        ...current,
        [providerKey]: {
          ...current[providerKey],
          apiKey: "",
          tested: false,
        },
      }))
      toast.success(`Configuración de ${provider?.label} guardada.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function toggleModel(model: AdminAiModel, enabled: boolean) {
    setPending(`model-${model.id}`)
    try {
      const updated = await adminAiApi.updateModel(model.id, { enabled })
      setConfiguration((current) =>
        current
          ? {
              ...current,
              models: current.models.map((item) =>
                item.id === updated.id ? updated : item
              ),
            }
          : current
      )
      toast.success(
        `${model.label} ${enabled ? "habilitado" : "deshabilitado"}.`
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function saveRoute(route: AdminAiRoute) {
    setPending(`route-${route.kind}`)
    try {
      const updated = await adminAiApi.updateRoute(route.kind, {
        primaryModelId: route.primaryModelId,
        fallbackModelId: route.fallbackModelId,
        referenceModelId: route.referenceModelId,
        referenceFallbackModelId: route.referenceFallbackModelId,
        reasoningEffort: route.reasoningEffort,
        costUnits: route.costUnits,
        enabled: route.enabled,
      })
      setConfiguration((current) =>
        current
          ? {
              ...current,
              routes: current.routes.map((item) =>
                item.kind === updated.kind ? updated : item
              ),
            }
          : current
      )
      toast.success(`Ruta de ${kindLabels[route.kind]} guardada.`)
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    } finally {
      setPending(null)
    }
  }

  function updateRoute(kind: AiRequestKind, patch: Partial<AdminAiRoute>) {
    setConfiguration((current) =>
      current
        ? {
            ...current,
            routes: current.routes.map((route) =>
              route.kind === kind ? { ...route, ...patch } : route
            ),
          }
        : current
    )
  }

  function clearModelFilters() {
    setModelQuery("")
    setModelProviderFilter("all")
    setModelCapabilityFilter("all")
    setModelEnabledFilter("all")
    setModelPage(1)
  }

  function clearRouteFilters() {
    setRouteQuery("")
    setRouteCapabilityFilter("all")
    setRouteStatusFilter("all")
    setRoutePage(1)
  }

  if (!configuration) {
    if (!loadError)
      return <PageLoading aria-label="Cargando configuración AI" />
    return (
      <Card variant="subtle">
        <EmptyState
          icon={forbidden ? ShieldCheck : Activity}
          title={
            forbidden
              ? "No tienes acceso a configuración AI"
              : "Configuración AI no disponible"
          }
          description={
            forbidden
              ? "Solicita a un administrador el permiso necesario."
              : "No pudimos cargar los proveedores y modelos."
          }
          action={
            !forbidden ? (
              <Button onClick={() => void load()} variant="brand-secondary">
                <RefreshCw data-icon="inline-start" /> Reintentar
              </Button>
            ) : undefined
          }
        />
      </Card>
    )
  }

  const editingRoute =
    configuration.routes.find((route) => route.kind === editingRouteKind) ??
    null
  const readyProviders = configuration.providers.filter(
    (provider) => provider.readiness === "ready"
  ).length
  const status =
    readyProviders === configuration.providers.length
      ? readinessCopy.ready
      : readyProviders > 0
        ? readinessCopy.untested
        : readinessCopy.disabled

  return (
    <section className="flex flex-col gap-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configuración AI
          </h1>
          <p className="text-sm text-muted-foreground">
            Define la conexión, los modelos y qué usa cada herramienta del
            Portal.
          </p>
        </div>
        <Badge variant={status.variant}>
          <status.icon aria-hidden="true" /> {readyProviders}/
          {configuration.providers.length} listos
        </Badge>
      </div>

      <Tabs defaultValue="provider">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="provider">Proveedor</TabsTrigger>
          <TabsTrigger value="models">Modelos</TabsTrigger>
          <TabsTrigger value="routing">Rutas</TabsTrigger>
          <TabsTrigger value="usage">Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="provider" className="flex flex-col gap-4 pt-3">
          {configuration.providers.map((provider) => {
            const draft = providerDrafts[provider.providerKey]
            const providerStatus = readinessCopy[provider.readiness]
            const testing = pending === `provider-test-${provider.providerKey}`
            const saving = pending === `provider-save-${provider.providerKey}`
            const complete = Boolean(
              provider.apiKeyConfigured || draft.apiKey.trim().length >= 20
            )
            const dirty = Boolean(
              draft.apiKey.trim() || draft.enabled !== provider.enabled
            )
            const canEnable =
              !draft.enabled || draft.tested || provider.readiness === "ready"
            return (
              <Card key={provider.providerKey} variant="subtle">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound /> {provider.label}
                    <Badge variant={providerStatus.variant}>
                      <providerStatus.icon aria-hidden="true" />
                      {providerStatus.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Gestiona{" "}
                    {provider.capabilities
                      .map((capability) =>
                        capabilityLabels[capability].toLowerCase()
                      )
                      .join(" y ")}
                    . La clave se cifra y no vuelve a mostrarse.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <Field>
                    <FieldLabel htmlFor={`${provider.providerKey}-key`}>
                      Clave API
                      {!provider.apiKeyConfigured ? (
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      ) : null}
                    </FieldLabel>
                    <Input
                      aria-required={
                        provider.apiKeyConfigured ? undefined : "true"
                      }
                      autoComplete="new-password"
                      id={`${provider.providerKey}-key`}
                      onChange={(event) =>
                        setProviderDrafts((current) => ({
                          ...current,
                          [provider.providerKey]: {
                            ...current[provider.providerKey],
                            apiKey: event.target.value,
                            tested: false,
                          },
                        }))
                      }
                      placeholder={
                        provider.apiKeyConfigured
                          ? "Clave configurada; escribe otra para reemplazarla"
                          : provider.providerKey === "atlascloud"
                            ? "apikey-..."
                            : "sk-..."
                      }
                      type="password"
                      value={draft.apiKey}
                    />
                  </Field>
                  <Card variant="inset">
                    <CardContent className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          Habilitar {provider.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Activa únicamente las capacidades indicadas arriba.
                        </p>
                      </div>
                      <Switch
                        aria-label={`Habilitar ${provider.label}`}
                        checked={draft.enabled}
                        onCheckedChange={(enabled) =>
                          setProviderDrafts((current) => ({
                            ...current,
                            [provider.providerKey]: {
                              ...current[provider.providerKey],
                              enabled,
                            },
                          }))
                        }
                      />
                    </CardContent>
                  </Card>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      disabled={pending !== null || !complete}
                      onClick={() => void testProvider(provider.providerKey)}
                      variant="brand-secondary"
                    >
                      {testing ? (
                        <Spinner data-icon="inline-start" size={16} />
                      ) : (
                        <ShieldCheck data-icon="inline-start" />
                      )}
                      Probar conexión
                    </Button>
                    <Button
                      disabled={
                        pending !== null || !complete || !dirty || !canEnable
                      }
                      onClick={() => void saveProvider(provider.providerKey)}
                    >
                      {saving ? (
                        <Spinner data-icon="inline-start" size={16} />
                      ) : (
                        <Save data-icon="inline-start" />
                      )}
                      Guardar proveedor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
        <TabsContent value="models" className="pt-3">
          <Card variant="subtle">
            <DataTableHeader
              search={{
                ariaLabel: "Buscar modelos AI",
                onChange: (value) => {
                  setModelQuery(value)
                  setModelPage(1)
                },
                placeholder: "Buscar modelos...",
                value: modelQuery,
              }}
            />
            <CardContent className="flex flex-col gap-4 px-0">
              <DataTableToolbar
                actions={
                  hasModelFilters ? (
                    <Button
                      onClick={clearModelFilters}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <X /> Limpiar
                    </Button>
                  ) : undefined
                }
              >
                <DataTableFilter
                  ariaLabel="Filtrar por proveedor"
                  label="Proveedor"
                  onValueChange={(value) => {
                    setModelProviderFilter(value)
                    setModelPage(1)
                  }}
                  options={[
                    { label: "Todos", value: "all" },
                    ...configuration.providers.map((provider) => ({
                      label: provider.label,
                      value: provider.providerKey,
                    })),
                  ]}
                  value={modelProviderFilter}
                />
                <DataTableFilter
                  ariaLabel="Filtrar por capacidad"
                  label="Capacidad"
                  onValueChange={(value) => {
                    setModelCapabilityFilter(value)
                    setModelPage(1)
                  }}
                  options={[
                    { label: "Todas", value: "all" },
                    { label: "Texto", value: "text" },
                    { label: "Imagen", value: "image" },
                    { label: "Video", value: "video" },
                  ]}
                  value={modelCapabilityFilter}
                />
                <DataTableFilter
                  ariaLabel="Filtrar por habilitado"
                  label="Habilitado"
                  onValueChange={(value) => {
                    setModelEnabledFilter(value)
                    setModelPage(1)
                  }}
                  options={[
                    { label: "Todos", value: "all" },
                    { label: "Habilitados", value: "enabled" },
                    { label: "Deshabilitados", value: "disabled" },
                  ]}
                  value={modelEnabledFilter}
                />
              </DataTableToolbar>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Proveedor
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Capacidad
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Perfil
                    </TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Habilitado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleModels.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>
                        <p className="font-medium">{model.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {model.modelId}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {configuration.providers.find(
                          (provider) =>
                            provider.providerKey === model.providerKey
                        )?.label ?? model.providerKey}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {capabilityLabels[model.capability]}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {tierLabels[model.tier]}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={model.deprecated ? "warning" : "success"}
                        >
                          {model.deprecated ? "Obsoleto" : "Disponible"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={model.enabled}
                          disabled={
                            pending === `model-${model.id}` || model.deprecated
                          }
                          onCheckedChange={(checked) =>
                            void toggleModel(model, checked)
                          }
                          aria-label={`Habilitar ${model.label}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {visibleModels.length === 0 ? (
                    <TableEmptyRow
                      action={
                        hasModelFilters ? (
                          <Button onClick={clearModelFilters} variant="outline">
                            Limpiar filtros
                          </Button>
                        ) : null
                      }
                      colSpan={6}
                      description={
                        hasModelFilters
                          ? "Prueba con otro término, proveedor o capacidad."
                          : "Configura un modelo para habilitar las rutas de generación."
                      }
                      title={
                        hasModelFilters
                          ? "No encontramos modelos"
                          : "Aún no hay modelos"
                      }
                    />
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                canGoNext={safeModelPage < modelPageCount}
                canGoPrevious={safeModelPage > 1}
                itemLabel="modelos"
                onNextPage={() =>
                  setModelPage((current) =>
                    Math.min(current + 1, modelPageCount)
                  )
                }
                onPreviousPage={() =>
                  setModelPage((current) => Math.max(current - 1, 1))
                }
                rangeEnd={modelRangeEnd}
                rangeStart={modelRangeStart}
                total={filteredModels.length}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="pt-3">
          <Card variant="subtle">
            <DataTableHeader
              search={{
                ariaLabel: "Buscar rutas AI",
                onChange: (value) => {
                  setRouteQuery(value)
                  setRoutePage(1)
                },
                placeholder: "Buscar rutas...",
                value: routeQuery,
              }}
            />
            <CardContent className="flex flex-col gap-4 px-0">
              <DataTableToolbar
                actions={
                  hasRouteFilters ? (
                    <Button
                      onClick={clearRouteFilters}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <X /> Limpiar
                    </Button>
                  ) : undefined
                }
              >
                <DataTableFilter
                  ariaLabel="Filtrar por capacidad"
                  label="Capacidad"
                  onValueChange={(value) => {
                    setRouteCapabilityFilter(value)
                    setRoutePage(1)
                  }}
                  options={[
                    { label: "Todas", value: "all" },
                    { label: "Texto", value: "text" },
                    { label: "Imagen", value: "image" },
                    { label: "Video", value: "video" },
                  ]}
                  value={routeCapabilityFilter}
                />
                <DataTableFilter
                  ariaLabel="Filtrar por estado"
                  label="Estado"
                  onValueChange={(value) => {
                    setRouteStatusFilter(value)
                    setRoutePage(1)
                  }}
                  options={[
                    { label: "Todas", value: "all" },
                    { label: "Habilitadas", value: "enabled" },
                    { label: "Deshabilitadas", value: "disabled" },
                  ]}
                  value={routeStatusFilter}
                />
              </DataTableToolbar>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Herramienta</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Modelo principal
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Respaldo
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Razonamiento
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Costo
                    </TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRoutes.map((route) => {
                    const shape = routeShape(route.kind)
                    return (
                      <TableRow key={route.kind}>
                        <TableCell>
                          <p className="font-medium">
                            {kindLabels[route.kind]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {shape.internal
                              ? "Se resuelve dentro de Zapi"
                              : capabilityLabels[shape.capability]}
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <RouteModelCell
                            models={configuration.models}
                            primaryId={route.primaryModelId}
                            referenceId={route.referenceModelId}
                            shape={shape}
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <RouteModelCell
                            models={configuration.models}
                            primaryId={route.fallbackModelId}
                            referenceId={route.referenceFallbackModelId}
                            shape={shape}
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {shape.internal || shape.media
                            ? "—"
                            : reasoningLabels[route.reasoningEffort]}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {route.costUnits}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={route.enabled ? "success" : "neutral"}
                          >
                            {route.enabled ? "Habilitada" : "Deshabilitada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => setEditingRouteKind(route.kind)}
                            size="sm"
                            variant="brand-secondary"
                          >
                            <Settings2 data-icon="inline-start" />
                            Configurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {visibleRoutes.length === 0 ? (
                    <TableEmptyRow
                      action={
                        hasRouteFilters ? (
                          <Button onClick={clearRouteFilters} variant="outline">
                            Limpiar filtros
                          </Button>
                        ) : null
                      }
                      colSpan={7}
                      description={
                        hasRouteFilters
                          ? "Prueba con otro término, capacidad o estado."
                          : "Configura un proveedor y sus modelos para enrutar las herramientas del Portal."
                      }
                      title={
                        hasRouteFilters
                          ? "No encontramos rutas"
                          : "Aún no hay rutas"
                      }
                    />
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                canGoNext={safeRoutePage < routePageCount}
                canGoPrevious={safeRoutePage > 1}
                itemLabel="rutas"
                onNextPage={() =>
                  setRoutePage((current) =>
                    Math.min(current + 1, routePageCount)
                  )
                }
                onPreviousPage={() =>
                  setRoutePage((current) => Math.max(current - 1, 1))
                }
                rangeEnd={routeRangeEnd}
                rangeStart={routeRangeStart}
                total={filteredRoutes.length}
              />
            </CardContent>
          </Card>
          {editingRoute ? (
            <RouteSheet
              models={configuration.models}
              onChange={(patch) => updateRoute(editingRoute.kind, patch)}
              onOpenChange={(nextOpen) =>
                setEditingRouteKind(nextOpen ? editingRoute.kind : null)
              }
              onSave={async () => {
                const saved = await saveRoute(editingRoute)
                if (saved) setEditingRouteKind(null)
              }}
              pending={pending === `route-${editingRoute.kind}`}
              route={editingRoute}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="usage" className="flex flex-col gap-4 pt-3">
          <UsagePanel
            error={usageError}
            onRetry={() => void load()}
            usage={usage}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

function modelLabel(models: AdminAiModel[], id: string | null) {
  if (!id) return "Sin modelo"
  return (
    models.find((model) => model.id === id)?.label ?? "Modelo no disponible"
  )
}

function RouteModelCell({
  models,
  primaryId,
  referenceId,
  shape,
}: {
  models: AdminAiModel[]
  primaryId: string | null
  referenceId: string | null
  shape: RouteShape
}) {
  if (shape.internal) return <>—</>
  if (!shape.media) return <>{modelLabel(models, primaryId)}</>

  return (
    <div className="flex flex-col">
      <span>{modelLabel(models, primaryId)}</span>
      <span className="text-xs text-muted-foreground">
        Con referencias: {modelLabel(models, referenceId)}
      </span>
    </div>
  )
}

function RouteSheet({
  route,
  models,
  pending,
  onChange,
  onOpenChange,
  onSave,
}: {
  route: AdminAiRoute
  models: AdminAiModel[]
  pending: boolean
  onChange: (patch: Partial<AdminAiRoute>) => void
  onOpenChange: (open: boolean) => void
  onSave: () => void
}) {
  const { capability, internal, media, primaryModes, referenceModes } =
    routeShape(route.kind)
  const options = models.filter(
    (model) =>
      model.capability === capability &&
      model.enabled &&
      !model.deprecated &&
      (!media || model.modes.some((mode) => primaryModes.includes(mode)))
  )
  const referenceOptions = media
    ? models.filter(
        (model) =>
          model.capability === capability &&
          model.enabled &&
          !model.deprecated &&
          model.modes.some((mode) => referenceModes.includes(mode))
      )
    : []

  return (
    <Sheet onOpenChange={onOpenChange} open>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-2xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Route className="size-4" /> {kindLabels[route.kind]}
          </SheetTitle>
          <SheetDescription>
            {internal
              ? "Esta herramienta se resuelve dentro de Zapi y no consume un modelo externo."
              : media
                ? "Separa la generación desde texto de la generación con archivos de referencia."
                : `Elige el modelo principal y el respaldo para ${capabilityLabels[capability].toLowerCase()}.`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {!internal ? (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    {media ? "Principal · sin referencias" : "Modelo principal"}
                    {route.enabled ? (
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    ) : null}
                  </label>
                  <Select
                    value={route.primaryModelId ?? "none"}
                    onValueChange={(value) =>
                      onChange({
                        primaryModelId: value === "none" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger
                      aria-required={route.enabled ? "true" : undefined}
                      className="w-full"
                    >
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Sin modelo</SelectItem>
                        {options.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    {media
                      ? "Respaldo · sin referencias"
                      : "Modelo de respaldo"}
                  </label>
                  <Select
                    value={route.fallbackModelId ?? "none"}
                    onValueChange={(value) =>
                      onChange({
                        fallbackModelId: value === "none" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Sin respaldo</SelectItem>
                        {options
                          .filter((model) => model.id !== route.primaryModelId)
                          .map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.label}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                {media ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">
                        Principal · con referencias
                        {route.enabled ? (
                          <span aria-hidden="true" className="text-destructive">
                            *
                          </span>
                        ) : null}
                      </label>
                      <Select
                        value={route.referenceModelId ?? "none"}
                        onValueChange={(value) =>
                          onChange({
                            referenceModelId: value === "none" ? null : value,
                          })
                        }
                      >
                        <SelectTrigger
                          aria-required={route.enabled ? "true" : undefined}
                          className="w-full"
                        >
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="none">Sin modelo</SelectItem>
                            {referenceOptions.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">
                        Respaldo · con referencias
                      </label>
                      <Select
                        value={route.referenceFallbackModelId ?? "none"}
                        onValueChange={(value) =>
                          onChange({
                            referenceFallbackModelId:
                              value === "none" ? null : value,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="none">Sin respaldo</SelectItem>
                            {referenceOptions
                              .filter(
                                (model) => model.id !== route.referenceModelId
                              )
                              .map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
                {!media ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Razonamiento</label>
                    <Select
                      value={route.reasoningEffort}
                      onValueChange={(value) =>
                        onChange({
                          reasoningEffort: value as AiReasoningEffort,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">Ninguno</SelectItem>
                          <SelectItem value="low">Bajo</SelectItem>
                          <SelectItem value="medium">Medio</SelectItem>
                          <SelectItem value="high">Alto</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Costo en créditos</label>
              <Input
                type="number"
                min={0}
                max={10000}
                value={route.costUnits}
                onChange={(event) =>
                  onChange({
                    costUnits: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={route.enabled}
              onCheckedChange={(enabled) => onChange({ enabled })}
              aria-label={`Habilitar ${kindLabels[route.kind]}`}
            />
            <span className="text-sm">Herramienta habilitada</span>
          </div>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="brand-secondary"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={
              pending ||
              (route.enabled && !internal && !route.primaryModelId) ||
              (route.enabled && media && !route.referenceModelId)
            }
          >
            {pending ? (
              <Spinner data-icon="inline-start" size={16} />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Guardar ruta
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function UsagePanel({
  error,
  onRetry,
  usage,
}: {
  error: boolean
  onRetry: () => void
  usage: AdminAiUsage | null
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es")
    if (!normalized) return usage?.byModel ?? []
    return (usage?.byModel ?? []).filter((item) =>
      item.model.toLocaleLowerCase("es").includes(normalized)
    )
  }, [query, usage?.byModel])
  const pageCount = Math.max(
    1,
    Math.ceil(filteredItems.length / TABLE_PAGE_SIZE)
  )
  const safePage = Math.min(page, pageCount)
  const visibleItems = filteredItems.slice(
    (safePage - 1) * TABLE_PAGE_SIZE,
    safePage * TABLE_PAGE_SIZE
  )
  const rangeStart = filteredItems.length
    ? (safePage - 1) * TABLE_PAGE_SIZE + 1
    : 0
  const rangeEnd = filteredItems.length
    ? rangeStart + visibleItems.length - 1
    : 0

  if (error) {
    return (
      <Card variant="subtle">
        <EmptyState
          action={
            <Button onClick={onRetry} variant="brand-secondary">
              <RefreshCw data-icon="inline-start" /> Reintentar
            </Button>
          }
          description="La configuración sigue disponible; solo falló el resumen de consumo."
          icon={Activity}
          title="No se pudo cargar el uso AI"
        />
      </Card>
    )
  }
  if (!usage) return <PageLoading aria-label="Cargando uso AI" />
  const metrics = [
    {
      description: `Últimos ${usage.periodDays} días`,
      icon: Activity,
      label: "Solicitudes",
      value: number(usage.requests),
    },
    {
      description: "Finalizadas correctamente",
      icon: CheckCircle2,
      label: "Correctas",
      value: number(usage.succeeded),
    },
    {
      description: "Solicitudes con error",
      icon: CircleX,
      label: "Fallidas",
      value: number(usage.failed),
    },
    {
      description: "Consumo calculado",
      icon: CircleDollarSign,
      label: "Costo estimado",
      value: money(usage.estimatedCostMicrousd),
    },
    {
      description: "Promedio por solicitud",
      icon: Timer,
      label: "Latencia media",
      value: `${number(usage.averageLatencyMs)} ms`,
    },
  ]
  return (
    <>
      <CardGrid layout="xl-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </CardGrid>
      <Card variant="subtle">
        <DataTableHeader
          search={{
            ariaLabel: "Buscar consumo por modelo",
            onChange: (value) => {
              setQuery(value)
              setPage(1)
            },
            placeholder: "Buscar modelo...",
            value: query,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Solicitudes</TableHead>
                <TableHead className="hidden md:table-cell">
                  Tokens entrada
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  Tokens salida
                </TableHead>
                <TableHead>Costo estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.length ? (
                visibleItems.map((item) => (
                  <TableRow key={item.model}>
                    <TableCell className="font-mono text-xs">
                      {item.model}
                    </TableCell>
                    <TableCell>{number(item.requests)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {number(item.inputTokens)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {number(item.outputTokens)}
                    </TableCell>
                    <TableCell>{money(item.estimatedCostMicrousd)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmptyRow
                  action={
                    query.trim() ? (
                      <Button
                        onClick={() => {
                          setQuery("")
                          setPage(1)
                        }}
                        variant="outline"
                      >
                        Limpiar filtros
                      </Button>
                    ) : null
                  }
                  colSpan={5}
                  description={
                    query.trim()
                      ? "Prueba con otro término de búsqueda."
                      : "El consumo aparecerá aquí en cuanto se registren generaciones."
                  }
                  title={
                    query.trim()
                      ? "No encontramos consumo"
                      : "Aún no hay consumo AI"
                  }
                />
              )}
            </TableBody>
          </Table>
          <TablePagination
            canGoNext={safePage < pageCount}
            canGoPrevious={safePage > 1}
            itemLabel="modelos"
            onNextPage={() =>
              setPage((current) => Math.min(current + 1, pageCount))
            }
            onPreviousPage={() =>
              setPage((current) => Math.max(current - 1, 1))
            }
            rangeEnd={rangeEnd}
            rangeStart={rangeStart}
            total={filteredItems.length}
          />
        </CardContent>
      </Card>
    </>
  )
}
