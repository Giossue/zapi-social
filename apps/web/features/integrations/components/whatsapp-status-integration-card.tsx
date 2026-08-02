"use client"

import { ApiError, integrationsApi } from "@workspace/api-client"
import { IntegrationCardLoading } from "./integration-card-loading"
import type { WhatsAppStatusIntegration } from "@workspace/contracts"
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
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  PlugZap,
  Save,
  Settings2,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"

type Draft = {
  enabled: boolean
  baseUrl: string
  basicAuthUsername: string
  basicAuthPassword: string
}

type TestState = "not-tested" | "testing" | "passed" | "failed"

const statusCopy = {
  ready: { label: "Listo", variant: "success" as const },
  incomplete: { label: "Incompleto", variant: "warning" as const },
  untested: { label: "Sin probar", variant: "warning" as const },
  disabled: { label: "Deshabilitado", variant: "neutral" as const },
}

function ProviderStatus({
  readiness,
}: {
  readiness: WhatsAppStatusIntegration["readiness"]
}) {
  const status = statusCopy[readiness]
  const Icon =
    readiness === "ready"
      ? CheckCircle2
      : readiness === "disabled"
        ? Circle
        : CircleAlert

  return (
    <Badge variant={status.variant}>
      <Icon aria-hidden="true" />
      {status.label}
    </Badge>
  )
}

function draftFrom(integration: WhatsAppStatusIntegration): Draft {
  return {
    enabled: integration.enabled,
    baseUrl: integration.baseUrl ?? "",
    basicAuthUsername: integration.basicAuthUsername ?? "",
    basicAuthPassword: "",
  }
}

function isDirty(draft: Draft, integration: WhatsAppStatusIntegration) {
  return (
    draft.enabled !== integration.enabled ||
    draft.baseUrl !== (integration.baseUrl ?? "") ||
    draft.basicAuthUsername !== (integration.basicAuthUsername ?? "") ||
    draft.basicAuthPassword.length > 0
  )
}

