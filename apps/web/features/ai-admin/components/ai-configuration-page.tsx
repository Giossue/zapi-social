"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"

import { adminAiApi, ApiError } from "@workspace/api-client"
import type {
  AdminAiConfiguration,
  AdminAiModel,
  AdminAiProviderKey,
  AdminAiUsage,
} from "@workspace/contracts"
import { useApiErrorMessage } from "@/lib/api-error-message"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@/components/page-loading"
import { Switch } from "@workspace/ui/components/switch"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@/components/table-pagination"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import {
  Activity,
  Circle,
  CircleAlert,
  CircleX,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

const TABLE_PAGE_SIZE = 10

const readinessCopy = {
  ready: { icon: CheckCircle2, variant: "success" as const },
  disabled: { icon: Circle, variant: "neutral" as const },
  incomplete: { icon: CircleAlert, variant: "warning" as const },
  untested: { icon: CircleAlert, variant: "warning" as const },
  error: { icon: CircleX, variant: "destructive" as const },
}

type ProviderDraft = {
  apiKey: string
  enabled: boolean
  tested: boolean
}

const emptyProviderDrafts: Record<AdminAiProviderKey, ProviderDraft> = {
  openai: { apiKey: "", enabled: false, tested: false },
  atlascloud: { apiKey: "", enabled: false, tested: false },
  deepseek: { apiKey: "", enabled: false, tested: false },
  qwen: { apiKey: "", enabled: false, tested: false },
  anthropic: { apiKey: "", enabled: false, tested: false },
}

type Formatter = ReturnType<typeof useFormatter>

function money(format: Formatter, microusd: number) {
  return format.number(microusd / 1_000_000, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  })
}

