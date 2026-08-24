"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Copy,
  KeyRound,
  Link2,
  LockKeyhole,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react"

import { ApiError, integrationsApi } from "@workspace/api-client"
import type { ChannelProviderIntegration } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { useApiErrorMessage } from "@/lib/api-error-message"
import { useChannelLabels } from "@/lib/channel-labels"

import { IntegrationAvailabilityCard } from "./integration-availability-card"
import { IntegrationInsetCard } from "./integration-inset-card"

const statusVariants = {
  disabled: "neutral",
  incomplete: "warning",
  untested: "warning",
  ready: "success",
} as const

function ProviderStatus({
  readiness,
}: {
  readiness: ChannelProviderIntegration["readiness"]
}) {
  const t = useTranslations("integrations.channelProvider")
  const Icon =
    readiness === "ready"
      ? CheckCircle2
      : readiness === "disabled"
        ? Circle
        : CircleAlert

  return (
    <Badge variant={statusVariants[readiness]}>
      <Icon aria-hidden="true" />
      {t(`readiness.${readiness}`)}
    </Badge>
  )
}

/**
 * Integración de canal pintada desde su definición, con la misma composición
 * que Meta y Polar: la tarjeta resume y la hoja lateral edita. No sabe de qué
 * red se trata, así que añadir una no toca este archivo.
 */
