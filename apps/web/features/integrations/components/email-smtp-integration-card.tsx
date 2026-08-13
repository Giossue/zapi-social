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
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Mail,
  Save,
  Send,
  Server,
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
import { IntegrationAvailabilityCard } from "./integration-availability-card"
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
  const complete = Boolean(
    draft &&
    draft.host.trim() &&
    draft.port.trim() &&
    draft.username.trim() &&
    draft.fromEmail.trim() &&
    draft.fromName.trim() &&
    (integration?.passwordConfigured || draft.password.trim())
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
      setDraft(null)
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
        action={<RetryButton onClick={() => void load()} />}
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
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{integration.label}</CardTitle>
                <Badge variant={status.variant}>
                  <StatusIcon aria-hidden="true" />
                  {status.label}
                </Badge>
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
            <div className="flex items-center gap-2">
              <Server
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <p className="text-xs font-medium text-muted-foreground">
                Servidor
              </p>
            </div>
            <p className="mt-1 text-sm break-all">
              {integration.host ?? "Sin configurar"}
            </p>
          </IntegrationInsetCard>
          <IntegrationInsetCard>
            <div className="flex items-center gap-2">
              <ShieldCheck
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <p className="text-xs font-medium text-muted-foreground">
                Puerto y seguridad
              </p>
            </div>
            <p className="mt-1 text-sm">
              {integration.port
                ? `${integration.port} · ${integration.secure ? "TLS directo" : "STARTTLS / sin TLS directo"}`
                : "Sin configurar"}
            </p>
          </IntegrationInsetCard>
          <IntegrationInsetCard>
            <div className="flex items-center gap-2">
              <Send
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <p className="text-xs font-medium text-muted-foreground">
                Remitente
              </p>
            </div>
            <p className="mt-1 text-sm break-all">
              {integration.fromEmail ?? "Sin configurar"}
            </p>
          </IntegrationInsetCard>
        </CardContent>
      </Card>

      <Sheet
        onOpenChange={(open) => !open && !saving && closeDialog()}
        open={draft !== null}
      >
        <SheetContent
          className="w-full gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-xl"
          side="right"
        >
          {draft ? (
            <form
              className="flex min-h-full flex-col"
              noValidate
              onSubmit={saveConfiguration}
            >
              <SheetHeader className="border-b">
                <SheetTitle>Configurar SMTP general</SheetTitle>
                <SheetDescription>
                  Define el servidor que entrega los correos transaccionales.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 p-4">
                <IntegrationAvailabilityCard
                  ariaLabel="Habilitar SMTP"
                  checked={draft.enabled}
                  description="Al habilitarlo, los flujos de autenticación entregarán correo por este servidor."
                  onCheckedChange={(enabled) => updateDraft({ enabled })}
                  title="Disponibilidad del proveedor"
                />

                <section
                  aria-labelledby="smtp-credentials-title"
                  className="flex flex-col gap-4"
                >
                  <h3
                    className="text-sm font-semibold"
                    id="smtp-credentials-title"
                  >
                    Servidor y remitente
                  </h3>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>
                        Host SMTP
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        autoComplete="off"
                        onChange={(event) =>
                          updateDraft({ host: event.target.value })
                        }
                        placeholder="smtp.example.com"
                        value={draft.host}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        Puerto
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        inputMode="numeric"
                        max="65535"
                        min="1"
                        onChange={(event) =>
                          updateDraft({ port: event.target.value })
                        }
                        type="number"
                        value={draft.port}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        Usuario SMTP
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        autoComplete="username"
                        onChange={(event) =>
                          updateDraft({ username: event.target.value })
                        }
                        value={draft.username}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        Contraseña SMTP
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        autoComplete="new-password"
                        onChange={(event) =>
                          updateDraft({ password: event.target.value })
                        }
                        placeholder={
                          integration.passwordConfigured
                            ? "••••••••••••"
                            : undefined
                        }
                        type="password"
                        value={draft.password}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        Nombre del remitente
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        onChange={(event) =>
                          updateDraft({ fromName: event.target.value })
                        }
                        value={draft.fromName}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        Correo remitente
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        autoComplete="email"
                        onChange={(event) =>
                          updateDraft({ fromEmail: event.target.value })
                        }
                        type="email"
                        value={draft.fromEmail}
                      />
                    </Field>
                  </FieldGroup>
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
                </section>

                <section
                  aria-labelledby="smtp-additional-title"
                  className="flex flex-col gap-4 border-t border-border pt-5"
                >
                  <h3
                    className="text-sm font-semibold"
                    id="smtp-additional-title"
                  >
                    Opciones adicionales
                  </h3>
                  <IntegrationInsetCard>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                      <Field data-disabled>
                        <FieldLabel>Reply-to</FieldLabel>
                        <Input
                          disabled
                          placeholder="No compatible con la API actual"
                        />
                      </Field>
                      <Field data-disabled>
                        <FieldLabel>Timeout</FieldLabel>
                        <Input
                          disabled
                          placeholder="No compatible con la API actual"
                        />
                      </Field>
                    </FieldGroup>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Estos valores requieren soporte adicional de API para
                      poder guardarse de forma segura.
                    </p>
                  </IntegrationInsetCard>
                </section>
                {draft.enabled ? (
                  <section
                    aria-labelledby="smtp-test-title"
                    className="flex flex-col gap-3 border-t border-border pt-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3
                          className="text-sm font-semibold"
                          id="smtp-test-title"
                        >
                          Probar borrador
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          La prueba abre una conexión SMTP con el borrador antes
                          de guardarlo.
                        </p>
                      </div>
                      <Button
                        disabled={
                          saving ||
                          !complete ||
                          testState === "testing" ||
                          testState === "passed"
                        }
                        onClick={() => void testConfiguration()}
                        type="button"
                        variant={testState === "passed" ? "success" : "surface"}
                      >
                        {testState === "testing" ? (
                          <Spinner data-icon="inline-start" />
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
              </div>
              <SheetFooter className="flex-row justify-end border-t">
                <Button
                  disabled={saving}
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
                    !complete ||
                    (draft.enabled && testState !== "passed")
                  }
                  type="submit"
                >
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Save data-icon="inline-start" />
                  )}
                  {saving ? "Guardando" : "Guardar configuración"}
                </Button>
              </SheetFooter>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
