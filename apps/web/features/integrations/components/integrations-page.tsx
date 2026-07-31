"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  KeyRound,
  LockKeyhole,
  PlugZap,
  Save,
  Settings2,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { useState, type FormEvent } from "react"
import { providerIntegrations } from "../fixtures/provider-integrations"
import type {
  IntegrationField,
  IntegrationReadiness,
} from "../types/integrations"

const statusCopy: Record<
  IntegrationReadiness,
  { label: string; variant: "success" | "warning" | "neutral" }
> = {
  ready: { label: "Listo", variant: "success" },
  incomplete: { label: "Incompleto", variant: "warning" },
  disabled: { label: "Deshabilitado", variant: "neutral" },
}

function ProviderStatus({ readiness }: { readiness: IntegrationReadiness }) {
  const status = statusCopy[readiness]
  const Icon =
    readiness === "ready"
      ? CheckCircle2
      : readiness === "incomplete"
        ? CircleAlert
        : Circle

  return (
    <Badge variant={status.variant}>
      <Icon aria-hidden="true" />
      {status.label}
    </Badge>
  )
}

function FieldControl({
  field,
  error,
}: {
  field: IntegrationField
  error?: string
}) {
  if (field.id === "graphVersion") {
    return (
      <Select
        defaultValue={field.value}
        name={field.id}
        required={field.required}
      >
        <SelectTrigger aria-invalid={Boolean(error)}>
          <SelectValue placeholder="Selecciona una versión" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="v24.0">v24.0</SelectItem>
          <SelectItem value="v25.0">v25.0</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Input
      aria-invalid={Boolean(error)}
      defaultValue={field.type === "password" ? "" : field.value}
      name={field.id}
      placeholder={
        field.type === "password" && field.hasStoredSecret
          ? "••••••••••••"
          : undefined
      }
      required={field.required && !field.hasStoredSecret}
      type={field.type ?? "text"}
    />
  )
}

export function IntegrationsPage() {
  const [providers, setProviders] = useState(providerIntegrations)
  const [activeProviderId, setActiveProviderId] = useState(
    providerIntegrations[0]?.id ?? ""
  )
  const [configuringProviderId, setConfiguringProviderId] = useState<
    string | null
  >(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [savedProviderId, setSavedProviderId] = useState<string | null>(null)

  const activeProvider = providers.find(
    (provider) => provider.id === activeProviderId
  )
  const configuringProvider =
    providers.find((provider) => provider.id === configuringProviderId) ?? null

  if (!activeProvider) {
    return (
      <EmptyState
        icon={PlugZap}
        title="No hay proveedores configurables"
        description="Añade un dato de ejemplo local de proveedor para continuar."
      />
    )
  }

  function toggleProvider(providerId: string, enabled: boolean) {
    setProviders((current) =>
      current.map((provider) => {
        if (provider.id !== providerId) return provider

        return {
          ...provider,
          enabled,
          readiness: enabled
            ? provider.checklist.every((item) => item.complete)
              ? "ready"
              : "incomplete"
            : "disabled",
        }
      })
    )
    setSavedProviderId(null)
  }

  function openConfiguration(providerId: string) {
    setFormErrors({})
    setSavedProviderId(null)
    setConfiguringProviderId(providerId)
  }

  function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!configuringProvider) return

    const formData = new FormData(event.currentTarget)
    const nextErrors: Record<string, string> = {}

    for (const field of configuringProvider.fields) {
      const value = String(formData.get(field.id) ?? "").trim()
      const hasValue = value.length > 0 || field.hasStoredSecret

      if (field.required && !hasValue)
        nextErrors[field.id] = `${field.label} es obligatorio.`
      if (field.type === "url" && value && !URL.canParse(value))
        nextErrors[field.id] = "Introduce una URL válida."
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setProviders((current) =>
      current.map((provider) => {
        if (provider.id !== configuringProvider.id) return provider

        const fields = provider.fields.map((field) => {
          const submittedValue = String(formData.get(field.id) ?? "").trim()
          if (field.type === "password")
            return {
              ...field,
              hasStoredSecret:
                field.hasStoredSecret || submittedValue.length > 0,
            }
          return { ...field, value: submittedValue }
        })
        const checklist = provider.checklist.map((item) =>
          item.complete ? item : { ...item, complete: true }
        )

        return {
          ...provider,
          fields,
          checklist,
          readiness: provider.enabled ? "ready" : "disabled",
        }
      })
    )
    setFormErrors({})
    setSavedProviderId(configuringProvider.id)
  }

  return (
    <div className="space-y-6">
      <Card variant="surface">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-primary">
              <PlugZap className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground">
                Espacio de trabajo de plataforma
              </p>
              <CardTitle>Configuración de proveedores</CardTitle>
            </div>
          </div>
          <CardDescription className="max-w-3xl">
            Credenciales y tipos de canal compartidos para los espacios de trabajo. Los
            canales se conectan después desde su propio flujo; esta Fase A usa
            datos de ejemplo locales.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs onValueChange={setActiveProviderId} value={activeProvider.id}>
        <TabsList
          aria-label="Directorio de proveedores"
          className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-2"
        >
          {providers.map((provider) => (
            <TabsTrigger key={provider.id} value={provider.id}>
              {provider.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card variant="surface">
          <CardHeader className="gap-4 border-b border-border pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{activeProvider.label}</CardTitle>
                  <ProviderStatus readiness={activeProvider.readiness} />
                  <Badge variant="neutral">
                    {activeProvider.authMode === "oauth"
                      ? "OAuth 2.0"
                      : "Conector"}
                  </Badge>
                </div>
                <CardDescription>{activeProvider.description}</CardDescription>
              </div>
              <Button
                onClick={() => openConfiguration(activeProvider.id)}
                variant="brand-secondary"
              >
                <Settings2 data-icon="inline-start" />
                Ver y configurar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <section aria-labelledby="capabilities-title" className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 id="capabilities-title" className="text-sm font-semibold">
                  Tipos de canal
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {activeProvider.capabilities.map((capability) => (
                  <div
                    key={capability.id}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <p className="text-sm font-medium">{capability.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {capability.description}
                    </p>
                    {capability.callbackUrl ? (
                      <p className="mt-3 font-mono text-xs break-all text-muted-foreground">
                        {capability.callbackUrl}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Sin OAuth ni callback.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="configuration-title"
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <LockKeyhole
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 id="configuration-title" className="text-sm font-semibold">
                  Resumen de configuración
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeProvider.fields.map((field) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {field.label}
                    </p>
                    <p className="mt-1 text-sm break-all">
                      {field.type === "password"
                        ? field.hasStoredSecret
                          ? "••••••••••••"
                          : "Sin configurar"
                        : field.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card variant="surface">
            <CardHeader>
              <CardTitle className="text-base">Disponibilidad</CardTitle>
              <CardDescription>
                Controla si este proveedor aparece para los espacios de trabajo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Habilitado</p>
                <p className="text-xs text-muted-foreground">
                  {activeProvider.enabled
                    ? "Disponible para nuevas conexiones"
                    : "No disponible para nuevas conexiones"}
                </p>
              </div>
              <Switch
                aria-label={`Habilitar ${activeProvider.label}`}
                checked={activeProvider.enabled}
                onCheckedChange={(enabled) =>
                  toggleProvider(activeProvider.id, enabled)
                }
              />
            </CardContent>
          </Card>

          <Card variant="surface">
            <CardHeader>
              <CardTitle className="text-base">
                Checklist de preparación
              </CardTitle>
              <CardDescription>
                {
                  activeProvider.checklist.filter((item) => item.complete)
                    .length
                }{" "}
                de {activeProvider.checklist.length} verificados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {activeProvider.checklist.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-sm">
                    {item.complete ? (
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle
                        className="mt-0.5 size-4 shrink-0 text-warning"
                        aria-hidden="true"
                      />
                    )}
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        onOpenChange={(open) => !open && setConfiguringProviderId(null)}
        open={configuringProvider !== null}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          {configuringProvider ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Configurar {configuringProvider.label}
                </DialogTitle>
                <DialogDescription>
                  Formulario local de la Fase A. Los valores secretos se
                  representan enmascarados y no se envían a ningún servicio.
                </DialogDescription>
              </DialogHeader>

              <form
                className="space-y-5"
                onSubmit={saveConfiguration}
                noValidate
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {configuringProvider.fields.map((field) => (
                    <label
                      key={field.id}
                      className={
                        field.id === "scopes"
                          ? "grid gap-1.5 sm:col-span-2"
                          : "grid gap-1.5"
                      }
                    >
                      <span className="text-sm font-medium">{field.label}</span>
                      <FieldControl
                        error={formErrors[field.id]}
                        field={field}
                      />
                      {formErrors[field.id] ? (
                        <span className="text-xs text-destructive">
                          {formErrors[field.id]}
                        </span>
                      ) : null}
                      {field.helper ? (
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {field.helper}
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>

                {configuringProvider.authMode === "oauth" ? (
                  <section
                    className="space-y-3 border-t border-border pt-5"
                    aria-labelledby="callbacks-title"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <h2
                        id="callbacks-title"
                        className="text-sm font-semibold"
                      >
                        URLs de retorno OAuth · solo lectura
                      </h2>
                    </div>
                    {configuringProvider.capabilities.map((capability) => (
                      <label key={capability.id} className="grid gap-1.5">
                        <span className="text-sm font-medium">
                          {capability.label}
                        </span>
                        <Input readOnly value={capability.callbackUrl} />
                      </label>
                    ))}
                    {configuringProvider.dataDeletionCallbackUrl ? (
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium">
                          URL de eliminación de datos · Meta
                        </span>
                        <Input
                          readOnly
                          value={configuringProvider.dataDeletionCallbackUrl}
                        />
                      </label>
                    ) : null}
                  </section>
                ) : null}

                {savedProviderId === configuringProvider.id ? (
                  <div
                    className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 p-3 text-sm text-success"
                    role="status"
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Configuración simulada guardada localmente.
                  </div>
                ) : null}

                <div className="flex justify-end border-t border-border pt-5">
                  <Button type="submit">
                    <Save data-icon="inline-start" />
                    Guardar configuración
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
