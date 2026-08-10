"use client"

import * as React from "react"
import { polarApi } from "@workspace/api-client"
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Link,
  Save,
  ShieldCheck,
} from "lucide-react"
import { toast } from "@workspace/ui/components/toast"

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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { Switch } from "@workspace/ui/components/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

const events = [
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
  const [enabled, setEnabled] = React.useState(false)
  const [recurring, setRecurring] = React.useState(true)
  const [environment, setEnvironment] = React.useState("sandbox")
  const [accessToken, setAccessToken] = React.useState("")
  const [webhookSecret, setWebhookSecret] = React.useState("")
  const [monthlyProduct, setMonthlyProduct] = React.useState("")
  const [yearlyProduct, setYearlyProduct] = React.useState("")
  const [oneTimeProduct, setOneTimeProduct] = React.useState("")
  const [discountCodes, setDiscountCodes] = React.useState(true)
  const [billingAddress, setBillingAddress] = React.useState(false)
  const [hasStoredAccessToken, setHasStoredAccessToken] = React.useState(false)
  const [hasStoredWebhookSecret, setHasStoredWebhookSecret] =
    React.useState(false)
  const [configured, setConfigured] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [endpoints, setEndpoints] = React.useState<
    ReadonlyArray<readonly [string, string]>
  >([])
  const canSave =
    !enabled ||
    ((hasStoredAccessToken || accessToken.trim().length > 0) &&
      (hasStoredWebhookSecret || webhookSecret.trim().length > 0) &&
      (!recurring ||
        (monthlyProduct.trim().length > 0 && yearlyProduct.trim().length > 0)))

  React.useEffect(() => {
    let current = true
    void polarApi
      .get()
      .then((integration) => {
        if (!current) return
        setEnabled(integration.enabled)
        setConfigured(integration.configured)
        setEnvironment(integration.environment)
        setRecurring(integration.recurring)
        setMonthlyProduct(integration.monthlyProductId)
        setYearlyProduct(integration.yearlyProductId)
        setOneTimeProduct(integration.oneTimeProductId)
        setDiscountCodes(integration.discountCodes)
        setBillingAddress(integration.billingAddress)
        setHasStoredAccessToken(integration.hasAccessToken)
        setHasStoredWebhookSecret(integration.hasWebhookSecret)
        setEndpoints([
          ["Webhook", integration.webhookUrl],
          ["Retorno exitoso", integration.successUrl],
          ["Retorno cancelado", integration.cancelUrl],
        ])
      })
      .catch(() => toast.error("No se pudo cargar la configuración Polar."))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [])

  if (loading) return <PageLoading className="min-h-80" />

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("URL copiada.")
    } catch {
      toast.error("No se pudo copiar la URL.")
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSave) return
        setSaving(true)
        void polarApi
          .save({
            enabled,
            environment: environment as "sandbox" | "live",
            recurring,
            monthlyProductId: monthlyProduct,
            yearlyProductId: yearlyProduct,
            oneTimeProductId: oneTimeProduct,
            discountCodes,
            billingAddress,
            accessToken: accessToken || undefined,
            webhookSecret: webhookSecret || undefined,
          })
          .then((integration) => {
            setConfigured(integration.configured)
            setHasStoredAccessToken(integration.hasAccessToken)
            setHasStoredWebhookSecret(integration.hasWebhookSecret)
            setAccessToken("")
            setWebhookSecret("")
            toast.success("Configuración Polar guardada.")
          })
          .catch(() =>
            toast.error("No se pudo guardar la configuración Polar.")
          )
          .finally(() => setSaving(false))
      }}
    >
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Polar.sh</CardTitle>
                <Badge variant={configured ? "success" : "warning"}>
                  <CheckCircle2 />
                  {configured ? "Configurado" : "Incompleto"}
                </Badge>
                <Badge variant="secondary">Única pasarela</Badge>
              </div>
              <CardDescription>
                Checkout, suscripciones e impuestos administrados por Polar como
                Merchant of Record.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Disponible</span>
              <Switch
                aria-label="Habilitar Polar.sh"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="credentials">
            <TabsList aria-label="Configuración Polar">
              <TabsTrigger value="credentials">Credenciales</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            </TabsList>

            <TabsContent className="pt-5" value="credentials">
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <RequiredLabel>Ambiente</RequiredLabel>
                    <Select onValueChange={setEnvironment} value={environment}>
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
                      Sandbox y producción usan credenciales y productos
                      distintos.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <RequiredLabel>Organization Access Token</RequiredLabel>
                    <Input
                      aria-required="true"
                      autoComplete="new-password"
                      onChange={(event) => setAccessToken(event.target.value)}
                      placeholder={
                        hasStoredAccessToken
                          ? "Token configurado · escribe para reemplazar"
                          : "polar_oat_…"
                      }
                      type="password"
                      value={accessToken}
                    />
                  </Field>
                </div>
                <Field>
                  <RequiredLabel>Secreto de webhook</RequiredLabel>
                  <Input
                    aria-required="true"
                    autoComplete="new-password"
                    onChange={(event) => setWebhookSecret(event.target.value)}
                    placeholder={
                      hasStoredWebhookSecret
                        ? "Secreto configurado · escribe para reemplazar"
                        : "polar_whs_…"
                    }
                    type="password"
                    value={webhookSecret}
                  />
                  <FieldDescription>
                    Verifica la firma antes de procesar pagos, reembolsos o
                    cambios de suscripción.
                  </FieldDescription>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Suscripciones</p>
                      <p className="text-xs text-muted-foreground">
                        Renovaciones mensuales y anuales.
                      </p>
                    </div>
                    <Switch
                      aria-label="Habilitar suscripciones"
                      checked={recurring}
                      onCheckedChange={setRecurring}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        Dirección de facturación
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solicitarla durante checkout.
                      </p>
                    </div>
                    <Switch
                      aria-label="Solicitar dirección de facturación"
                      checked={billingAddress}
                      onCheckedChange={setBillingAddress}
                    />
                  </div>
                </div>
              </FieldGroup>
            </TabsContent>

            <TabsContent className="pt-5" value="products">
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <RequiredLabel>Producto mensual</RequiredLabel>
                    <Input
                      aria-required="true"
                      onChange={(event) =>
                        setMonthlyProduct(event.target.value)
                      }
                      value={monthlyProduct}
                    />
                  </Field>
                  <Field>
                    <RequiredLabel>Producto anual</RequiredLabel>
                    <Input
                      aria-required="true"
                      onChange={(event) => setYearlyProduct(event.target.value)}
                      value={yearlyProduct}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Producto de pago único</FieldLabel>
                  <Input
                    onChange={(event) => setOneTimeProduct(event.target.value)}
                    value={oneTimeProduct}
                  />
                  <FieldDescription>
                    Se usa para paquetes de créditos u otras compras no
                    recurrentes.
                  </FieldDescription>
                </Field>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      Códigos de descuento de Polar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Permite combinarlos con las reglas de cupones de Zapi.
                    </p>
                  </div>
                  <Switch
                    aria-label="Permitir códigos de descuento"
                    checked={discountCodes}
                    onCheckedChange={setDiscountCodes}
                  />
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <CreditCard
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-muted-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    Zapi envía el importe local como precio dinámico. El total
                    después del descuento debe ser de al menos USD 0.50.
                  </p>
                </div>
              </FieldGroup>
            </TabsContent>

            <TabsContent className="space-y-5 pt-5" value="webhooks">
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <h3 className="text-sm font-medium">Endpoints</h3>
                </div>
                {endpoints.map(([label, value]) => (
                  <div className="grid gap-1.5" key={label}>
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
                  </div>
                ))}
              </section>
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <h3 className="text-sm font-medium">Eventos requeridos</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {events.map((event) => (
                    <Badge className="font-mono" key={event} variant="outline">
                      {event}
                    </Badge>
                  ))}
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button disabled={!canSave || saving} type="submit">
          <Save aria-hidden="true" data-icon="inline-start" />
          Guardar configuración
        </Button>
      </div>
    </form>
  )
}
