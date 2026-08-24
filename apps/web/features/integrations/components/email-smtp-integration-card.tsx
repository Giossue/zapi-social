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
  LockKeyhole,
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
import { useTranslations } from "next-intl"
import { IntegrationCardLoading } from "./integration-card-loading"
import { IntegrationAvailabilityCard } from "./integration-availability-card"
import { IntegrationInsetCard } from "./integration-inset-card"
import { IntegrationSection } from "./integration-section"

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

const statusVariants = {
  ready: "success" as const,
  incomplete: "warning" as const,
  untested: "warning" as const,
  disabled: "neutral" as const,
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
  const t = useTranslations("integrations")
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
        toast.error(t("forbidden"))
      } else {
        toast.error(t("smtp.loadFailed"))
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    // El temporizador saca el primer `setState` del cuerpo del efecto y cancela
    // la carga anterior cuando el efecto se repite.
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
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
      toast.error(t("smtp.fieldsRequired"))
      return null
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error(t("smtp.portRange"))
      return null
    }
    if (!draft.password && !integration?.passwordConfigured) {
      toast.error(t("smtp.passwordRequired"))
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
      toast.success(t("smtp.testOk"))
    } catch {
      setTestState("failed")
      toast.error(t("smtp.testFailed"))
    }
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !integration) return
    const values = configuration()
    if (!values) return
    if (draft.enabled && testState !== "passed") {
      toast.error(t("testBeforeEnable"))
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
      toast.success(t("smtp.saved"))
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error(t("draftMismatch"))
      } else {
        toast.error(t("smtp.saveFailed"))
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
        description={t("smtp.unavailableDescription")}
        icon={Mail}
        title={t("unavailableTitle")}
      />
    )
  }

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
                <Badge variant={statusVariants[integration.readiness]}>
                  <StatusIcon aria-hidden="true" />
                  {t(`readiness.${integration.readiness}`)}
                </Badge>
              </div>
              <CardDescription>{t("smtp.description")}</CardDescription>
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
        <CardContent>
          <IntegrationSection
            icon={LockKeyhole}
            title={t("configurationSummary")}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <IntegrationInsetCard>
                <div className="flex items-center gap-2">
                  <Server
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("smtp.server")}
                  </p>
                </div>
                <p className="mt-1 text-sm break-all">
                  {integration.host ?? t("notConfigured")}
                </p>
              </IntegrationInsetCard>
              <IntegrationInsetCard>
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("smtp.portAndSecurity")}
                  </p>
                </div>
                <p className="mt-1 text-sm">
                  {integration.port
                    ? `${integration.port} · ${integration.secure ? t("smtp.directTls") : t("smtp.startTls")}`
                    : t("notConfigured")}
                </p>
              </IntegrationInsetCard>
              <IntegrationInsetCard>
                <div className="flex items-center gap-2">
                  <Send
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("smtp.sender")}
                  </p>
                </div>
                <p className="mt-1 text-sm break-all">
                  {integration.fromEmail ?? t("notConfigured")}
                </p>
              </IntegrationInsetCard>
            </div>
          </IntegrationSection>
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
                <SheetTitle>{t("smtp.sheetTitle")}</SheetTitle>
                <SheetDescription>
                  {t("smtp.sheetDescription")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 p-4">
                <IntegrationAvailabilityCard
                  ariaLabel={t("smtp.enableAria")}
                  checked={draft.enabled}
                  description={t("smtp.availabilityHint")}
                  onCheckedChange={(enabled) => updateDraft({ enabled })}
                  title={t("availability")}
                />

                <section
                  aria-labelledby="smtp-credentials-title"
                  className="flex flex-col gap-4"
                >
                  <h3
                    className="text-sm font-semibold"
                    id="smtp-credentials-title"
                  >
                    {t("smtp.serverAndSender")}
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
                        {t("smtp.port")}
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
                        {t("smtp.username")}
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
                        {t("smtp.password")}
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
                        {t("smtp.fromName")}
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
                        {t("smtp.fromEmail")}
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
                      <p className="text-sm font-medium">
                        {t("smtp.useDirectTls")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("smtp.useDirectTlsHint")}
                      </p>
                    </div>
                    <Switch
                      aria-label={t("smtp.useDirectTls")}
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
                    {t("smtp.additionalOptions")}
                  </h3>
                  <IntegrationInsetCard>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                      <Field data-disabled>
                        <FieldLabel>Reply-to</FieldLabel>
                        <Input disabled placeholder={t("smtp.unsupported")} />
                      </Field>
                      <Field data-disabled>
                        <FieldLabel>Timeout</FieldLabel>
                        <Input disabled placeholder={t("smtp.unsupported")} />
                      </Field>
                    </FieldGroup>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {t("smtp.unsupportedHint")}
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
                          {t("smtp.testDraft")}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("smtp.testDraftHint")}
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
                          ? t("smtp.testingShort")
                          : testState === "passed"
                            ? t("draftValidated")
                            : t("testConfiguration")}
                      </Button>
                    </div>
                    {testState === "failed" ? (
                      <p className="flex items-center gap-2 text-sm text-destructive">
                        <XCircle aria-hidden="true" />
                        {t("draftInvalid")}
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
                  {t("cancel")}
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
