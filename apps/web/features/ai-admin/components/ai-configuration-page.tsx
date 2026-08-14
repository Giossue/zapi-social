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
import { DataTableHeader } from "@workspace/ui/components/data-table-controls"
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
  CircleDollarSign,
  CircleX,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
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
  ready: { label: "Listo", variant: "success" as const },
  disabled: { label: "Deshabilitado", variant: "neutral" as const },
  incomplete: { label: "Incompleto", variant: "warning" as const },
  untested: { label: "Sin probar", variant: "warning" as const },
  error: { label: "Error", variant: "destructive" as const },
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
  const [modelPage, setModelPage] = useState(1)

  const filteredModels = useMemo(() => {
    const normalized = modelQuery.trim().toLocaleLowerCase("es")
    if (!normalized) return configuration?.models ?? []
    return (configuration?.models ?? []).filter((model) =>
      [model.label, model.modelId, model.providerKey, model.capability].some(
        (value) => value.toLocaleLowerCase("es").includes(normalized)
      )
    )
  }, [configuration?.models, modelQuery])
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
    } catch (error) {
      toast.error(errorMessage(error))
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
          <CheckCircle2 data-icon="inline-start" /> {readyProviders}/
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
              description="Activa los modelos disponibles para las rutas de generación."
              search={{
                ariaLabel: "Buscar modelos AI",
                onChange: (value) => {
                  setModelQuery(value)
                  setModelPage(1)
                },
                placeholder: "Buscar modelos...",
                value: modelQuery,
              }}
              title="Modelos"
            />
            <CardContent className="flex flex-col gap-4 px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead>Perfil</TableHead>
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
                      <TableCell>
                        {configuration.providers.find(
                          (provider) =>
                            provider.providerKey === model.providerKey
                        )?.label ?? model.providerKey}
                      </TableCell>
                      <TableCell>
                        {capabilityLabels[model.capability]}
                      </TableCell>
                      <TableCell>{tierLabels[model.tier]}</TableCell>
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

        <TabsContent value="routing" className="flex flex-col gap-3 pt-3">
          {configuration.routes.map((route) => (
            <RouteCard
              key={route.kind}
              route={route}
              models={configuration.models}
              pending={pending === `route-${route.kind}`}
              onChange={(patch) => updateRoute(route.kind, patch)}
              onSave={() => void saveRoute(route)}
            />
          ))}
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

function RouteCard({
  route,
  models,
  pending,
  onChange,
  onSave,
}: {
  route: AdminAiRoute
  models: AdminAiModel[]
  pending: boolean
  onChange: (patch: Partial<AdminAiRoute>) => void
  onSave: () => void
}) {
  const capability =
    route.kind === "image" ? "image" : route.kind === "video" ? "video" : "text"
  const internal = route.kind === "timing" || route.kind === "search"
  const media = route.kind === "image" || route.kind === "video"
  const primaryModes =
    route.kind === "image" ? ["text-to-image"] : ["text-to-video"]
  const referenceModes =
    route.kind === "image"
      ? ["image-to-image"]
      : ["image-to-video", "reference-to-video"]
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
    <Card variant="subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="size-4" /> {kindLabels[route.kind]}
        </CardTitle>
        <CardDescription>
          {internal
            ? "Esta herramienta se resuelve dentro de Zapi y no consume un modelo externo."
            : media
              ? "Separa la generación desde texto de la generación con archivos de referencia."
              : `Elige el modelo principal y el respaldo para ${capabilityLabels[capability].toLowerCase()}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  {media ? "Respaldo · sin referencias" : "Modelo de respaldo"}
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
                      onChange({ reasoningEffort: value as AiReasoningEffort })
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={route.enabled}
              onCheckedChange={(enabled) => onChange({ enabled })}
              aria-label={`Habilitar ${kindLabels[route.kind]}`}
            />
            <span className="text-sm">Herramienta habilitada</span>
          </div>
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
        </div>
      </CardContent>
    </Card>
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
  ]
  return (
    <>
      <CardGrid>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </CardGrid>
      <Card variant="subtle">
        <DataTableHeader
          description={`Consumo por modelo durante los últimos ${usage.periodDays} días.`}
          search={{
            ariaLabel: "Buscar consumo por modelo",
            onChange: (value) => {
              setQuery(value)
              setPage(1)
            },
            placeholder: "Buscar modelo...",
            value: query,
          }}
          title="Uso por modelo"
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Solicitudes</TableHead>
                <TableHead>Tokens entrada</TableHead>
                <TableHead>Tokens salida</TableHead>
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
                    <TableCell>{number(item.inputTokens)}</TableCell>
                    <TableCell>{number(item.outputTokens)}</TableCell>
                    <TableCell>{money(item.estimatedCostMicrousd)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-28 text-center text-muted-foreground"
                  >
                    <Sparkles className="mx-auto mb-2 size-5" /> Aún no hay
                    consumo AI.
                  </TableCell>
                </TableRow>
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
      <p className="text-xs text-muted-foreground">
        Últimos {usage.periodDays} días · Latencia media{" "}
        {number(usage.averageLatencyMs)} ms.
      </p>
    </>
  )
}
