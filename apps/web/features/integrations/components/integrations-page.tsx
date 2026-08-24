"use client"

import { ApiError, integrationsApi } from "@workspace/api-client"
import type { ChannelProviderIntegration } from "@workspace/contracts"

import { useChannelLabels } from "@/lib/channel-labels"
import { WhatsAppStatusIntegrationCard } from "./whatsapp-status-integration-card"
import { EmailSmtpIntegrationCard } from "./email-smtp-integration-card"
import { IntegrationAvailabilityCard } from "./integration-availability-card"
import { IntegrationCardLoading } from "./integration-card-loading"
import { IntegrationInsetCard } from "./integration-inset-card"
import { PolarIntegrationPreview } from "./polar-integration-card"
import { GoogleDriveIntegrationCard } from "./google-drive-integration-card"
import { ChannelProviderIntegrationCard } from "./channel-provider-integration-card"
import type { MetaIntegration } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { CardGrid } from "@workspace/ui/components/card-grid"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Copy,
  KeyRound,
  Link,
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

import { BrandMeta } from "@/components/brand-icons"

type CapabilityKey = MetaIntegration["capabilities"][number]["key"]
type MetaScope = MetaIntegration["capabilityScopes"][CapabilityKey][number]
type ScopeOption = { required: boolean; scope: MetaScope }

const capabilityScopeOptions = {
  facebook_page: [
    { required: true, scope: "public_profile" },
    { required: true, scope: "pages_show_list" },
    { required: true, scope: "pages_read_engagement" },
    { required: true, scope: "pages_manage_posts" },
    { required: false, scope: "business_management" },
  ],
  instagram_profile: [
    { required: true, scope: "public_profile" },
    { required: true, scope: "pages_show_list" },
    { required: true, scope: "pages_read_engagement" },
    { required: true, scope: "instagram_basic" },
    { required: true, scope: "instagram_content_publish" },
    { required: false, scope: "business_management" },
  ],
} satisfies Record<CapabilityKey, readonly ScopeOption[]>

type Draft = {
  enabled: boolean
  enabledCapabilityKeys: MetaIntegration["capabilities"][number]["key"][]
  clientId: string
  clientSecret: string
  capabilityScopes: MetaIntegration["capabilityScopes"]
}

type TestState = "not-tested" | "testing" | "passed" | "failed"
type ProviderTab = string

const statusVariants = {
  ready: "success" as const,
  incomplete: "warning" as const,
  untested: "warning" as const,
  disabled: "neutral" as const,
}

