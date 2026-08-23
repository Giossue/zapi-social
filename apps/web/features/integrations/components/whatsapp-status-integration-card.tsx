"use client"

import { ApiError, integrationsApi } from "@workspace/api-client"
import { IntegrationAvailabilityCard } from "./integration-availability-card"
import { IntegrationInsetCard } from "./integration-inset-card"
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
import { toast } from "@workspace/ui/components/toast"
import { Spinner } from "@workspace/ui/components/spinner"
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
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { useTranslations } from "next-intl"

import { BrandWhatsApp } from "@/components/brand-icons"

type Draft = {
  enabled: boolean
  baseUrl: string
  basicAuthUsername: string
  basicAuthPassword: string
}

type TestState = "not-tested" | "testing" | "passed" | "failed"

const statusVariants = {
  ready: "success" as const,
  incomplete: "warning" as const,
  untested: "warning" as const,
  disabled: "neutral" as const,
}

function ProviderStatus({
  readiness,
}: {
  readiness: WhatsAppStatusIntegration["readiness"]
}) {
  const t = useTranslations("integrations")
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
  const t = useTranslations("integrations")
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
        toast.error(t("sessionExpired"))
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error(t("forbidden"))
      } else {
        toast.error(t("whatsapp.loadFailed"))
      }
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(
    () => Boolean(draft && integration && isDirty(draft, integration)),
    [draft, integration]
  )
  const complete = Boolean(
    draft &&
    draft.baseUrl.trim() &&
    draft.basicAuthUsername.trim() &&
    (integration?.basicAuthPasswordConfigured || draft.basicAuthPassword.trim())
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
      toast.error(t("whatsapp.baseUrlRequired"))
      return
    }
    if (
      !draft.basicAuthPassword.trim() &&
      !integration?.basicAuthPasswordConfigured
    ) {
      toast.error(t("whatsapp.passwordRequired"))
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
      toast.success(t("whatsapp.testOk"))
    } catch (error) {
      setTestState("failed")
      if (error instanceof ApiError && error.status === 400) {
        toast.error(t("whatsapp.checkCredentials"))
      } else {
        toast.error(t("whatsapp.testFailed"))
      }
    }
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !integration) return

    if (draft.enabled && testState !== "passed") {
      toast.error(t("testBeforeSave"))
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
      setDraft(null)
      setTestState("not-tested")
      toast.success(t("whatsapp.saved"))
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error(t("draftMismatch"))
      } else {
        toast.error(t("whatsapp.saveFailed"))
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
        description={t("whatsapp.unavailableDescription")}
        icon={PlugZap}
        title={t("unavailableTitle")}
      />
    )
  }

  return (
    <>
      <Card variant="subtle">
        <CardHeader className="gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <BrandWhatsApp className="size-5 shrink-0" />
                <CardTitle>{integration.label}</CardTitle>
                <ProviderStatus readiness={integration.readiness} />
              </div>
              <CardDescription>{t("whatsapp.description")}</CardDescription>
            </div>
            <Button
              onClick={() => {
                setDraft(draftFrom(integration))
                setTestState("not-tested")
              }}
              variant="brand-secondary"
            >
              <Settings2 data-icon="inline-start" />
              {t("viewAndConfigure")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-7">
          <section
            aria-labelledby="whatsapp-capability-title"
            className="flex flex-col gap-3"
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
                {t("channelType")}
              </h2>
            </div>
            {integration.capabilities.map((capability) => (
              <IntegrationInsetCard key={capability.key}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {t(`capability.${capability.key}.label`)}
                  </p>
                  <Badge variant={capability.enabled ? "success" : "neutral"}>
                    {capability.enabled ? t("enabled") : t("disabled")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`capability.${capability.key}.description`)}
                </p>
              </IntegrationInsetCard>
            ))}
          </section>

          <section
            aria-labelledby="whatsapp-configuration-title"
            className="flex flex-col gap-3"
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
                {t("configurationSummary")}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <IntegrationInsetCard>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("whatsapp.baseUrl")}
                </p>
                <p className="mt-1 text-sm break-all">
                  {integration.baseUrl ?? t("notConfigured")}
                </p>
              </IntegrationInsetCard>
              <IntegrationInsetCard>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("whatsapp.basicAuthUsername")}
                </p>
                <p className="mt-1 text-sm break-all">
                  {integration.basicAuthUsername ?? t("notConfigured")}
                </p>
              </IntegrationInsetCard>
              <IntegrationInsetCard>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("whatsapp.basicAuthPassword")}
                </p>
                <p className="mt-1 text-sm">
                  {integration.basicAuthPasswordConfigured
                    ? t("configuredFeminine")
                    : t("notConfigured")}
                </p>
              </IntegrationInsetCard>
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
                <SheetTitle>Configurar WhatsApp Status</SheetTitle>
                <SheetDescription>
                  Conecta GOWA y controla si el canal está disponible en el
                  Portal.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 p-4">
                <IntegrationAvailabilityCard
                  ariaLabel={t("whatsapp.enableAria")}
                  checked={draft.enabled}
                  description={
                    draft.enabled
                      ? t("whatsapp.availabilityOn")
                      : t("whatsapp.availabilityOff")
                  }
                  onCheckedChange={(enabled) => updateDraft({ enabled })}
                  title={t("availability")}
                />

                <section
                  aria-labelledby="whatsapp-credentials-title"
                  className="flex flex-col gap-4"
                >
                  <h3
                    className="text-sm font-semibold"
                    id="whatsapp-credentials-title"
                  >
                    {t("credentials")}
                  </h3>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>
                        {t("whatsapp.baseUrlField")}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        onChange={(event) =>
                          updateDraft({ baseUrl: event.target.value })
                        }
                        placeholder="https://gowa.example.com"
                        type="url"
                        value={draft.baseUrl}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        {t("whatsapp.basicAuthUsername")}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        autoComplete="username"
                        onChange={(event) =>
                          updateDraft({ basicAuthUsername: event.target.value })
                        }
                        value={draft.basicAuthUsername}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        {t("whatsapp.basicAuthPassword")}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        autoComplete="new-password"
                        onChange={(event) =>
                          updateDraft({ basicAuthPassword: event.target.value })
                        }
                        placeholder={
                          integration.basicAuthPasswordConfigured
                            ? "••••••••••••"
                            : undefined
                        }
                        type="password"
                        value={draft.basicAuthPassword}
                      />
                    </Field>
                  </FieldGroup>
                </section>

                {draft.enabled ? (
                  <section
                    aria-labelledby="whatsapp-test-title"
                    className="flex flex-col gap-3 border-t border-border pt-5"
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
                          ? t("testing")
                          : testState === "passed"
                            ? t("draftValidated")
                            : t("testConfiguration")}
                      </Button>
                    </div>
                    {testState === "failed" ? (
                      <p className="flex items-center gap-2 text-sm text-destructive">
                        <XCircle aria-hidden="true" className="size-4" />
                        {t("draftInvalid")}
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
                  {saving ? t("saving") : t("saveConfiguration")}
                </Button>
              </SheetFooter>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
