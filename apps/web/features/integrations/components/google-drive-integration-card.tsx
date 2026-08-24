"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"

import { BrandGoogleDrive } from "@/components/brand-icons"
import { ApiError, integrationsApi } from "@workspace/api-client"
import type {
  GoogleDriveIntegration,
  GoogleDriveIntegrationConfiguration,
} from "@workspace/contracts"
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
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CirclePower,
  HardDriveDownload,
  LockKeyhole,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react"
import { openGoogleDrivePicker } from "@/features/files/components/google-drive-picker"
import { IntegrationAvailabilityCard } from "./integration-availability-card"
import { IntegrationCardLoading } from "./integration-card-loading"
import { IntegrationInsetCard } from "./integration-inset-card"
import { IntegrationSection } from "./integration-section"

type Draft = GoogleDriveIntegrationConfiguration & { enabled: boolean }
type TestState = "not-tested" | "testing" | "passed" | "failed"

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

const statusVariants = {
  ready: "success" as const,
  incomplete: "warning" as const,
  untested: "warning" as const,
  disabled: "neutral" as const,
}

function draftFrom(integration: GoogleDriveIntegration): Draft {
  return {
    enabled: integration.enabled,
    oauthClientId: integration.oauthClientId ?? "",
    browserApiKey: integration.browserApiKey ?? "",
    appId: integration.appId ?? "",
  }
}

function configuration(draft: Draft): GoogleDriveIntegrationConfiguration {
  return {
    oauthClientId: draft.oauthClientId.trim(),
    browserApiKey: draft.browserApiKey.trim(),
    appId: draft.appId.trim(),
  }
}

function complete(draft: Draft) {
  return Boolean(
    draft.oauthClientId.trim() &&
    draft.browserApiKey.trim() &&
    /^\d{6,32}$/.test(draft.appId.trim())
  )
}

export function GoogleDriveIntegrationCard() {
  const t = useTranslations("integrations")
  const [integration, setIntegration] = useState<GoogleDriveIntegration | null>(
    null
  )
  const [draft, setDraft] = useState<Draft | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
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
      setIntegration(await integrationsApi.getGoogleDrive())
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
    if (!draft || !complete(draft)) return
    setTestState("testing")
    setSheetOpen(false)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 220))
    try {
      const picked = await openGoogleDrivePicker({
        configuration: configuration(draft),
        multiselect: false,
      })
      if (!picked) {
        setTestState("not-tested")
        return
      }
      await integrationsApi.testGoogleDrive({
        configuration: configuration(draft),
        accessToken: picked.accessToken,
        selection: picked.files[0]!,
      })
      setTestState("passed")
      toast.success(t("googleDrive.testOk"))
    } catch {
      setTestState("failed")
      toast.error(t("googleDrive.testFailed"))
    } finally {
      setSheetOpen(true)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !complete(draft) || (draft.enabled && testState !== "passed"))
      return
    setSaving(true)
    try {
      const saved = await integrationsApi.saveGoogleDrive({
        enabled: draft.enabled,
        configuration: configuration(draft),
      })
      setIntegration(saved)
      setSheetOpen(false)
      setDraft(null)
      setTestState("not-tested")
      toast.success(t("googleDrive.saved"))
    } catch {
      toast.error(t("googleDrive.saveFailed"))
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
              forbidden ? t("cardForbidden") : t("googleDrive.loadFailed")
            }
            icon={forbidden ? LockKeyhole : HardDriveDownload}
            title={t("googleDrive.unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  const dirty = draft
    ? JSON.stringify(draft) !== JSON.stringify(draftFrom(integration))
    : false
  let saveLabel = t("saveConfiguration")
  if (saving) saveLabel = t("saving")
  else if (draft?.enabled && !integration.enabled)
    saveLabel = t("saveAndEnable")
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
                <BrandGoogleDrive className="size-5 shrink-0" />
                <CardTitle>{integration.label}</CardTitle>
                <Badge variant={statusVariants[integration.readiness]}>
                  <StatusIcon aria-hidden="true" />
                  {t(`readiness.${integration.readiness}`)}
                </Badge>
              </div>
              <CardDescription>{t("googleDrive.description")}</CardDescription>
            </div>
            <Button
              onClick={() => {
                setDraft(draftFrom(integration))
                setTestState("not-tested")
                setSheetOpen(true)
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
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("googleDrive.oauthScope")}
                  </p>
                </div>
                <p className="mt-1 text-sm">drive.file</p>
              </IntegrationInsetCard>
              <IntegrationInsetCard>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("googleDrive.picker")}
                  </p>
                </div>
                <p className="mt-1 text-sm">
                  {integration.lastTestedAt
                    ? t("tested")
                    : t("readiness.untested")}
                </p>
              </IntegrationInsetCard>
            </div>
          </IntegrationSection>
        </CardContent>
      </Card>

      <Sheet
        onOpenChange={(open) => {
          if (!open && !saving && testState !== "testing") {
            setSheetOpen(false)
            setDraft(null)
          }
        }}
        open={sheetOpen && draft !== null}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
          {draft ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={save}
            >
              <SheetHeader className="border-b">
                <SheetTitle>{t("googleDrive.sheetTitle")}</SheetTitle>
                <SheetDescription>
                  {t("googleDrive.sheetDescription")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4">
                <IntegrationAvailabilityCard
                  ariaLabel={t("googleDrive.enableAria")}
                  checked={draft.enabled}
                  description={t("googleDrive.availabilityHint")}
                  onCheckedChange={(enabled) =>
                    setDraft((current) =>
                      current ? { ...current, enabled } : current
                    )
                  }
                  title={t("availability")}
                />
                <section className="flex flex-col gap-4 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold">
                    {t("googleDrive.cloudConfiguration")}
                  </h3>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>
                        OAuth Client ID <RequiredMark />
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        onChange={(event) =>
                          updateDraft({ oauthClientId: event.target.value })
                        }
                        value={draft.oauthClientId}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        Browser API Key <RequiredMark />
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        onChange={(event) =>
                          updateDraft({ browserApiKey: event.target.value })
                        }
                        value={draft.browserApiKey}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        App ID <RequiredMark />
                      </FieldLabel>
                      <Input
                        aria-required="true"
                        inputMode="numeric"
                        onChange={(event) =>
                          updateDraft({ appId: event.target.value })
                        }
                        value={draft.appId}
                      />
                    </Field>
                  </FieldGroup>
                </section>
                {draft.enabled ? (
                  <section className="flex flex-col gap-3 border-t border-border pt-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {t("googleDrive.testPicker")}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("googleDrive.testPickerHint")}
                        </p>
                      </div>
                      <Button
                        disabled={
                          saving ||
                          !complete(draft) ||
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
                          ? t("googleDrive.opening")
                          : testState === "passed"
                            ? t("googleDrive.pickerValidated")
                            : t("googleDrive.testPicker")}
                      </Button>
                    </div>
                  </section>
                ) : null}
              </div>
              <SheetActions>
                <Button
                  disabled={saving || testState === "testing"}
                  onClick={() => {
                    setSheetOpen(false)
                    setDraft(null)
                  }}
                  type="button"
                  variant="brand-secondary"
                >
                  {t("cancel")}
                </Button>
                <Button
                  disabled={
                    (!dirty && testState !== "passed") ||
                    saving ||
                    !complete(draft) ||
                    (draft.enabled && testState !== "passed")
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
