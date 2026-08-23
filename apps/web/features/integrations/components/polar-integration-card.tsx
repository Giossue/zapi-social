"use client"

import { ApiError, polarApi } from "@workspace/api-client"
import type { PolarIntegration } from "@workspace/contracts"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { RetryButton } from "@workspace/ui/components/retry-button"
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
import { toast } from "@workspace/ui/components/toast"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  CheckCircle2,
  Circle,
  CirclePower,
  CircleAlert,
  Copy,
  Globe2,
  Link2,
  ListChecks,
  PlugZap,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  XCircle,
} from "lucide-react"

import { BrandPolar } from "@/components/brand-icons"
import * as React from "react"
import { IntegrationAvailabilityCard } from "./integration-availability-card"
import { IntegrationCardLoading } from "./integration-card-loading"
import { IntegrationInsetCard } from "./integration-inset-card"

type PolarDraft = {
  accessToken: string
  billingAddress: boolean
  discountCodes: boolean
  enabled: boolean
  environment: PolarIntegration["environment"]
  monthlyProductId: string
  oneTimeProductId: string
  recurring: boolean
  webhookSecret: string
  yearlyProductId: string
}

type TestState = "not-tested" | "testing" | "passed" | "failed"

const requiredEvents = [
  "checkout.updated",
  "checkout.expired",
  "order.paid",
  "order.refunded",
  "subscription.active",
  "subscription.updated",
  "subscription.past_due",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.revoked",
]

const statusCopy = {
  ready: { label: "Listo", variant: "success" as const },
  incomplete: { label: "Incompleto", variant: "warning" as const },
  untested: { label: "Sin probar", variant: "warning" as const },
  disabled: { label: "Deshabilitado", variant: "neutral" as const },
}

function draftFrom(integration: PolarIntegration): PolarDraft {
  return {
    accessToken: "",
    billingAddress: integration.billingAddress,
    discountCodes: integration.discountCodes,
    enabled: integration.enabled,
    environment: integration.environment,
    monthlyProductId: integration.monthlyProductId,
    oneTimeProductId: integration.oneTimeProductId,
    recurring: integration.recurring,
    webhookSecret: "",
    yearlyProductId: integration.yearlyProductId,
  }
}

function isDirty(draft: PolarDraft, integration: PolarIntegration) {
  return (
    draft.enabled !== integration.enabled ||
    draft.environment !== integration.environment ||
    draft.recurring !== integration.recurring ||
    draft.monthlyProductId !== integration.monthlyProductId ||
    draft.yearlyProductId !== integration.yearlyProductId ||
    draft.oneTimeProductId !== integration.oneTimeProductId ||
    draft.discountCodes !== integration.discountCodes ||
    draft.billingAddress !== integration.billingAddress ||
    draft.accessToken.length > 0 ||
    draft.webhookSecret.length > 0
  )
}

function canComplete(draft: PolarDraft, integration: PolarIntegration) {
  if (!draft.enabled) return true
  return Boolean(
    (integration.hasAccessToken || draft.accessToken.trim().length > 0) &&
    (integration.hasWebhookSecret || draft.webhookSecret.trim().length > 0) &&
    (!draft.recurring ||
      (draft.monthlyProductId.trim().length > 0 &&
        draft.yearlyProductId.trim().length > 0))
  )
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <FieldLabel>
      {children}
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
    </FieldLabel>
  )
}

