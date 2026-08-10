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
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { toast } from "@workspace/ui/components/toast"
import {
  Activity,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

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

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      const [nextConfiguration, nextUsage] = await Promise.all([
        adminAiApi.configuration(),
        adminAiApi.usage(30),
      ])
      setConfiguration(nextConfiguration)
      setUsage(nextUsage)
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
    } catch {
      setLoadError(true)
      setConfiguration(null)
      setUsage(null)
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
          icon={Activity}
          title="Configuración AI no disponible"
          description="No pudimos cargar los proveedores y modelos."
          action={
            <Button onClick={() => void load()} variant="brand-secondary">
              <RefreshCw data-icon="inline-start" /> Reintentar
            </Button>
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
    <section className="space-y-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Configuración AI
          </h2>
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
        <TabsList>
          <TabsTrigger value="provider">Proveedor</TabsTrigger>
          <TabsTrigger value="models">Modelos</TabsTrigger>
          <TabsTrigger value="routing">Rutas</TabsTrigger>
          <TabsTrigger value="usage">Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="provider" className="space-y-4 pt-3">
          {configuration.providers.map((provider) => {
            const draft = providerDrafts[provider.providerKey]
            const providerStatus = readinessCopy[provider.readiness]
            const testing = pending === `provider-test-${provider.providerKey}`
            const saving = pending === `provider-save-${provider.providerKey}`
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
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor={`${provider.providerKey}-key`}
                      className="text-sm font-medium"
                    >
                      Clave API
                      {!provider.apiKeyConfigured ? (
                        <span className="text-destructive"> *</span>
                      ) : null}
                    </label>
                    <Input
                      id={`${provider.providerKey}-key`}
                      type="password"
                      autoComplete="new-password"
                      value={draft.apiKey}
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
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">Habilitar {provider.label}</p>
                      <p className="text-sm text-muted-foreground">
                        Activa únicamente las capacidades indicadas arriba.
                      </p>
                    </div>
                    <Switch
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
                      aria-label={`Habilitar ${provider.label}`}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="brand-secondary"
                      disabled={pending !== null}
                      onClick={() => void testProvider(provider.providerKey)}
                    >
                      {testing ? (
                        <LoaderCircle
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      ) : (
                        <ShieldCheck data-icon="inline-start" />
                      )}
                      Probar conexión
                    </Button>
                    <Button
                      disabled={pending !== null}
                      onClick={() => void saveProvider(provider.providerKey)}
                    >
                      {saving ? (
                        <LoaderCircle
                          className="animate-spin"
                          data-icon="inline-start"
                        />
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
          <Card className="overflow-hidden p-0" variant="subtle">
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
                {configuration.models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <p className="font-medium">{model.label}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {model.modelId}
                      </p>
                    </TableCell>
                    <TableCell>
                      {configuration.providers.find(
                        (provider) => provider.providerKey === model.providerKey
                      )?.label ?? model.providerKey}
                    </TableCell>
                    <TableCell>{capabilityLabels[model.capability]}</TableCell>
                    <TableCell>{tierLabels[model.tier]}</TableCell>
                    <TableCell>
                      <Badge variant={model.deprecated ? "warning" : "success"}>
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
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="space-y-3 pt-3">
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

        <TabsContent value="usage" className="space-y-4 pt-3">
          <UsagePanel usage={usage} />
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
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {!internal ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {media ? "Principal · sin referencias" : "Modelo principal"}
                  {route.enabled ? (
                    <span className="text-destructive"> *</span>
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
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin modelo</SelectItem>
                    {options.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
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
                    <SelectItem value="none">Sin respaldo</SelectItem>
                    {options
                      .filter((model) => model.id !== route.primaryModelId)
                      .map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {media ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Principal · con referencias
                      {route.enabled ? (
                        <span className="text-destructive"> *</span>
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
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin modelo</SelectItem>
                        {referenceOptions.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
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
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}
              {!media ? (
                <div className="space-y-2">
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
                      <SelectItem value="none">Ninguno</SelectItem>
                      <SelectItem value="low">Bajo</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="space-y-2">
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
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
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

function UsagePanel({ usage }: { usage: AdminAiUsage | null }) {
  if (!usage) return <PageLoading aria-label="Cargando uso AI" />
  const metrics = [
    ["Solicitudes", number(usage.requests)],
    ["Correctas", number(usage.succeeded)],
    ["Fallidas", number(usage.failed)],
    ["Costo estimado", money(usage.estimatedCostMicrousd)],
  ]
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label} size="sm" variant="subtle">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden p-0" variant="subtle">
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
            {usage.byModel.length ? (
              usage.byModel.map((item) => (
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
      </Card>
      <p className="text-xs text-muted-foreground">
        Últimos {usage.periodDays} días · Latencia media{" "}
        {number(usage.averageLatencyMs)} ms.
      </p>
    </>
  )
}
