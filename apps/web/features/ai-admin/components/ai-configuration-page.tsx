"use client"

import { adminAiApi, ApiError } from "@workspace/api-client"
import type {
  AdminAiConfiguration,
  AdminAiModel,
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
import { useCallback, useEffect, useMemo, useState } from "react"

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
  const [apiKey, setApiKey] = useState("")
  const [providerEnabled, setProviderEnabled] = useState(false)
  const [tested, setTested] = useState(false)
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
      setProviderEnabled(nextConfiguration.provider.enabled)
    } catch {
      setLoadError(true)
      setConfiguration(null)
      setUsage(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function testProvider() {
    if (!configuration) return
    if (!configuration.provider.apiKeyConfigured && apiKey.trim().length < 20) {
      toast.error("Ingresa una clave de OpenAI válida.")
      return
    }
    setPending("provider-test")
    try {
      const result = await adminAiApi.testProvider(
        apiKey.trim() ? { apiKey: apiKey.trim() } : {}
      )
      setTested(true)
      toast.success(
        `Conexión correcta. OpenAI devolvió ${result.availableModelIds.length} modelos.`
      )
      await load()
    } catch (error) {
      setTested(false)
      toast.error(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function saveProvider() {
    if (!configuration) return
    if (!configuration.provider.apiKeyConfigured && apiKey.trim().length < 20) {
      toast.error("Ingresa y prueba la clave antes de guardar.")
      return
    }
    if (
      providerEnabled &&
      !tested &&
      configuration.provider.readiness !== "ready"
    ) {
      toast.error("Prueba la conexión antes de habilitar OpenAI.")
      return
    }
    setPending("provider-save")
    try {
      const next = await adminAiApi.updateProvider({
        enabled: providerEnabled,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      })
      setConfiguration(next)
      setApiKey("")
      setTested(false)
      toast.success("Configuración de OpenAI guardada.")
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

  const status = readinessCopy[configuration.provider.readiness]

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
          <CheckCircle2 data-icon="inline-start" /> {status.label}
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
          <Card variant="subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" /> OpenAI
              </CardTitle>
              <CardDescription>
                La clave se cifra en el servidor y no vuelve a mostrarse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="openai-key" className="text-sm font-medium">
                  Clave API
                  {!configuration.provider.apiKeyConfigured ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </label>
                <Input
                  id="openai-key"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value)
                    setTested(false)
                  }}
                  placeholder={
                    configuration.provider.apiKeyConfigured
                      ? "Clave configurada; escribe otra para reemplazarla"
                      : "sk-..."
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <p className="font-medium">Habilitar OpenAI</p>
                  <p className="text-sm text-muted-foreground">
                    Permite que las herramientas activas envíen trabajos al
                    proveedor.
                  </p>
                </div>
                <Switch
                  checked={providerEnabled}
                  onCheckedChange={setProviderEnabled}
                  aria-label="Habilitar OpenAI"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="brand-secondary"
                  disabled={pending !== null}
                  onClick={() => void testProvider()}
                >
                  {pending === "provider-test" ? (
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
                  onClick={() => void saveProvider()}
                >
                  {pending === "provider-save" ? (
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
        </TabsContent>

        <TabsContent value="models" className="pt-3">
          <Card className="overflow-hidden p-0" variant="subtle">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
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
  const options = useMemo(
    () =>
      models.filter(
        (model) =>
          model.capability === capability && model.enabled && !model.deprecated
      ),
    [capability, models]
  )

  return (
    <Card variant="subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="size-4" /> {kindLabels[route.kind]}
        </CardTitle>
        <CardDescription>
          {internal
            ? "Esta herramienta se resuelve dentro de Zapi y no consume un modelo externo."
            : `Elige el modelo principal y el respaldo para ${capabilityLabels[capability].toLowerCase()}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {!internal ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Modelo principal
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
                  Modelo de respaldo
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
              pending || (route.enabled && !internal && !route.primaryModelId)
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