export function AiConfigurationPage() {
  const t = useTranslations("aiConfiguration")
  const format = useFormatter()
  const locale = useLocale()
  const apiErrorMessage = useApiErrorMessage()
  const [configuration, setConfiguration] =
    useState<AdminAiConfiguration | null>(null)
  const [usage, setUsage] = useState<AdminAiUsage | null>(null)
  const [providerDrafts, setProviderDrafts] = useState(emptyProviderDrafts)
  const [pending, setPending] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [usageError, setUsageError] = useState(false)
  const [modelQuery, setModelQuery] = useState("")
  const [modelProviderFilter, setModelProviderFilter] = useState("all")
  const [modelCapabilityFilter, setModelCapabilityFilter] = useState("all")
  const [modelEnabledFilter, setModelEnabledFilter] = useState("all")
  const [modelPage, setModelPage] = useState(1)

  const hasModelFilters = Boolean(
    modelQuery.trim() ||
    modelProviderFilter !== "all" ||
    modelCapabilityFilter !== "all" ||
    modelEnabledFilter !== "all"
  )
  const filteredModels = useMemo(() => {
    const normalized = modelQuery.trim().toLocaleLowerCase(locale)
    return (configuration?.models ?? []).filter((model) => {
      if (
        modelProviderFilter !== "all" &&
        model.providerKey !== modelProviderFilter
      )
        return false
      if (
        modelCapabilityFilter !== "all" &&
        model.capability !== modelCapabilityFilter
      )
        return false
      if (
        modelEnabledFilter !== "all" &&
        model.enabled !== (modelEnabledFilter === "enabled")
      )
        return false
      if (!normalized) return true
      return [
        model.label,
        model.modelId,
        model.providerKey,
        model.capability,
      ].some((value) => value.toLocaleLowerCase(locale).includes(normalized))
    })
  }, [
    configuration?.models,
    modelCapabilityFilter,
    modelEnabledFilter,
    modelProviderFilter,
    modelQuery,
    locale,
  ])
  const modelPageCount = Math.max(
    1,
    Math.ceil(filteredModels.length / TABLE_PAGE_SIZE)
  )
  const safeModelPage = Math.min(modelPage, modelPageCount)
  const visibleModels = filteredModels.slice(
    (safeModelPage - 1) * TABLE_PAGE_SIZE,
    safeModelPage * TABLE_PAGE_SIZE
  )
  const modelRangeStart = filteredModels.length
    ? (safeModelPage - 1) * TABLE_PAGE_SIZE + 1
    : 0
  const modelRangeEnd = filteredModels.length
    ? modelRangeStart + visibleModels.length - 1
    : 0

  const load = useCallback(async () => {
    setLoadError(false)
    setForbidden(false)
    setUsageError(false)
    try {
      const nextConfiguration = await adminAiApi.configuration()
      setConfiguration(nextConfiguration)
      setProviderDrafts((current) => {
        const next = { ...current }
        for (const key of Object.keys(next) as AdminAiProviderKey[]) {
          next[key] = {
            ...next[key],
            enabled:
              nextConfiguration.providers.find(
                (provider) => provider.providerKey === key
              )?.enabled ?? false,
          }
        }
        return next
      })
    } catch (error) {
      setForbidden(error instanceof ApiError && error.status === 403)
      setLoadError(true)
      setConfiguration(null)
      setUsage(null)
      return
    }

    try {
      setUsage(await adminAiApi.usage(30))
    } catch {
      setUsage(null)
      setUsageError(true)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  async function testProvider(providerKey: AdminAiProviderKey) {
    if (!configuration) return
    const provider = configuration.providers.find(
      (candidate) => candidate.providerKey === providerKey
    )
    const draft = providerDrafts[providerKey]
    if (!provider?.apiKeyConfigured && draft.apiKey.trim().length < 20) {
      toast.error(
        t("invalidApiKey", {
          provider: provider?.label ?? t("providerFallback"),
        })
      )
      return
    }
    setPending(`provider-test-${providerKey}`)
    try {
      await adminAiApi.testProvider(
        providerKey,
        draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}
      )
      setProviderDrafts((current) => ({
        ...current,
        [providerKey]: { ...current[providerKey], tested: true },
      }))
      toast.success(t("testOk", { provider: provider?.label ?? "" }))
      await load()
    } catch (error) {
      setProviderDrafts((current) => ({
        ...current,
        [providerKey]: { ...current[providerKey], tested: false },
      }))
      toast.error(
        apiErrorMessage(error instanceof ApiError ? error.code : undefined)
      )
    } finally {
      setPending(null)
    }
  }

  async function saveProvider(providerKey: AdminAiProviderKey) {
    if (!configuration) return
    const provider = configuration.providers.find(
      (candidate) => candidate.providerKey === providerKey
    )
    const draft = providerDrafts[providerKey]
    if (!provider?.apiKeyConfigured && draft.apiKey.trim().length < 20) {
      toast.error(t("keyRequired"))
      return
    }
    if (draft.enabled && !draft.tested && provider?.readiness !== "ready") {
      toast.error(t("testBeforeEnable", { provider: provider?.label ?? "" }))
      return
    }
    setPending(`provider-save-${providerKey}`)
    try {
      const next = await adminAiApi.updateProvider(providerKey, {
        enabled: draft.enabled,
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
      })
      setConfiguration(next)
      setProviderDrafts((current) => ({
        ...current,
        [providerKey]: {
          ...current[providerKey],
          apiKey: "",
          tested: false,
        },
      }))
      toast.success(t("providerSaved", { provider: provider?.label ?? "" }))
    } catch (error) {
      toast.error(
        apiErrorMessage(error instanceof ApiError ? error.code : undefined)
      )
    } finally {
      setPending(null)
    }
  }

  async function toggleModel(model: AdminAiModel, enabled: boolean) {
    setPending(`model-${model.id}`)
    try {
      const updated = await adminAiApi.updateModel(model.id, { enabled })
      setConfiguration((current) =>
        current
          ? {
              ...current,
              models: current.models.map((item) =>
                item.id === updated.id ? updated : item
              ),
            }
          : current
      )
      toast.success(
        enabled
          ? t("modelEnabled", { model: model.label })
          : t("modelDisabled", { model: model.label })
      )
    } catch (error) {
      toast.error(
        apiErrorMessage(error instanceof ApiError ? error.code : undefined)
      )
    } finally {
      setPending(null)
    }
  }

  function clearModelFilters() {
    setModelQuery("")
    setModelProviderFilter("all")
    setModelCapabilityFilter("all")
    setModelEnabledFilter("all")
    setModelPage(1)
  }

  if (!configuration) {
    if (!loadError) return <PageLoading aria-label={t("loading")} />
    return (
      <Card variant="subtle">
        <EmptyState
          icon={forbidden ? ShieldCheck : Activity}
          title={forbidden ? t("forbiddenTitle") : t("unavailable")}
          description={forbidden ? t("forbiddenDescription") : t("loadFailed")}
          action={
            !forbidden ? (
              <Button onClick={() => void load()} variant="brand-secondary">
                <RefreshCw data-icon="inline-start" /> {t("retry")}
              </Button>
            ) : undefined
          }
        />
      </Card>
    )
  }

  const readyProviders = configuration.providers.filter(
    (provider) => provider.readiness === "ready"
  ).length
  const status =
    readyProviders === configuration.providers.length
      ? readinessCopy.ready
      : readyProviders > 0
        ? readinessCopy.untested
        : readinessCopy.disabled

  return (
    <section className="flex flex-col gap-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant={status.variant}>
          <status.icon aria-hidden="true" />{" "}
          {t("readyProviders", {
            ready: readyProviders,
            total: configuration.providers.length,
          })}
        </Badge>
      </div>

      <Tabs defaultValue="provider">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="provider">{t("tab.provider")}</TabsTrigger>
          <TabsTrigger value="models">{t("tab.models")}</TabsTrigger>
          <TabsTrigger value="usage">{t("tab.usage")}</TabsTrigger>
        </TabsList>

        <TabsContent value="provider" className="flex flex-col gap-4 pt-3">
          {configuration.providers.map((provider) => {
            const draft = providerDrafts[provider.providerKey]
            const providerStatus = readinessCopy[provider.readiness]
            const testing = pending === `provider-test-${provider.providerKey}`
            const saving = pending === `provider-save-${provider.providerKey}`
            const complete = Boolean(
              provider.apiKeyConfigured || draft.apiKey.trim().length >= 20
            )
            const dirty = Boolean(
              draft.apiKey.trim() || draft.enabled !== provider.enabled
            )
            const canEnable =
              !draft.enabled || draft.tested || provider.readiness === "ready"
            return (
              <Card key={provider.providerKey} variant="subtle">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound /> {provider.label}
                    <Badge variant={providerStatus.variant}>
                      <providerStatus.icon aria-hidden="true" />
                      {t(`readiness.${provider.readiness}`)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {t("providerDescription", {
                      capabilities: format.list(
                        provider.capabilities.map((capability) =>
                          t(`capabilityLower.${capability}`)
                        ),
                        { type: "conjunction" }
                      ),
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <Field>
                    <FieldLabel htmlFor={`${provider.providerKey}-key`}>
                      {t("apiKey")}
                      {!provider.apiKeyConfigured ? (
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      ) : null}
                    </FieldLabel>
                    <Input
                      aria-required={
                        provider.apiKeyConfigured ? undefined : "true"
                      }
                      autoComplete="new-password"
                      id={`${provider.providerKey}-key`}
                      onChange={(event) =>
                        setProviderDrafts((current) => ({
                          ...current,
                          [provider.providerKey]: {
                            ...current[provider.providerKey],
                            apiKey: event.target.value,
                            tested: false,
                          },
                        }))
                      }
                      placeholder={
                        provider.apiKeyConfigured
                          ? t("apiKeyPlaceholder")
                          : provider.providerKey === "atlascloud"
                            ? "apikey-..."
                            : "sk-..."
                      }
                      type="password"
                      value={draft.apiKey}
                    />
                  </Field>
                  <Card variant="inset">
                    <CardContent className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {t("enableProvider", { provider: provider.label })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("enableProviderHint")}
                        </p>
                      </div>
                      <Switch
                        aria-label={t("enableProvider", {
                          provider: provider.label,
                        })}
                        checked={draft.enabled}
                        onCheckedChange={(enabled) =>
                          setProviderDrafts((current) => ({
                            ...current,
                            [provider.providerKey]: {
                              ...current[provider.providerKey],
                              enabled,
                            },
                          }))
                        }
                      />
                    </CardContent>
                  </Card>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      disabled={pending !== null || !complete}
                      onClick={() => void testProvider(provider.providerKey)}
                      variant="brand-secondary"
                    >
                      {testing ? (
                        <Spinner data-icon="inline-start" size={16} />
                      ) : (
                        <ShieldCheck data-icon="inline-start" />
                      )}
                      {t("testConnection")}
                    </Button>
                    <Button
                      disabled={
                        pending !== null || !complete || !dirty || !canEnable
                      }
                      onClick={() => void saveProvider(provider.providerKey)}
                    >
                      {saving ? (
                        <Spinner data-icon="inline-start" size={16} />
                      ) : (
                        <Save data-icon="inline-start" />
                      )}
                      {t("saveProvider")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
        <TabsContent value="models" className="pt-3">
          <Card variant="subtle">
            <DataTableHeader
              filters={
                <DataTableToolbar
                  className="px-0"
                  actions={
                    modelProviderFilter !== "all" ||
                    modelCapabilityFilter !== "all" ||
                    modelEnabledFilter !== "all" ? (
                      <Button
                        onClick={clearModelFilters}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X /> {t("clear")}
                      </Button>
                    ) : undefined
                  }
                >
                  <DataTableFilter
                    ariaLabel={t("filterProvider")}
                    label={t("provider")}
                    onValueChange={(value) => {
                      setModelProviderFilter(value)
                      setModelPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      ...configuration.providers.map((provider) => ({
                        label: provider.label,
                        value: provider.providerKey,
                      })),
                    ]}
                    value={modelProviderFilter}
                  />
                  <DataTableFilter
                    ariaLabel={t("filterCapability")}
                    label={t("capability")}
                    onValueChange={(value) => {
                      setModelCapabilityFilter(value)
                      setModelPage(1)
                    }}
                    options={[
                      { label: t("allFeminine"), value: "all" },
                      { label: t("capabilityLabel.text"), value: "text" },
                      { label: t("capabilityLabel.image"), value: "image" },
                      { label: t("capabilityLabel.video"), value: "video" },
                    ]}
                    value={modelCapabilityFilter}
                  />
                  <DataTableFilter
                    ariaLabel={t("filterEnabled")}
                    label={t("enabledColumn")}
                    onValueChange={(value) => {
                      setModelEnabledFilter(value)
                      setModelPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("filter.enabled"), value: "enabled" },
                      { label: t("filter.disabled"), value: "disabled" },
                    ]}
                    value={modelEnabledFilter}
                  />
                </DataTableToolbar>
              }
              search={{
                ariaLabel: t("searchModelsAria"),
                onChange: (value) => {
                  setModelQuery(value)
                  setModelPage(1)
                },
                placeholder: t("searchModels"),
                value: modelQuery,
              }}
            />
            <CardContent className="flex flex-col gap-4 px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("modelColumn")}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("provider")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("capability")}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("tierColumn")}
                    </TableHead>
                    <TableHead>{t("statusColumn")}</TableHead>
                    <TableHead className="text-right">
                      {t("enabledColumn")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleModels.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>
                        <p className="font-medium">{model.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {model.modelId}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {configuration.providers.find(
                          (provider) =>
                            provider.providerKey === model.providerKey
                        )?.label ?? model.providerKey}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t(`capabilityLabel.${model.capability}`)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {t(`tier.${model.tier}`)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={model.deprecated ? "warning" : "success"}
                        >
                          {model.deprecated ? t("deprecated") : t("available")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={model.enabled}
                          disabled={
                            pending === `model-${model.id}` || model.deprecated
                          }
                          onCheckedChange={(checked) =>
                            void toggleModel(model, checked)
                          }
                          aria-label={t("enableModel", { model: model.label })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {visibleModels.length === 0 ? (
                    <TableEmptyRow
                      action={
                        hasModelFilters ? (
                          <Button onClick={clearModelFilters} variant="outline">
                            {t("clearFilters")}
                          </Button>
                        ) : null
                      }
                      colSpan={6}
                      description={
                        hasModelFilters
                          ? t("models.emptyFilteredDescription")
                          : t("models.emptyDescription")
                      }
                      title={
                        hasModelFilters
                          ? t("models.noMatches")
                          : t("models.emptyTitle")
                      }
                    />
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                canGoNext={safeModelPage < modelPageCount}
                canGoPrevious={safeModelPage > 1}
                itemLabel={t("itemLabel.models")}
                onNextPage={() =>
                  setModelPage((current) =>
                    Math.min(current + 1, modelPageCount)
                  )
                }
                onPreviousPage={() =>
                  setModelPage((current) => Math.max(current - 1, 1))
                }
                rangeEnd={modelRangeEnd}
                rangeStart={modelRangeStart}
                total={filteredModels.length}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="flex flex-col gap-4 pt-3">
          <UsagePanel
            error={usageError}
            onRetry={() => void load()}
            usage={usage}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

function UsagePanel({
  error,
  onRetry,
  usage,
}: {
  error: boolean
  onRetry: () => void
  usage: AdminAiUsage | null
}) {
  const t = useTranslations("aiConfiguration")
  const format = useFormatter()
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale)
    if (!normalized) return usage?.byModel ?? []
    return (usage?.byModel ?? []).filter((item) =>
      item.model.toLocaleLowerCase(locale).includes(normalized)
    )
  }, [locale, query, usage?.byModel])
  const pageCount = Math.max(
    1,
    Math.ceil(filteredItems.length / TABLE_PAGE_SIZE)
  )
  const safePage = Math.min(page, pageCount)
  const visibleItems = filteredItems.slice(
    (safePage - 1) * TABLE_PAGE_SIZE,
    safePage * TABLE_PAGE_SIZE
  )
  const rangeStart = filteredItems.length
    ? (safePage - 1) * TABLE_PAGE_SIZE + 1
    : 0
  const rangeEnd = filteredItems.length
    ? rangeStart + visibleItems.length - 1
    : 0

  if (error) {
    return (
      <Card variant="subtle">
        <EmptyState
          action={
            <Button onClick={onRetry} variant="brand-secondary">
              <RefreshCw data-icon="inline-start" /> {t("retry")}
            </Button>
          }
          description={t("usage.loadFailedDescription")}
          icon={Activity}
          title={t("usage.loadFailedTitle")}
        />
      </Card>
    )
  }
  if (!usage) return <PageLoading aria-label={t("usage.loading")} />
  return (
    <Card variant="subtle">
      <DataTableHeader
        search={{
          ariaLabel: t("usage.searchAria"),
          onChange: (value) => {
            setQuery(value)
            setPage(1)
          },
          placeholder: t("usage.searchPlaceholder"),
          value: query,
        }}
      />
      <CardContent className="flex flex-col gap-4 px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("modelColumn")}</TableHead>
              <TableHead>{t("requestsColumn")}</TableHead>
              <TableHead className="hidden md:table-cell">
                {t("inputTokensColumn")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("outputTokensColumn")}
              </TableHead>
              <TableHead>{t("estimatedCostColumn")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.length ? (
              visibleItems.map((item) => (
                <TableRow key={item.model}>
                  <TableCell className="font-mono text-xs">
                    {item.model}
                  </TableCell>
                  <TableCell>{format.number(item.requests)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {format.number(item.inputTokens)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {format.number(item.outputTokens)}
                  </TableCell>
                  <TableCell>
                    {money(format, item.estimatedCostMicrousd)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmptyRow
                action={
                  query.trim() ? (
                    <Button
                      onClick={() => {
                        setQuery("")
                        setPage(1)
                      }}
                      variant="outline"
                    >
                      {t("clearFilters")}
                    </Button>
                  ) : null
                }
                colSpan={5}
                description={
                  query.trim()
                    ? t("usage.emptyFilteredDescription")
                    : t("usage.emptyDescription")
                }
                title={
                  query.trim() ? t("usage.noMatches") : t("usage.emptyTitle")
                }
              />
            )}
          </TableBody>
        </Table>
        <TablePagination
          canGoNext={safePage < pageCount}
          canGoPrevious={safePage > 1}
          itemLabel={t("itemLabel.models")}
          onNextPage={() =>
            setPage((current) => Math.min(current + 1, pageCount))
          }
          onPreviousPage={() => setPage((current) => Math.max(current - 1, 1))}
          rangeEnd={rangeEnd}
          rangeStart={rangeStart}
          total={filteredItems.length}
        />
      </CardContent>
    </Card>
  )
}
