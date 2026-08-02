"use client"

import { ApiError, integrationsApi } from "@workspace/api-client"
import type { EmailSmtpIntegration } from "@workspace/contracts"
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
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  LoaderCircle,
  Mail,
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
import { IntegrationCardLoading } from "./integration-card-loading"
import { IntegrationInsetCard } from "./integration-inset-card"

type Draft = {
  enabled: boolean
  host: string
  port: string
  secure: boolean
  username: string
  password: string
  fromEmail: string
  fromName: string
}

type TestState = "not-tested" | "testing" | "passed" | "failed"

const statusCopy = {
  ready: { label: "Listo", variant: "success" as const },
  incomplete: { label: "Incompleto", variant: "warning" as const },
  untested: { label: "Sin probar", variant: "warning" as const },
  disabled: { label: "Deshabilitado", variant: "neutral" as const },
}

function draftFrom(integration: EmailSmtpIntegration): Draft {
  return {
    enabled: integration.enabled,
    host: integration.host ?? "",
    port: integration.port ? String(integration.port) : "587",
    secure: integration.secure ?? false,
    username: integration.username ?? "",
    password: "",
    fromEmail: integration.fromEmail ?? "",
    fromName: integration.fromName ?? "",
  }
}

function isDirty(draft: Draft, integration: EmailSmtpIntegration) {
  return (
    draft.enabled !== integration.enabled ||
    draft.host !== (integration.host ?? "") ||
    Number(draft.port) !== integration.port ||
    draft.secure !== (integration.secure ?? false) ||
    draft.username !== (integration.username ?? "") ||
    draft.password.length > 0 ||
    draft.fromEmail !== (integration.fromEmail ?? "") ||
    draft.fromName !== (integration.fromName ?? "")
  )
}