export function WhatsAppStatusIntegrationCard() {
  const [integration, setIntegration] =
    useState<WhatsAppStatusIntegration | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [testState, setTestState] = useState<TestState>("not-tested")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setIntegration(await integrationsApi.getWhatsAppStatus())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("Tu sesión expiró. Vuelve a iniciar sesión.")
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error("No tienes permiso para administrar integraciones.")
      } else {
        toast.error("No pudimos cargar la integración WhatsApp Status.")
      }
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(
    () => Boolean(draft && integration && isDirty(draft, integration)),
    [draft, integration]
  )

  function closeConfiguration() {
    setDraft(null)
    setTestState("not-tested")
  }

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...update } : current))
    setTestState("not-tested")
  }

  async function testConfiguration() {
    if (!draft) return
    if (!draft.baseUrl.trim() || !draft.basicAuthUsername.trim()) {
      toast.error("La URL base y el usuario de Basic Auth son obligatorios.")
      return
    }
    if (
      !draft.basicAuthPassword.trim() &&
      !integration?.basicAuthPasswordConfigured
    ) {
      toast.error("La contraseña de Basic Auth es obligatoria.")
      return
    }

    setTestState("testing")
    try {
      await integrationsApi.testWhatsAppStatus({
        configuration: {
          baseUrl: draft.baseUrl,
          basicAuthUsername: draft.basicAuthUsername,
          ...(draft.basicAuthPassword
            ? { basicAuthPassword: draft.basicAuthPassword }
            : {}),
        },
      })
      setTestState("passed")
      toast.success("GOWA validó el borrador. Ya puedes guardarlo.")
    } catch (error) {
      setTestState("failed")
      if (error instanceof ApiError && error.status === 400) {
        toast.error("Revisa la URL y las credenciales de Basic Auth.")
      } else {
        toast.error("GOWA no pudo validar el borrador. Inténtalo de nuevo.")
      }
    }
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !integration) return

    if (draft.enabled && testState !== "passed") {
      toast.error("Prueba esta configuración antes de guardarla.")
      return
    }

    setSaving(true)
    try {
      const saved = await integrationsApi.saveWhatsAppStatus({
        enabled: draft.enabled,
        ...(draft.baseUrl !== (integration.baseUrl ?? "") ||
        draft.basicAuthUsername !== (integration.basicAuthUsername ?? "") ||
        draft.basicAuthPassword
          ? {
              configuration: {
                baseUrl: draft.baseUrl,
                basicAuthUsername: draft.basicAuthUsername,
                ...(draft.basicAuthPassword
                  ? { basicAuthPassword: draft.basicAuthPassword }
                  : {}),
              },
            }
          : {}),
      })
      setIntegration(saved)
      setDraft(draftFrom(saved))
      setTestState("not-tested")
      toast.success("Configuración de WhatsApp Status guardada.")
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error(
          "El borrador probado ya no coincide con la configuración a guardar."
        )
      } else {
        toast.error("No pudimos guardar la configuración de WhatsApp Status.")
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <IntegrationCardLoading />

  if (loadError || !integration) {
    return (
      <EmptyState
        action={<Button onClick={() => void load()}>Reintentar</Button>}
        description="No fue posible obtener el estado de WhatsApp Status."
        icon={PlugZap}
        title="Integración no disponible"
      />
    )
  }

  return (
    <>
      <Card variant="subtle">
        <CardHeader className="gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{integration.label}</CardTitle>
                <ProviderStatus readiness={integration.readiness} />
                <Badge variant="neutral">GOWA · Basic Auth</Badge>
              </div>
              <CardDescription>{integration.description}</CardDescription>
            </div>
            <Button
              onClick={() => {
                setDraft(draftFrom(integration))
                setTestState("not-tested")
              }}
              variant="brand-secondary"
            >
              <Settings2 data-icon="inline-start" />
              Ver y configurar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-7">
          <section
            aria-labelledby="whatsapp-capability-title"
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <KeyRound
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <h2
                id="whatsapp-capability-title"
                className="text-sm font-semibold"
              >
                Tipo de canal
              </h2>
            </div>
            {integration.capabilities.map((capability) => (
              <div
                className="rounded-lg border border-border bg-background p-4"
                key={capability.key}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{capability.label}</p>
                  <Badge variant={capability.enabled ? "success" : "neutral"}>
                    {capability.enabled ? "Activa" : "Desactivada"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {capability.description}
                </p>
              </div>
            ))}
          </section>

          <section
            aria-labelledby="whatsapp-configuration-title"
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <LockKeyhole
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <h2
                id="whatsapp-configuration-title"
                className="text-sm font-semibold"
              >
                Resumen de configuración
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  URL base
                </p>
                <p className="mt-1 text-sm break-all">
                  {integration.baseUrl ?? "Sin configurar"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Usuario Basic Auth
                </p>
                <p className="mt-1 text-sm break-all">
                  {integration.basicAuthUsername ?? "Sin configurar"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Contraseña Basic Auth
                </p>
                <p className="mt-1 text-sm">
                  {integration.basicAuthPasswordConfigured
                    ? "Configurada"
                    : "Sin configurar"}
                </p>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => !open && closeConfiguration()}
        open={draft !== null}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          {draft ? (
            <>
              <DialogHeader>
                <DialogTitle>Configurar WhatsApp Status</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-5"
                noValidate
                onSubmit={saveConfiguration}
              >
                <section className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        Disponibilidad del proveedor
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {draft.enabled
                          ? "Puede ofrecer WhatsApp Status cuando el conector esté probado."
                          : "WhatsApp Status no estará disponible en el portal."}
                      </p>
                    </div>
                    <Switch
                      aria-label="Habilitar WhatsApp Status"
                      checked={draft.enabled}
                      onCheckedChange={(enabled) => updateDraft({ enabled })}
                    />
                  </div>
                </section>

                <div className="grid gap-4">
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">
                      URL base del conector GOWA
                    </span>
                    <Input
                      onChange={(event) =>
                        updateDraft({ baseUrl: event.target.value })
                      }
                      placeholder="https://gowa.example.com"
                      required
                      type="url"
                      value={draft.baseUrl}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">
                      Usuario Basic Auth
                    </span>
                    <Input
                      autoComplete="username"
                      onChange={(event) =>
                        updateDraft({ basicAuthUsername: event.target.value })
                      }
                      required
                      value={draft.basicAuthUsername}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">
                      Contraseña Basic Auth
                    </span>
                    <Input
                      autoComplete="new-password"
                      onChange={(event) =>
                        updateDraft({ basicAuthPassword: event.target.value })
                      }
                      placeholder={
                        integration.basicAuthPasswordConfigured
                          ? "••••••••••••"
                          : undefined
                      }
                      required={!integration.basicAuthPasswordConfigured}
                      type="password"
                      value={draft.basicAuthPassword}
                    />
                  </label>
                </div>

                {draft.enabled ? (
                  <section
                    aria-labelledby="whatsapp-test-title"
                    className="space-y-3 border-t border-border pt-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3
                          id="whatsapp-test-title"
                          className="text-sm font-semibold"
                        >
                          Probar borrador
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          La prueba consulta solo la lista de dispositivos de
                          GOWA con Basic Auth antes de cifrar y guardar el
                          borrador.
                        </p>
                      </div>
                      <Button
                        disabled={
                          testState === "testing" || testState === "passed"
                        }
                        onClick={() => void testConfiguration()}
                        type="button"
                        variant={testState === "passed" ? "success" : "surface"}
                      >
                        {testState === "testing" ? (
                          <LoaderCircle
                            className="animate-spin"
                            data-icon="inline-start"
                          />
                        ) : testState === "passed" ? (
                          <CheckCircle2 data-icon="inline-start" />
                        ) : (
                          <ShieldCheck data-icon="inline-start" />
                        )}
                        {testState === "testing"
                          ? "Probando configuración"
                          : testState === "passed"
                            ? "Borrador validado"
                            : "Probar configuración"}
                      </Button>
                    </div>
                    {testState === "failed" ? (
                      <p className="flex items-center gap-2 text-sm text-destructive">
                        <XCircle aria-hidden="true" className="size-4" />
                        No se pudo validar el borrador.
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
                  <Button
                    onClick={closeConfiguration}
                    type="button"
                    variant="brand-secondary"
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={
                      !dirty ||
                      saving ||
                      (draft.enabled && testState !== "passed")
                    }
                    type="submit"
                  >
                    <Save data-icon="inline-start" />
                    {saving ? "Guardando" : "Guardar configuración"}
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