export function PolarIntegrationPreview() {
  const [integration, setIntegration] = React.useState<PolarIntegration | null>(
    null
  )
  const [draft, setDraft] = React.useState<PolarDraft | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [testState, setTestState] = React.useState<TestState>("not-tested")

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setIntegration(await polarApi.get())
    } catch {
      setLoadError(true)
      toast.error("No se pudo cargar la configuración Polar.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function updateDraft(update: Partial<PolarDraft>) {
    setDraft((current) => (current ? { ...current, ...update } : current))
    setTestState("not-tested")
  }

  function closeConfiguration() {
    setDraft(null)
    setTestState("not-tested")
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("URL copiada.")
    } catch {
      toast.error("No se pudo copiar la URL.")
    }
  }

  async function testConfiguration() {
    if (!draft || !integration) return
    if (!canComplete(draft, integration)) {
      toast.error("Completa las credenciales y productos obligatorios.")
      return
    }

    setTestState("testing")
    try {
      const result = await polarApi.test({
        configuration: {
          environment: draft.environment,
          recurring: draft.recurring,
          monthlyProductId: draft.monthlyProductId,
          yearlyProductId: draft.yearlyProductId,
          oneTimeProductId: draft.oneTimeProductId,
          discountCodes: draft.discountCodes,
          billingAddress: draft.billingAddress,
          accessToken: draft.accessToken || undefined,
          webhookSecret: draft.webhookSecret || undefined,
        },
      })
      setTestState("passed")
      if (!isDirty(draft, integration)) {
        setIntegration({
          ...integration,
          lastTestedAt: result.testedAt,
          readiness: draft.enabled ? "ready" : "disabled",
        })
        toast.success("Configuración Polar comprobada.")
      } else {
        toast.success("Polar validó el borrador. Ya puedes guardarlo.")
      }
    } catch (error) {
      setTestState("failed")
      if (error instanceof ApiError && error.status === 400) {
        toast.error("Completa las credenciales y productos obligatorios.")
      } else {
        toast.error(
          "Polar no pudo validar las credenciales o productos configurados."
        )
      }
    }
  }

  async function saveConfiguration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !integration) return

    if (!canComplete(draft, integration)) {
      toast.error("Completa las credenciales y productos obligatorios.")
      return
    }
    if (draft.enabled && testState !== "passed") {
      toast.error("Prueba esta configuración antes de guardarla.")
      return
    }

    setSaving(true)
    try {
      const saved = await polarApi.save({
        enabled: draft.enabled,
        environment: draft.environment,
        recurring: draft.recurring,
        monthlyProductId: draft.monthlyProductId,
        yearlyProductId: draft.yearlyProductId,
        oneTimeProductId: draft.oneTimeProductId,
        discountCodes: draft.discountCodes,
        billingAddress: draft.billingAddress,
        accessToken: draft.accessToken || undefined,
        webhookSecret: draft.webhookSecret || undefined,
      })
      setIntegration(saved)
      closeConfiguration()
      toast.success("Configuración Polar guardada.")
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error(
          "El borrador cambió o no coincide con la última prueba. Pruébalo nuevamente."
        )
      } else {
        toast.error("No se pudo guardar la configuración Polar.")
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
        description="No fue posible obtener el estado de Polar.sh."
        icon={PlugZap}
        title="Integración no disponible"
      />
    )
  }

  const complete = Boolean(draft && canComplete(draft, integration))
  const dirty = Boolean(draft && isDirty(draft, integration))
  const status = statusCopy[integration.readiness]
  const StatusIcon =
    integration.readiness === "ready"
      ? CheckCircle2
      : integration.readiness === "disabled"
        ? Circle
        : CircleAlert
  const endpoints = [
    ["Webhook", integration.webhookUrl],
    ["Retorno exitoso", integration.successUrl],
    ["Retorno cancelado", integration.cancelUrl],
  ] as const

  return (
    <>
      <Card variant="subtle">
        <CardHeader className="gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <BrandPolar className="size-5 shrink-0" />
                <CardTitle>Polar.sh</CardTitle>
                <Badge variant={status.variant}>
                  <StatusIcon aria-hidden="true" />
                  {status.label}
                </Badge>
              </div>
              <CardDescription>
                Checkout, suscripciones e impuestos administrados por Polar como
                Merchant of Record.
              </CardDescription>
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
        <CardContent className="flex flex-col gap-7">
          <div className="grid gap-3 sm:grid-cols-3">
            <IntegrationInsetCard>
              <div className="flex items-center gap-2">
                <CirclePower
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <p className="text-xs font-medium text-muted-foreground">
                  Estado
                </p>
              </div>
              <p className="mt-1 text-sm">
                {integration.enabled ? "Disponible" : "Deshabilitada"}
              </p>
            </IntegrationInsetCard>
            <IntegrationInsetCard>
              <div className="flex items-center gap-2">
                <Globe2
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <p className="text-xs font-medium text-muted-foreground">
                  Ambiente
                </p>
              </div>
              <p className="mt-1 text-sm">
                {integration.environment === "live" ? "Producción" : "Sandbox"}
              </p>
            </IntegrationInsetCard>
            <IntegrationInsetCard>
              <div className="flex items-center gap-2">
                <RefreshCcw
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <p className="text-xs font-medium text-muted-foreground">
                  Productos recurrentes
                </p>
              </div>
              <p className="mt-1 text-sm">
                {integration.recurring ? "Mensual y anual" : "Desactivados"}
              </p>
            </IntegrationInsetCard>
          </div>

          <section
            aria-labelledby="polar-webhooks-title"
            className="flex flex-col gap-3"
          >
            <div className="flex items-start gap-2">
              <Link2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div>
                <h2 className="text-sm font-semibold" id="polar-webhooks-title">
                  Webhooks y retornos
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registra estas URLs en Polar. La API las genera y aquí son de
                  solo lectura.
                </p>
              </div>
            </div>
            <FieldGroup>
              {endpoints.map(([label, value]) => (
                <Field key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      className="font-mono text-xs"
                      readOnly
                      value={value}
                    />
                    <Button
                      aria-label={`Copiar ${label}`}
                      onClick={() => void copy(value)}
                      size="icon"
                      type="button"
                      variant="brand-secondary"
                    >
                      <Copy />
                    </Button>
                  </div>
                </Field>
              ))}
            </FieldGroup>
          </section>

          <section
            aria-labelledby="polar-required-events"
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <ListChecks
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <h2 className="text-sm font-semibold" id="polar-required-events">
                Eventos requeridos
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {requiredEvents.map((event) => (
                <Badge className="font-mono" key={event} variant="outline">
                  {event}
                </Badge>
              ))}
            </div>
          </section>
        </CardContent>
      </Card>

      <Sheet
        onOpenChange={(open) => !open && !saving && closeConfiguration()}
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
                <SheetTitle>Configurar Polar.sh</SheetTitle>
                <SheetDescription>
                  Administra la única pasarela de pagos de la plataforma.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 p-4">
                <IntegrationAvailabilityCard
                  ariaLabel="Habilitar Polar.sh"
                  checked={draft.enabled}
                  description="Al habilitarla, Polar procesa checkouts y suscripciones."
                  onCheckedChange={(enabled) => updateDraft({ enabled })}
                  title="Disponibilidad del proveedor"
                />

                <section
                  aria-labelledby="polar-credentials"
                  className="flex flex-col gap-4"
                >
                  <h3 className="text-sm font-semibold" id="polar-credentials">
                    Credenciales
                  </h3>
                  <FieldGroup>
                    <Field>
                      <RequiredLabel>Ambiente</RequiredLabel>
                      <Select
                        onValueChange={(environment) =>
                          updateDraft({
                            environment:
                              environment as PolarDraft["environment"],
                          })
                        }
                        value={draft.environment}
                      >
                        <SelectTrigger aria-required="true">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="sandbox">Sandbox</SelectItem>
                            <SelectItem value="live">Producción</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Cada ambiente usa credenciales y productos distintos.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <RequiredLabel>Organization Access Token</RequiredLabel>
                      <Input
                        aria-required="true"
                        autoComplete="new-password"
                        onChange={(event) =>
                          updateDraft({ accessToken: event.target.value })
                        }
                        placeholder={
                          integration.hasAccessToken
                            ? "Token configurado · escribe para reemplazar"
                            : "polar_oat_…"
                        }
                        type="password"
                        value={draft.accessToken}
                      />
                    </Field>
                    <Field>
                      <RequiredLabel>Secreto de webhook</RequiredLabel>
                      <Input
                        aria-required="true"
                        autoComplete="new-password"
                        onChange={(event) =>
                          updateDraft({ webhookSecret: event.target.value })
                        }
                        placeholder={
                          integration.hasWebhookSecret
                            ? "Secreto configurado · escribe para reemplazar"
                            : "polar_whs_…"
                        }
                        type="password"
                        value={draft.webhookSecret}
                      />
                      <FieldDescription>
                        Verifica pagos, reembolsos y cambios de suscripción.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </section>

                <section
                  aria-labelledby="polar-products"
                  className="flex flex-col gap-4 border-t border-border pt-5"
                >
                  <h3 className="text-sm font-semibold" id="polar-products">
                    Productos y checkout
                  </h3>
                  <FieldGroup>
                    <IntegrationInsetCard className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Suscripciones</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Renovaciones mensuales y anuales.
                        </p>
                      </div>
                      <Switch
                        aria-label="Habilitar suscripciones"
                        checked={draft.recurring}
                        onCheckedChange={(recurring) =>
                          updateDraft({ recurring })
                        }
                      />
                    </IntegrationInsetCard>
                    <Field>
                      <RequiredLabel>Producto mensual</RequiredLabel>
                      <Input
                        aria-required="true"
                        disabled={!draft.recurring}
                        onChange={(event) =>
                          updateDraft({ monthlyProductId: event.target.value })
                        }
                        value={draft.monthlyProductId}
                      />
                    </Field>
                    <Field>
                      <RequiredLabel>Producto anual</RequiredLabel>
                      <Input
                        aria-required="true"
                        disabled={!draft.recurring}
                        onChange={(event) =>
                          updateDraft({ yearlyProductId: event.target.value })
                        }
                        value={draft.yearlyProductId}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Producto de pago único</FieldLabel>
                      <Input
                        onChange={(event) =>
                          updateDraft({ oneTimeProductId: event.target.value })
                        }
                        value={draft.oneTimeProductId}
                      />
                      <FieldDescription>
                        Se usa para paquetes de créditos y compras no
                        recurrentes.
                      </FieldDescription>
                    </Field>
                    <IntegrationInsetCard className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          Códigos de descuento
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Combina Polar con las reglas de cupones de Zapi.
                        </p>
                      </div>
                      <Switch
                        aria-label="Permitir códigos de descuento"
                        checked={draft.discountCodes}
                        onCheckedChange={(discountCodes) =>
                          updateDraft({ discountCodes })
                        }
                      />
                    </IntegrationInsetCard>
                    <IntegrationInsetCard className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          Dirección de facturación
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Solicitarla durante el checkout.
                        </p>
                      </div>
                      <Switch
                        aria-label="Solicitar dirección de facturación"
                        checked={draft.billingAddress}
                        onCheckedChange={(billingAddress) =>
                          updateDraft({ billingAddress })
                        }
                      />
                    </IntegrationInsetCard>
                    <p className="text-sm text-muted-foreground">
                      El total después del descuento debe ser de al menos USD
                      0.50.
                    </p>
                  </FieldGroup>
                </section>

                {draft.enabled ? (
                  <section
                    aria-labelledby="polar-test"
                    className="flex flex-col gap-3 border-t border-border pt-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold" id="polar-test">
                          Probar borrador
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Comprueba credenciales, ambiente y productos con Polar
                          antes de guardar.
                        </p>
                      </div>
                      <Button
                        disabled={
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
                          ? "Comprobando"
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
              </div>

              <SheetFooter className="flex-row justify-end border-t">
                <Button
                  disabled={saving}
                  onClick={closeConfiguration}
                  type="button"
                  variant="brand-secondary"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={
                    !dirty ||
                    !complete ||
                    saving ||
                    testState === "testing" ||
                    (draft.enabled && testState !== "passed")
                  }
                  type="submit"
                >
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Save aria-hidden="true" data-icon="inline-start" />
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