function ProviderStatus({
  readiness,
}: {
  readiness: MetaIntegration["readiness"]
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

function draftFrom(integration: MetaIntegration): Draft {
  return {
    enabled: integration.enabled,
    enabledCapabilityKeys: integration.capabilities
      .filter((capability) => capability.enabled)
      .map((capability) => capability.key),
    clientId: integration.clientId ?? "",
    clientSecret: "",
    capabilityScopes: {
      facebook_page: [...integration.capabilityScopes.facebook_page],
      instagram_profile: [...integration.capabilityScopes.instagram_profile],
    },
  }
}

function sameSet(left: string[], right: string[]) {
  return (
    left.length === right.length && left.every((key) => right.includes(key))
  )
}

function isDirty(draft: Draft, integration: MetaIntegration) {
  const configuredCapabilities = integration.capabilities
    .filter((capability) => capability.enabled)
    .map((capability) => capability.key)

  return (
    draft.enabled !== integration.enabled ||
    !sameSet(draft.enabledCapabilityKeys, configuredCapabilities) ||
    draft.clientId !== (integration.clientId ?? "") ||
    draft.clientSecret.length > 0 ||
    !sameSet(
      draft.capabilityScopes.facebook_page,
      integration.capabilityScopes.facebook_page
    ) ||
    !sameSet(
      draft.capabilityScopes.instagram_profile,
      integration.capabilityScopes.instagram_profile
    )
  )
}

export function IntegrationsPage() {
  const t = useTranslations("integrations")
  const [integration, setIntegration] = useState<MetaIntegration | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [testState, setTestState] = useState<TestState>("not-tested")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeProvider, setActiveProvider] = useState<ProviderTab>("meta")
  const [channelProviders, setChannelProviders] = useState<
    ChannelProviderIntegration[]
  >([])
  const labels = useChannelLabels()
  const activeChannelProvider = channelProviders.find(
    (provider) => provider.providerKey === activeProvider
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setForbidden(false)
    try {
      setIntegration(await integrationsApi.getMeta())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error(t("sessionExpired"))
      } else if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        toast.error(t("forbidden"))
      } else {
        toast.error(t("meta.loadFailed"))
      }
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timer = setTimeout(() => {
      void integrationsApi
        .listChannelProviders()
        .then((response) => setChannelProviders(response.providers))
        .catch(() => setChannelProviders([]))
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  const dirty = useMemo(
    () => Boolean(draft && integration && isDirty(draft, integration)),
    [draft, integration]
  )

  function openConfiguration() {
    if (!integration) return
    setDraft(draftFrom(integration))
    setTestState("not-tested")
  }

  function closeConfiguration() {
    setDraft(null)
    setTestState("not-tested")
  }

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...update } : current))
    setTestState("not-tested")
  }

  function toggleCapability(
    key: Draft["enabledCapabilityKeys"][number],
    enabled: boolean
  ) {
    if (!draft) return
    updateDraft({
      enabledCapabilityKeys: enabled
        ? [...draft.enabledCapabilityKeys, key]
        : draft.enabledCapabilityKeys.filter((item) => item !== key),
    })
  }

  function toggleScope(
    capabilityKey: CapabilityKey,
    scope: MetaScope,
    selected: boolean
  ) {
    if (!draft) return
    const option = capabilityScopeOptions[capabilityKey].find(
      (item) => item.scope === scope
    )
    if (option?.required) return

    const scopes = draft.capabilityScopes[capabilityKey]
    updateDraft({
      capabilityScopes: {
        ...draft.capabilityScopes,
        [capabilityKey]: selected
          ? [...scopes, scope]
          : scopes.filter((item) => item !== scope),
      },
    })
  }

  async function copyCallbackUrl(label: string, value: string) {
    if (!navigator.clipboard) {
      toast.error(t("copyUnsupported"))
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      toast.success(t("copied", { label }))
    } catch {
      toast.error(t("copyFailed"))
    }
  }

  async function testConfiguration() {
    if (!draft) return
    if (!draft.clientId.trim()) {
      toast.error(t("meta.clientIdRequired"))
      return
    }
    if (!draft.clientSecret.trim() && !integration?.secretConfigured) {
      toast.error(t("meta.clientSecretRequired"))
      return
    }

    setTestState("testing")
    try {
      await integrationsApi.testMeta({
        configuration: {
          clientId: draft.clientId,
          ...(draft.clientSecret ? { clientSecret: draft.clientSecret } : {}),
          capabilityScopes: draft.capabilityScopes,
        },
      })
      setTestState("passed")
      toast.success(t("meta.testOk"))
    } catch (error) {
      setTestState("failed")
      if (error instanceof ApiError && error.status === 400) {
        toast.error(t("meta.checkCredentials"))
      } else {
        toast.error(t("meta.testFailed"))
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
      const saved = await integrationsApi.saveMeta({
        enabled: draft.enabled,
        enabledCapabilityKeys: draft.enabledCapabilityKeys,
        ...(draft.clientId !== (integration.clientId ?? "") ||
        draft.clientSecret ||
        !sameSet(
          draft.capabilityScopes.facebook_page,
          integration.capabilityScopes.facebook_page
        ) ||
        !sameSet(
          draft.capabilityScopes.instagram_profile,
          integration.capabilityScopes.instagram_profile
        )
          ? {
              configuration: {
                clientId: draft.clientId,
                ...(draft.clientSecret
                  ? { clientSecret: draft.clientSecret }
                  : {}),
                capabilityScopes: draft.capabilityScopes,
              },
            }
          : {}),
      })
      setIntegration(saved)
      setDraft(null)
      setTestState("not-tested")
      toast.success(t("meta.saved"))
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error(t("draftMismatch"))
      } else {
        toast.error(t("meta.saveFailed"))
      }
    } finally {
      setSaving(false)
    }
  }

  if (activeProvider === "meta" && loading) {
    return (
      <div className="flex flex-col gap-6">
        <CollectionHeader description={t("description")} title={t("title")} />
        <Tabs
          onValueChange={(value) => setActiveProvider(value as ProviderTab)}
          value={activeProvider}
        >
          <TabsList
            aria-label={t("providerTabs")}
            className="flex h-auto flex-wrap"
          >
            <TabsTrigger value="meta">Meta</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Status</TabsTrigger>
            <TabsTrigger value="email">{t("tab.email")}</TabsTrigger>
            <TabsTrigger value="polar">Polar.sh</TabsTrigger>
            <TabsTrigger value="google-drive">Google Drive</TabsTrigger>
            {channelProviders.map((provider) => (
              <TabsTrigger
                key={provider.providerKey}
                value={provider.providerKey}
              >
                {labels.provider(provider.providerKey)}
              </TabsTrigger>
            ))}
            {channelProviders.map((provider) => (
              <TabsTrigger
                key={provider.providerKey}
                value={provider.providerKey}
              >
                {labels.provider(provider.providerKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <IntegrationCardLoading />
      </div>
    )
  }

  if (activeProvider === "meta" && (loadError || !integration)) {
    return (
      <div className="flex flex-col gap-6">
        <CollectionHeader description={t("description")} title={t("title")} />
        <Tabs
          onValueChange={(value) => setActiveProvider(value as ProviderTab)}
          value={activeProvider}
        >
          <TabsList
            aria-label={t("providerTabs")}
            className="flex h-auto flex-wrap"
          >
            <TabsTrigger value="meta">Meta</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Status</TabsTrigger>
            <TabsTrigger value="email">{t("tab.email")}</TabsTrigger>
            <TabsTrigger value="polar">Polar.sh</TabsTrigger>
            <TabsTrigger value="google-drive">Google Drive</TabsTrigger>
            {channelProviders.map((provider) => (
              <TabsTrigger
                key={provider.providerKey}
                value={provider.providerKey}
              >
                {labels.provider(provider.providerKey)}
              </TabsTrigger>
            ))}
            {channelProviders.map((provider) => (
              <TabsTrigger
                key={provider.providerKey}
                value={provider.providerKey}
              >
                {labels.provider(provider.providerKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
                forbidden
                  ? t("meta.forbiddenDescription")
                  : t("meta.unavailableDescription")
              }
              icon={forbidden ? LockKeyhole : PlugZap}
              title={
                forbidden
                  ? t("meta.forbiddenTitle")
                  : t("meta.unavailableTitle")
              }
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <CollectionHeader description={t("description")} title={t("title")} />
      <Tabs
        onValueChange={(value) => setActiveProvider(value as ProviderTab)}
        value={activeProvider}
      >
        <TabsList
          aria-label={t("providerTabs")}
          className="flex h-auto flex-wrap"
        >
          <TabsTrigger value="meta">Meta</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Status</TabsTrigger>
          <TabsTrigger value="email">{t("tab.email")}</TabsTrigger>
          <TabsTrigger value="polar">Polar.sh</TabsTrigger>
          <TabsTrigger value="google-drive">Google Drive</TabsTrigger>
          {channelProviders.map((provider) => (
            <TabsTrigger
              key={provider.providerKey}
              value={provider.providerKey}
            >
              {labels.provider(provider.providerKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeProvider === "meta" && integration ? (
        <>
          <Card variant="subtle">
            <CardHeader className="gap-4 border-b border-border pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <BrandMeta className="size-5 shrink-0" />
                    <CardTitle>{integration.label}</CardTitle>
                    <ProviderStatus readiness={integration.readiness} />
                  </div>
                  <CardDescription>{t("meta.description")}</CardDescription>
                </div>
                <Button onClick={openConfiguration} variant="brand-secondary">
                  <Settings2 data-icon="inline-start" />
                  {t("viewAndConfigure")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-7">
              <section
                aria-labelledby="capabilities-title"
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <KeyRound
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <h2 id="capabilities-title" className="text-sm font-semibold">
                    {t("channelTypes")}
                  </h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {integration.capabilities.map((capability) => (
                    <IntegrationInsetCard key={capability.key}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          {t(`capability.${capability.key}.label`)}
                        </p>
                        <Badge
                          variant={capability.enabled ? "success" : "neutral"}
                        >
                          {capability.enabled ? "Activa" : "Desactivada"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {t(`capability.${capability.key}.description`)}
                      </p>
                    </IntegrationInsetCard>
                  ))}
                </div>
              </section>

              <section
                aria-labelledby="configuration-title"
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <LockKeyhole
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <h2
                    id="configuration-title"
                    className="text-sm font-semibold"
                  >
                    {t("configurationSummary")}
                  </h2>
                </div>
                <CardGrid layout="2">
                  <IntegrationInsetCard>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("meta.clientId")}
                    </p>
                    <p className="mt-1 text-sm break-all">
                      {integration.clientId ?? t("notConfigured")}
                    </p>
                  </IntegrationInsetCard>
                  <IntegrationInsetCard>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("meta.clientSecret")}
                    </p>
                    <p className="mt-1 text-sm">
                      {integration.secretConfigured
                        ? t("configured")
                        : t("notConfigured")}
                    </p>
                  </IntegrationInsetCard>
                </CardGrid>
              </section>

              <section
                aria-labelledby="callbacks-title"
                className="flex flex-col gap-3"
              >
                <div className="flex items-start gap-2">
                  <Link
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <div>
                    <h2 id="callbacks-title" className="text-sm font-semibold">
                      {t("callbackUrls")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("callbackUrlsHint")}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 pl-6">
                  {integration.capabilities.map((capability) => (
                    <div className="grid gap-1.5" key={capability.key}>
                      <p className="text-sm font-medium">
                        {t(`capability.${capability.key}.label`)}
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          className="font-mono text-xs"
                          readOnly
                          value={capability.callbackUrl}
                        />
                        <Button
                          aria-label={`Copiar URL de retorno de ${t(`capability.${capability.key}.label`)}`}
                          onClick={() =>
                            void copyCallbackUrl(
                              t(`capability.${capability.key}.label`),
                              capability.callbackUrl
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
                </div>
              </section>
            </CardContent>
          </Card>
        </>
      ) : activeProvider === "whatsapp" ? (
        <WhatsAppStatusIntegrationCard />
      ) : activeProvider === "email" ? (
        <EmailSmtpIntegrationCard />
      ) : activeProvider === "google-drive" ? (
        <GoogleDriveIntegrationCard />
      ) : activeChannelProvider ? (
        <ChannelProviderIntegrationCard
          key={activeChannelProvider.providerKey}
          onSaved={(saved) =>
            setChannelProviders((current) =>
              current.map((provider) =>
                provider.providerKey === saved.providerKey ? saved : provider
              )
            )
          }
          provider={activeChannelProvider}
        />
      ) : (
        <PolarIntegrationPreview />
      )}

      {integration ? (
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
                  <SheetTitle>{t("meta.sheetTitle")}</SheetTitle>
                  <SheetDescription>
                    {t("meta.sheetDescription")}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-6 p-4">
                  <IntegrationAvailabilityCard
                    ariaLabel={t("meta.enableAria")}
                    checked={draft.enabled}
                    description={
                      draft.enabled ? t("availabilityOn") : t("availabilityOff")
                    }
                    onCheckedChange={(enabled) => updateDraft({ enabled })}
                    title={t("availability")}
                  />

                  <section
                    aria-labelledby="meta-capabilities-title"
                    className="flex flex-col gap-4"
                  >
                    <h3
                      className="text-sm font-semibold"
                      id="meta-capabilities-title"
                    >
                      {t("channelTypes")}
                    </h3>
                    <div className="grid gap-3">
                      {integration.capabilities.map((capability) => {
                        const enabled = draft.enabledCapabilityKeys.includes(
                          capability.key
                        )
                        return (
                          <IntegrationInsetCard
                            className="flex flex-col gap-4 px-3 py-3"
                            key={capability.key}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {t(`capability.${capability.key}.label`)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t(
                                    `capability.${capability.key}.description`
                                  )}
                                </p>
                              </div>
                              <Switch
                                aria-label={`Habilitar ${t(`capability.${capability.key}.label`)}`}
                                checked={enabled}
                                onCheckedChange={(next) =>
                                  toggleCapability(capability.key, next)
                                }
                              />
                            </div>
                            <FieldSet>
                              <FieldLegend variant="label">
                                {t("meta.permissions")}
                              </FieldLegend>
                              <FieldGroup data-slot="checkbox-group">
                                {capabilityScopeOptions[capability.key].map(
                                  (option) => {
                                    const checked =
                                      option.required ||
                                      draft.capabilityScopes[
                                        capability.key
                                      ].includes(option.scope)
                                    const controlId = `${capability.key}-${option.scope}`

                                    return (
                                      <Field
                                        data-disabled={option.required}
                                        key={option.scope}
                                        orientation="horizontal"
                                      >
                                        <Checkbox
                                          checked={checked}
                                          disabled={option.required}
                                          id={controlId}
                                          onCheckedChange={(next) =>
                                            toggleScope(
                                              capability.key,
                                              option.scope,
                                              next === true
                                            )
                                          }
                                        />
                                        <FieldLabel
                                          className="min-w-0"
                                          htmlFor={controlId}
                                        >
                                          <FieldContent className="min-w-0">
                                            <FieldTitle>
                                              {t(`scope.${option.scope}`)}
                                              {option.required ? (
                                                <span
                                                  aria-hidden="true"
                                                  className="text-destructive"
                                                >
                                                  *
                                                </span>
                                              ) : null}
                                            </FieldTitle>
                                          </FieldContent>
                                        </FieldLabel>
                                      </Field>
                                    )
                                  }
                                )}
                              </FieldGroup>
                            </FieldSet>
                          </IntegrationInsetCard>
                        )
                      })}
                    </div>
                  </section>

                  <section
                    aria-labelledby="meta-credentials-title"
                    className="flex flex-col gap-4 border-t border-border pt-5"
                  >
                    <h3
                      className="text-sm font-semibold"
                      id="meta-credentials-title"
                    >
                      {t("credentials")}
                    </h3>
                    <FieldGroup>
                      <Field>
                        <FieldLabel>
                          {t("meta.clientId")}
                          <span aria-hidden="true" className="text-destructive">
                            *
                          </span>
                        </FieldLabel>
                        <Input
                          aria-required="true"
                          onChange={(event) =>
                            updateDraft({ clientId: event.target.value })
                          }
                          value={draft.clientId}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>
                          {t("meta.clientSecret")}
                          <span aria-hidden="true" className="text-destructive">
                            *
                          </span>
                        </FieldLabel>
                        <Input
                          aria-required="true"
                          onChange={(event) =>
                            updateDraft({ clientSecret: event.target.value })
                          }
                          placeholder={
                            integration.secretConfigured
                              ? "••••••••••••"
                              : undefined
                          }
                          type="password"
                          value={draft.clientSecret}
                        />
                      </Field>
                    </FieldGroup>
                  </section>

                  {draft.enabled ? (
                    <section
                      aria-labelledby="test-title"
                      className="flex flex-col gap-3 border-t border-border pt-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 id="test-title" className="text-sm font-semibold">
                            {t("testDraft")}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("testDraftDescription")}
                          </p>
                        </div>
                        <Button
                          disabled={
                            saving ||
                            !draft.clientId.trim() ||
                            (!integration.secretConfigured &&
                              !draft.clientSecret.trim()) ||
                            testState === "testing" ||
                            testState === "passed"
                          }
                          onClick={() => void testConfiguration()}
                          type="button"
                          variant={
                            testState === "passed" ? "success" : "surface"
                          }
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
                    {t("cancel")}
                  </Button>
                  <Button
                    disabled={
                      !dirty ||
                      saving ||
                      !draft.clientId.trim() ||
                      (!integration.secretConfigured &&
                        !draft.clientSecret.trim()) ||
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
      ) : null}
    </div>
  )
}
