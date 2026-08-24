"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CirclePower,
  Images,
  KeyRound,
  LockKeyhole,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react"

import { ApiError, integrationsApi } from "@workspace/api-client"
import type { PexelsIntegration } from "@workspace/contracts"
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
  Sheet,
  SheetActions,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { IntegrationAvailabilityCard } from "./integration-availability-card"
import { IntegrationCardLoading } from "./integration-card-loading"
import { IntegrationInsetCard } from "./integration-inset-card"
import { IntegrationSection } from "./integration-section"

type Draft = { enabled: boolean; apiKey: string }
type TestState = "not-tested" | "testing" | "passed" | "failed"

const statusVariants = {
  ready: "success" as const,
  incomplete: "warning" as const,
  untested: "warning" as const,
  disabled: "neutral" as const,
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function draftFrom(integration: PexelsIntegration): Draft {
  return { enabled: integration.enabled, apiKey: "" }
}

function complete(draft: Draft, integration: PexelsIntegration) {
  return Boolean(draft.apiKey.trim() || integration.apiKeyConfigured)
}

export function PexelsIntegrationCard() {
  const t = useTranslations("integrations")
  const [integration, setIntegration] = useState<PexelsIntegration | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [testState, setTestState] = useState<TestState>("not-tested")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setForbidden(false)
    try {
      setIntegration(await integrationsApi.getPexels())
    } catch (error) {
      setForbidden(error instanceof ApiError && error.status === 403)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  function updateDraft(next: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...next } : current))
    setTestState("not-tested")
  }

  async function testConfiguration() {
    if (!draft || !integration || !complete(draft, integration)) return
    setTestState("testing")
    try {
      await integrationsApi.testPexels({
        ...(draft.apiKey.trim()
          ? { configuration: { apiKey: draft.apiKey.trim() } }
          : {}),
      })
      setTestState("passed")
      toast.success(t("pexels.testOk"))
    } catch {
      setTestState("failed")
      toast.error(t("pexels.testFailed"))
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !integration) return
    if (draft.enabled && testState !== "passed") {
      toast.error(t("testBeforeEnable"))
      return
    }
    if (draft.enabled && !complete(draft, integration)) {
      toast.error(t("pexels.apiKeyRequired"))
      return
    }

    setSaving(true)
    try {
      const saved = await integrationsApi.savePexels({
        enabled: draft.enabled,
        ...(draft.apiKey.trim()
          ? { configuration: { apiKey: draft.apiKey.trim() } }
          : {}),
      })
      setIntegration(saved)
      setDraft(null)
      setTestState("not-tested")
      toast.success(t("pexels.saved"))
    } catch {
      toast.error(t("pexels.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <IntegrationCardLoading />
  if (loadError || !integration) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              forbidden ? undefined : (
                <RetryButton
                  onClick={() => void load()}
                  variant="brand-secondary"
                />
              )
            }
            description={
              forbidden ? t("cardForbidden") : t("pexels.loadFailed")
            }
            icon={forbidden ? LockKeyhole : Images}
            title={t("pexels.unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  const dirty = Boolean(
    draft &&
    (draft.enabled !== integration.enabled || draft.apiKey.trim().length)
  )
  const StatusIcon =
    integration.readiness === "ready"
      ? CheckCircle2
      : integration.readiness === "disabled"
        ? Circle
        : CircleAlert
  let saveLabel = t("saveConfiguration")
  if (saving) saveLabel = t("saving")
  else if (draft?.enabled && !integration.enabled)
    saveLabel = t("saveAndEnable")

  return (
    <>
      <Card variant="subtle">
        <CardHeader className="gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Images
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground"
                />
                <CardTitle>{integration.label}</CardTitle>
                <Badge variant={statusVariants[integration.readiness]}>
                  <StatusIcon aria-hidden="true" />
                  {t(`readiness.${integration.readiness}`)}
                </Badge>
              </div>
              <CardDescription>{t("pexels.description")}</CardDescription>
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
          <IntegrationSection icon={KeyRound} title={t("configurationSummary")}>
            <div className="grid gap-3 md:grid-cols-3">
              <IntegrationInsetCard>
                <div className="flex items-center gap-2">
                  <CirclePower
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("statusLabel")}
                  </p>
                </div>
                <p className="mt-1 text-sm">
                  {integration.enabled
                    ? t("availableInPortal")
                    : t("readiness.disabled")}
                </p>
              </IntegrationInsetCard>
              <IntegrationInsetCard>
                <div className="flex items-center gap-2">
                  <Images
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("pexels.content")}
                  </p>
                </div>
                <p className="mt-1 text-sm">{t("pexels.imagesAndVideos")}</p>
              </IntegrationInsetCard>
              <IntegrationInsetCard>
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("pexels.apiKey")}
                  </p>
                </div>
                <p className="mt-1 text-sm">
                  {integration.apiKeyConfigured
                    ? t("configuredFeminine")
                    : t("notConfigured")}
                </p>
              </IntegrationInsetCard>
            </div>
          </IntegrationSection>
        </CardContent>
      </Card>

      <Sheet
        onOpenChange={(open) => {
          if (!open && !saving && testState !== "testing") setDraft(null)
        }}
        open={draft !== null}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
          {draft ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={save}
            >
              <SheetHeader className="border-b">
                <SheetTitle>{t("pexels.sheetTitle")}</SheetTitle>
                <SheetDescription>
                  {t("pexels.sheetDescription")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4">
                <IntegrationAvailabilityCard
                  ariaLabel={t("pexels.enableAria")}
                  checked={draft.enabled}
                  description={t("pexels.availabilityHint")}
                  onCheckedChange={(enabled) => updateDraft({ enabled })}
                  title={t("availability")}
                />
                <section className="flex flex-col gap-4 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold">{t("credentials")}</h3>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="pexels-api-key">
                        {t("pexels.apiKey")} <RequiredMark />
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        id="pexels-api-key"
                        onChange={(event) =>
                          updateDraft({ apiKey: event.target.value })
                        }
                        placeholder={
                          integration.apiKeyConfigured
                            ? t("pexels.apiKeyConfigured")
                            : undefined
                        }
                        type="password"
                        value={draft.apiKey}
                      />
                      <FieldDescription>
                        {integration.apiKeyConfigured
                          ? t("pexels.apiKeyConfiguredHint")
                          : t("pexels.apiKeyHint")}
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </section>
                {draft.enabled ? (
                  <section className="flex flex-col gap-3 border-t border-border pt-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {t("pexels.testDraft")}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("pexels.testDraftHint")}
                        </p>
                      </div>
                      <Button
                        disabled={
                          saving ||
                          !complete(draft, integration) ||
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
                  </section>
                ) : null}
              </div>
              <SheetActions>
                <Button
                  disabled={saving || testState === "testing"}
                  onClick={() => setDraft(null)}
                  type="button"
                  variant="brand-secondary"
                >
                  {t("cancel")}
                </Button>
                <Button
                  disabled={
                    !dirty ||
                    saving ||
                    (draft.enabled &&
                      (!complete(draft, integration) || testState !== "passed"))
                  }
                  type="submit"
                >
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Save data-icon="inline-start" />
                  )}
                  {saveLabel}
                </Button>
              </SheetActions>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