export function EmailSmtpIntegrationCard() {
  const [integration, setIntegration] = useState<EmailSmtpIntegration | null>(
    null
  )
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testState, setTestState] = useState<TestState>("not-tested")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setIntegration(await integrationsApi.getEmailSmtp())
    } catch (error) {
      setLoadError(true)
      if (error instanceof ApiError && error.status === 403) {
        toast.error("No tienes permiso para administrar integraciones.")
      } else {
        toast.error("No pudimos cargar la integración SMTP.")
      }
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

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...update } : current))
    setTestState("not-tested")
  }

  function closeDialog() {
    setDraft(null)
    setTestState("not-tested")
  }

  function configuration() {
    if (!draft) return null
    const port = Number(draft.port)
    if (
      !draft.host.trim() ||
      !draft.username.trim() ||
      !draft.fromEmail.trim() ||
      !draft.fromName.trim()
    ) {
      toast.error("Completa host, usuario y remitente antes de continuar.")
      return null
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error("El puerto debe estar entre 1 y 65535.")
      return null
    }
    if (!draft.password && !integration?.passwordConfigured) {
      toast.error("La contraseña SMTP es obligatoria la primera vez.")
      return null
    }
    return {
      host: draft.host.trim(),
      port,
      secure: draft.secure,
      username: draft.username.trim(),
      ...(draft.password ? { password: draft.password } : {}),
      fromEmail: draft.fromEmail.trim(),
      fromName: draft.fromName.trim(),
    }
  }

  async function testConfiguration() {
    const values = configuration()
    if (!values) return
    setTestState("testing")
    try {
      await integrationsApi.testEmailSmtp({ configuration: values })
      setTestState("passed")
      toast.success("SMTP validó el borrador. Ya puedes guardarlo.")
    } catch {
      setTestState("failed")
      toast.error(
        "No pudimos validar SMTP. Revisa host, puerto y credenciales."
      )
    }
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !integration) return
    const values = configuration()
    if (!values) return
    if (draft.enabled && testState !== "passed") {
      toast.error("Prueba esta configuración antes de habilitarla.")
      return
    }

    setSaving(true)
    try {
      const saved = await integrationsApi.saveEmailSmtp({
        enabled: draft.enabled,
        ...(isDirty(draft, integration) ? { configuration: values } : {}),
      })
      setIntegration(saved)
      setDraft(draftFrom(saved))
      setTestState("not-tested")
      toast.success("Configuración SMTP guardada.")
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error(
          "El borrador probado ya no coincide con lo que intentas guardar."
        )
      } else {
        toast.error("No pudimos guardar la configuración SMTP.")
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
        description="No fue posible obtener el estado de SMTP."
        icon={Mail}
        title="Integración no disponible"
      />
    )
  }

  const status = statusCopy[integration.readiness]
  const StatusIcon =
    integration.readiness === "ready"
      ? CheckCircle2
      : integration.readiness === "disabled"
        ? Circle
        : CircleAlert

  return (
    <>
      <Card variant="subtle">
        <CardHeader className="gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{integration.label}</CardTitle>
                <Badge variant={status.variant}>
                  <StatusIcon aria-hidden="true" />
                  {status.label}
                </Badge>
                <Badge variant="neutral">Correo transaccional</Badge>
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
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <IntegrationInsetCard>
            <p className="text-xs font-medium text-muted-foreground">
              Servidor
            </p>
            <p className="mt-1 text-sm break-all">
              {integration.host ?? "Sin configurar"}
            </p>
          </IntegrationInsetCard>
          <IntegrationInsetCard>
            <p className="text-xs font-medium text-muted-foreground">
              Puerto y seguridad
            </p>
            <p className="mt-1 text-sm">
              {integration.port
                ? `${integration.port} · ${integration.secure ? "TLS directo" : "STARTTLS / sin TLS directo"}`
                : "Sin configurar"}
            </p>
          </IntegrationInsetCard>
          <IntegrationInsetCard>
            <p className="text-xs font-medium text-muted-foreground">
              Remitente
            </p>
            <p className="mt-1 text-sm break-all">
              {integration.fromEmail ?? "Sin configurar"}
            </p>
          </IntegrationInsetCard>
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => !open && closeDialog()}
        open={draft !== null}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden">
          {draft ? (
            <ScrollArea className="max-h-[calc(100vh-2rem)]">
              <div className="p-6">
                <DialogHeader>
                  <DialogTitle>Configurar SMTP general</DialogTitle>
                </DialogHeader>
                <form
                  className="flex flex-col gap-5"
                  noValidate
                  onSubmit={saveConfiguration}
                >
                  <IntegrationInsetCard className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        Disponibilidad del correo
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Al habilitarla, los flujos de autenticación entregarán
                        correo por este servidor.
                      </p>
                    </div>
                    <Switch
                      aria-label="Habilitar SMTP"
                      checked={draft.enabled}
                      onCheckedChange={(enabled) => updateDraft({ enabled })}
                    />
                  </IntegrationInsetCard>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium">
                      Host SMTP
                      <Input
                        autoComplete="off"
                        onChange={(event) =>
                          updateDraft({ host: event.target.value })
                        }
                        placeholder="smtp.example.com"
                        required
                        value={draft.host}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      Puerto
                      <Input
                        inputMode="numeric"
                        max="65535"
                        min="1"
                        onChange={(event) =>
                          updateDraft({ port: event.target.value })
                        }
                        required
                        type="number"
                        value={draft.port}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      Usuario SMTP
                      <Input
                        autoComplete="username"
                        onChange={(event) =>
                          updateDraft({ username: event.target.value })
                        }
                        required
                        value={draft.username}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      Contraseña SMTP
                      <Input
                        autoComplete="new-password"
                        onChange={(event) =>
                          updateDraft({ password: event.target.value })
                        }
                        placeholder={
                          integration.passwordConfigured
                            ? "••••••••••••"
                            : undefined
                        }
                        required={!integration.passwordConfigured}
                        type="password"
                        value={draft.password}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      Nombre del remitente
                      <Input
                        onChange={(event) =>
                          updateDraft({ fromName: event.target.value })
                        }
                        required
                        value={draft.fromName}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      Correo remitente
                      <Input
                        autoComplete="email"
                        onChange={(event) =>
                          updateDraft({ fromEmail: event.target.value })
                        }
                        required
                        type="email"
                        value={draft.fromEmail}
                      />
                    </label>
                  </div>
                  <IntegrationInsetCard className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Usar TLS directo</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Actívalo para puertos como 465. Para 587, usa STARTTLS
                        del servidor.
                      </p>
                    </div>
                    <Switch
                      aria-label="Usar TLS directo"
                      checked={draft.secure}
                      onCheckedChange={(secure) => updateDraft({ secure })}
                    />
                  </IntegrationInsetCard>
                  <IntegrationInsetCard className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-muted-foreground">
                      Reply-to
                      <Input
                        disabled
                        placeholder="No compatible con la API actual"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-muted-foreground">
                      Timeout
                      <Input
                        disabled
                        placeholder="No compatible con la API actual"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Estos valores requieren soporte adicional de API para
                      poder guardarse de forma segura.
                    </p>
                  </IntegrationInsetCard>
                  {draft.enabled ? (
                    <section className="flex flex-col gap-3 border-t border-border pt-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">
                            Probar borrador
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            La prueba abre una conexión SMTP con el borrador
                            antes de guardarlo.
                          </p>
                        </div>
                        <Button
                          disabled={
                            testState === "testing" || testState === "passed"
                          }
                          onClick={() => void testConfiguration()}
                          type="button"
                          variant={
                            testState === "passed" ? "success" : "surface"
                          }
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
                            ? "Probando"
                            : testState === "passed"
                              ? "Borrador validado"
                              : "Probar configuración"}
                        </Button>
                      </div>
                      {testState === "failed" ? (
                        <p className="flex items-center gap-2 text-sm text-destructive">
                          <XCircle aria-hidden="true" />
                          No se pudo validar el borrador.
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                  <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <Button
                      onClick={closeDialog}
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
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