export function ChannelProviderIntegrationCard({
  onSaved,
  provider,
}: {
  onSaved: (provider: ChannelProviderIntegration) => void
  provider: ChannelProviderIntegration
}) {
  const t = useTranslations("integrations.channelProvider")
  const tShared = useTranslations("integrations")
  const tIssue = useTranslations("integrations.issue")
  const labels = useChannelLabels()
  const apiErrorMessage = useApiErrorMessage()

  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(provider.enabled)
  const [values, setValues] = useState<Record<string, string>>(provider.values)
  const [capabilityKeys, setCapabilityKeys] = useState<string[]>(() =>
    provider.capabilities
      .filter((capability) => capability.enabled)
      .map((capability) => capability.key)
  )
  const [pending, setPending] = useState(false)
  const [tested, setTested] = useState(provider.readiness === "ready")
  const [wasOpen, setWasOpen] = useState(open)

  // Ajustar el estado durante el render en vez de en un efecto: al abrir la
  // hoja el borrador parte de lo guardado sin encadenar un segundo render.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setEnabled(provider.enabled)
      setValues(provider.values)
      setCapabilityKeys(
        provider.capabilities
          .filter((capability) => capability.enabled)
          .map((capability) => capability.key)
      )
      setTested(provider.readiness === "ready")
    }
  }

  const [firstIssue] = provider.issues
  const editableFields = provider.definition.fields.filter(
    (field) => !field.readOnly
  )
  const readOnlyFields = provider.definition.fields.filter(
    (field) => field.readOnly
  )
  const missingRequired = editableFields.some(
    (field) =>
      field.required &&
      !values[field.key]?.trim() &&
      !provider.secretsConfigured.includes(field.key)
  )

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    // Cambiar una credencial invalida la prueba, igual que hace la API al
    // guardar; si no, el botón diría que se puede activar cuando no.
    setTested(false)
  }

  function editableValues() {
    return Object.fromEntries(
      editableFields.map((field) => [field.key, values[field.key] ?? ""])
    )
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(tShared("copied", { label }))
    } catch {
      toast.error(tShared("copyFailed"))
    }
  }

  async function test() {
    setPending(true)
    try {
      const result = await integrationsApi.testChannelProvider(
        provider.providerKey,
        { values: editableValues() }
      )
      setTested(result.ok)
      if (result.ok) {
        toast.success(t("testPassed"))
      } else {
        toast.error(tIssue(result.issue ?? "unknown"))
      }
    } catch (error) {
      toast.error(
        apiErrorMessage(error instanceof ApiError ? error.code : undefined)
      )
    } finally {
      setPending(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try {
      onSaved(
        await integrationsApi.saveChannelProvider(provider.providerKey, {
          enabled,
          values: editableValues(),
          enabledCapabilityKeys: capabilityKeys as never,
        })
      )
      setOpen(false)
      toast.success(t("saved"))
    } catch (error) {
      toast.error(
        apiErrorMessage(error instanceof ApiError ? error.code : undefined)
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Card variant="subtle">
        <CardHeader className="gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{labels.provider(provider.providerKey)}</CardTitle>
                <ProviderStatus readiness={provider.readiness} />
              </div>
              <CardDescription>{t("description")}</CardDescription>
            </div>
            <Button onClick={() => setOpen(true)} variant="brand-secondary">
              <Settings2 data-icon="inline-start" />
              {tShared("viewAndConfigure")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-7">
          {firstIssue ? (
            <IntegrationInsetCard>
              <p className="flex items-center gap-2 text-sm text-warning">
                <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                {tIssue(firstIssue)}
              </p>
            </IntegrationInsetCard>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <KeyRound
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <h2 className="text-sm font-semibold">
                {tShared("channelTypes")}
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {provider.capabilities.map((capability) => (
                <IntegrationInsetCard key={capability.key}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {labels.capability(capability.key)}
                    </p>
                    <Badge variant={capability.enabled ? "success" : "neutral"}>
                      {capability.enabled
                        ? t("capabilityEnabled")
                        : t("capabilityDisabled")}
                    </Badge>
                  </div>
                </IntegrationInsetCard>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <LockKeyhole
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <h2 className="text-sm font-semibold">
                {tShared("configurationSummary")}
              </h2>
            </div>
            <CardGrid layout="2">
              {editableFields.map((field) => (
                <IntegrationInsetCard key={field.key}>
                  <p className="text-xs font-medium text-muted-foreground">
                    {t(`field.${field.key}`)}
                  </p>
                  <p className="mt-1 text-sm break-all">
                    {field.type === "secret"
                      ? provider.secretsConfigured.includes(field.key)
                        ? tShared("configured")
                        : tShared("notConfigured")
                      : provider.values[field.key] || tShared("notConfigured")}
                  </p>
                </IntegrationInsetCard>
              ))}
            </CardGrid>
          </section>

          {readOnlyFields.length ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Link2
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <h2 className="text-sm font-semibold">{t("callbackUrls")}</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("callbackUrlsHint")}
              </p>
              {readOnlyFields.map((field) => (
                <div className="flex flex-col gap-2" key={field.key}>
                  <p className="text-xs font-medium text-muted-foreground">
                    {t(`field.${field.key}`)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      className="font-mono text-xs"
                      readOnly
                      value={provider.values[field.key] ?? ""}
                    />
                    <Button
                      aria-label={t("copyField", {
                        label: t(`field.${field.key}`),
                      })}
                      onClick={() =>
                        void copy(
                          t(`field.${field.key}`),
                          provider.values[field.key] ?? ""
                        )
                      }
                      size="icon"
                      type="button"
                      variant="surface"
                    >
                      <Copy />
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}
        </CardContent>
      </Card>

      <Sheet onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
          <SheetHeader className="border-b">
            <SheetTitle>
              {t("sheetTitle", {
                provider: labels.provider(provider.providerKey),
              })}
            </SheetTitle>
            <SheetDescription>{t("sheetDescription")}</SheetDescription>
          </SheetHeader>
          <form
            aria-busy={pending}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => void submit(event)}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
              <IntegrationAvailabilityCard
                ariaLabel={t("enabled")}
                checked={enabled}
                description={t("enabledHint")}
                onCheckedChange={setEnabled}
                title={tShared("availability")}
              />

              <section className="flex flex-col gap-4 border-t border-border pt-5">
                <h3 className="text-sm font-semibold">
                  {t("credentials", {
                    provider: labels.provider(provider.providerKey),
                  })}
                </h3>
                <FieldGroup>
                  {editableFields.map((field) => {
                    const controlId = `provider-${provider.providerKey}-${field.key}`
                    const configured = provider.secretsConfigured.includes(
                      field.key
                    )
                    return (
                      <Field key={field.key}>
                        <FieldLabel htmlFor={controlId}>
                          {t(`field.${field.key}`)}{" "}
                          {field.required ? (
                            <span
                              aria-hidden="true"
                              className="text-destructive"
                            >
                              *
                            </span>
                          ) : null}
                        </FieldLabel>
                        <Input
                          aria-required={field.required}
                          disabled={pending}
                          id={controlId}
                          maxLength={field.maxLength ?? undefined}
                          onChange={(event) =>
                            update(field.key, event.target.value)
                          }
                          placeholder={
                            configured ? t("secretConfigured") : undefined
                          }
                          type={field.type === "secret" ? "password" : "text"}
                          value={values[field.key] ?? ""}
                        />
                      </Field>
                    )
                  })}
                </FieldGroup>
              </section>

              {provider.capabilities.length ? (
                <section className="flex flex-col gap-4 border-t border-border pt-5">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {tShared("channelTypes")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("capabilitiesHint")}
                    </p>
                  </div>
                  <FieldGroup className="gap-3" data-slot="checkbox-group">
                    {provider.capabilities.map((capability) => {
                      const controlId = `provider-capability-${capability.key}`
                      return (
                        <Field key={capability.key} orientation="horizontal">
                          <Checkbox
                            checked={capabilityKeys.includes(capability.key)}
                            disabled={pending}
                            id={controlId}
                            onCheckedChange={(value) =>
                              setCapabilityKeys((current) =>
                                value === true
                                  ? [...new Set([...current, capability.key])]
                                  : current.filter(
                                      (key) => key !== capability.key
                                    )
                              )
                            }
                          />
                          <FieldLabel htmlFor={controlId}>
                            <FieldContent>
                              <FieldTitle>
                                {labels.capability(capability.key)}
                              </FieldTitle>
                            </FieldContent>
                          </FieldLabel>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                </section>
              ) : null}

              <section className="flex flex-col gap-3 border-t border-border pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{t("test")}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("testHint")}
                    </p>
                  </div>
                  <Button
                    disabled={pending || missingRequired || tested}
                    onClick={() => void test()}
                    type="button"
                    variant={tested ? "success" : "surface"}
                  >
                    {pending ? (
                      <Spinner data-icon="inline-start" />
                    ) : tested ? (
                      <CheckCircle2 data-icon="inline-start" />
                    ) : (
                      <ShieldCheck data-icon="inline-start" />
                    )}
                    {tested ? t("testPassed") : t("test")}
                  </Button>
                </div>
              </section>
            </div>
            <SheetFooter className="flex-row justify-end border-t">
              <Button
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
                variant="brand-secondary"
              >
                {tShared("cancel")}
              </Button>
              <Button
                // Activarla sin prueba vigente abriría el canal en el Portal sin
                // saber si las credenciales sirven.
                disabled={pending || missingRequired || (enabled && !tested)}
                type="submit"
              >
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save aria-hidden="true" data-icon="inline-start" />
                )}
                {tShared("saveConfiguration")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
