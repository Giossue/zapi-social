"use client"

import Image from "next/image"
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useLocale, useTranslations } from "next-intl"
import { ApiError, filesApi, watermarksApi } from "@workspace/api-client"
import type {
  CreatePortalWatermarkInput,
  PortalWatermark,
} from "@workspace/contracts"
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  MoveDownLeft,
  MoveDownRight,
  MoveUpLeft,
  MoveUpRight,
  Plus,
  Save,
  ScanLine,
  Search,
  Sparkles,
  Star,
  TriangleAlert,
  X,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { DataTableFilter } from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { TableResetFiltersButton } from "@/components/table-reset-filters-button"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { toast } from "@workspace/ui/components/toast"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
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
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Slider } from "@workspace/ui/components/slider"
import { Spinner } from "@workspace/ui/components/spinner"
import { Toggle } from "@workspace/ui/components/toggle"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import type {
  WatermarkAccount,
  WatermarkDraft,
  WatermarkImageAsset,
  WatermarkLibraryFolder,
  WatermarkPosition,
  WatermarkRule,
  WatermarkTextColor,
  WatermarkTextPreset,
  WatermarkTextWeight,
  WatermarkType,
} from "@/features/watermarks/types/watermarks"

const previewContentSrc = "/preview/post-hamburguesa.webp"

const defaultDraft: WatermarkDraft = {
  socialAccountId: null,
  type: "image",
  imageFileAssetId: null,
  text: null,
  position: "bottom-right",
  opacityPercent: 72,
  scalePercent: 24,
  textPreset: "glass",
  textColor: "brand-gradient",
  textWeight: "semibold",
}

const providerLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
}

const accountProviderFilters = [
  { label: null, value: "all" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
  { label: "LinkedIn", value: "linkedin" },
] as const

const positionItems: Array<{
  value: WatermarkPosition
  icon: typeof MoveUpLeft
}> = [
  { value: "top-left", icon: MoveUpLeft },
  { value: "top-right", icon: MoveUpRight },
  { value: "center", icon: ScanLine },
  { value: "bottom-left", icon: MoveDownLeft },
  { value: "bottom-right", icon: MoveDownRight },
]

const positionClass: Record<WatermarkPosition, string> = {
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "right-4 bottom-4",
}

const textPresetClass: Record<WatermarkTextPreset, string> = {
  glass:
    "rounded-md border bg-background/70 px-2 py-1 shadow-sm backdrop-blur-sm",
  "solid-dark": "rounded-md bg-foreground px-2 py-1 text-background",
  "solid-light": "rounded-md bg-background px-2 py-1 text-foreground",
  minimal: "text-shadow-sm",
}

const textColorClass: Record<WatermarkTextColor, string> = {
  "brand-gradient": "text-primary",
  "sunset-gradient": "text-warning",
  "ocean-gradient": "text-info",
  dark: "text-foreground",
  white: "text-background",
}

const textWeightClass: Record<WatermarkTextWeight, string> = {
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
}

const DRAFT_COMPARED_KEYS = [
  "type",
  "imageFileAssetId",
  "text",
  "position",
  "opacityPercent",
  "scalePercent",
  "textPreset",
  "textColor",
  "textWeight",
] as const satisfies ReadonlyArray<keyof WatermarkDraft>

function toWatermarkRule(watermark: PortalWatermark): WatermarkRule {
  return {
    id: watermark.id,
    socialAccountId: watermark.socialAccountId,
    type: watermark.type,
    imageFileAssetId: watermark.imageFileAssetId,
    text: watermark.text,
    position: watermark.position,
    opacityPercent: watermark.opacityPercent,
    scalePercent: watermark.scalePercent,
    textPreset: watermark.textPreset,
    textColor: watermark.textColor,
    textWeight: watermark.textWeight,
    updatedAt: watermark.updatedAt,
  }
}

function toWatermarkInput(
  draft: WatermarkDraft,
  socialAccountId: string | null
): CreatePortalWatermarkInput | null {
  const shared = {
    socialAccountId,
    position: draft.position,
    opacityPercent: draft.opacityPercent,
    scalePercent: draft.scalePercent,
    textPreset: draft.textPreset,
    textColor: draft.textColor,
    textWeight: draft.textWeight,
  }

  if (draft.type === "image") {
    return draft.imageFileAssetId
      ? { ...shared, type: "image", imageFileAssetId: draft.imageFileAssetId }
      : null
  }

  const text = (draft.text ?? "").trim()
  return text ? { ...shared, type: "text", text } : null
}

function watermarkErrorKey(error: unknown) {
  if (!(error instanceof ApiError)) return "saveFailed"
  if (error.code === "WATERMARK_TARGET_EXISTS") return "targetExists"
  if (error.status === 403) return "forbidden"
  if (error.status === 404) return "missing"
  if (error.status === 400) return "invalid"
  return "saveFailed"
}

function draftFromRule(rule: WatermarkRule | null): WatermarkDraft {
  if (rule) {
    return {
      socialAccountId: rule.socialAccountId,
      type: rule.type,
      imageFileAssetId: rule.imageFileAssetId,
      text: rule.text,
      position: rule.position,
      opacityPercent: rule.opacityPercent,
      scalePercent: rule.scalePercent,
      textPreset: rule.textPreset,
      textColor: rule.textColor,
      textWeight: rule.textWeight,
    }
  }
  return { ...defaultDraft }
}

function WatermarkScopePicker({
  accounts,
  isGlobalScope,
  onGlobalSelect,
  onSelectedAccountIdsChange,
  selectedAccountIds,
}: {
  accounts: readonly WatermarkAccount[]
  isGlobalScope: boolean
  onGlobalSelect: () => void
  onSelectedAccountIdsChange: (accountIds: string[]) => void
  selectedAccountIds: string[]
}) {
  const t = useTranslations("watermarks")
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [provider, setProvider] =
    useState<(typeof accountProviderFilters)[number]["value"]>("all")
  const [query, setQuery] = useState("")
  const selectedAccounts = accounts.filter((account) =>
    selectedAccountIds.includes(account.id)
  )
  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale)
    return accounts.filter((account) => {
      const matchesProvider =
        provider === "all" || account.providerKey === provider
      const matchesQuery =
        !normalizedQuery ||
        [
          account.displayName,
          providerLabels[account.providerKey] ?? account.providerKey,
        ]
          .join(" ")
          .toLocaleLowerCase(locale)
          .includes(normalizedQuery)

      return matchesProvider && matchesQuery
    })
  }, [accounts, locale, provider, query])

  function toggleAccount(accountId: string, checked: boolean) {
    onSelectedAccountIdsChange(
      checked
        ? [...new Set([...selectedAccountIds, accountId])]
        : selectedAccountIds.filter((id) => id !== accountId)
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-required="true"
            className="w-full justify-between"
            role="combobox"
            variant="brand-secondary"
          >
            <span className="truncate">
              {isGlobalScope
                ? t("globalScope")
                : selectedAccounts.length
                  ? t("selectedAccounts", { count: selectedAccounts.length })
                  : t("pickAccounts")}
            </span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(30rem,calc(100vw-2rem))]"
        >
          <div className="flex flex-col gap-3">
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label={t("searchAccountsAria")}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchAccounts")}
                value={query}
              />
            </InputGroup>
            <ToggleGroup
              aria-label={t("filterAccounts")}
              onValueChange={(value) =>
                value &&
                setProvider(
                  value as (typeof accountProviderFilters)[number]["value"]
                )
              }
              size="sm"
              spacing={1}
              type="single"
              value={provider}
              variant="outline"
            >
              {accountProviderFilters.map((filter) => (
                <ToggleGroupItem key={filter.value} value={filter.value}>
                  {filter.label ?? t("allNetworks")}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="max-h-72 overflow-y-auto">
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <Checkbox
                    checked={isGlobalScope}
                    onCheckedChange={(value) => {
                      if (value === true) onGlobalSelect()
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {t("globalRule")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t("globalRuleHint")}
                    </span>
                  </span>
                  {isGlobalScope ? (
                    <Check aria-hidden="true" className="text-success" />
                  ) : null}
                </label>
                {filteredAccounts.map((account) => {
                  const checked = selectedAccountIds.includes(account.id)
                  return (
                    <label
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
                      key={account.id}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleAccount(account.id, value === true)
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {account.displayName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {providerLabels[account.providerKey] ??
                            account.providerKey}
                        </span>
                      </span>
                      {checked ? (
                        <Check aria-hidden="true" className="text-success" />
                      ) : null}
                    </label>
                  )
                })}
                {!filteredAccounts.length ? (
                  <p className="px-1 py-3 text-sm text-muted-foreground">
                    {t("noAccounts")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {!isGlobalScope && selectedAccounts.length ? (
        <div
          aria-label={t("selectedAccountsLabel")}
          className="flex flex-wrap gap-2"
        >
          {selectedAccounts.map((account) => (
            <Badge key={account.id} variant="neutral">
              {account.displayName} · {providerLabels[account.providerKey]}
              <Button
                aria-label={t("removeAccount", { name: account.displayName })}
                onClick={() => toggleAccount(account.id, false)}
                size="icon-xs"
                variant="brand-secondary"
              >
                <X />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function useLibraryImages() {
  const [assets, setAssets] = useState<WatermarkImageAsset[]>([])
  const [folders, setFolders] = useState<WatermarkLibraryFolder[]>([])
  const [query, setQuery] = useState("")
  const [folderId, setFolderId] = useState<string>("all")
  const [starredOnly, setStarredOnly] = useState(false)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const deferredQuery = useDeferredValue(query)
  const trimmedQuery = deferredQuery.trim()

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const data = await filesApi.list({
        kind: "image",
        limit: 100,
        ...(trimmedQuery ? { q: trimmedQuery } : {}),
        ...(folderId === "all" ? {} : { folderId }),
        ...(starredOnly ? { starred: true } : {}),
      })
      setAssets(
        data.files.map((file) => ({
          id: file.id,
          name: file.name,
          previewSrc:
            file.thumbnailStatus === "ready"
              ? filesApi.thumbnailUrl(file.id)
              : filesApi.previewUrl(file.id),
        }))
      )
      setFolders(data.folders.map(({ id, name }) => ({ id, name })))
      setStatus("ready")
    } catch {
      setAssets([])
      setStatus("error")
    }
  }, [folderId, starredOnly, trimmedQuery])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  return {
    assets,
    folderId,
    folders,
    query,
    reload: load,
    setFolderId,
    setQuery,
    setStarredOnly,
    starredOnly,
    status,
  }
}

function WatermarkImagePicker({
  library,
  onOpenChange,
  onSelect,
  open,
  selectedId,
}: {
  library: ReturnType<typeof useLibraryImages>
  onOpenChange: (open: boolean) => void
  onSelect: (asset: WatermarkImageAsset) => void
  open: boolean
  selectedId: string | null
}) {
  const t = useTranslations("watermarks")
  const isFiltering =
    library.query.trim() !== "" ||
    library.folderId !== "all" ||
    library.starredOnly

  function clearFilters() {
    library.setQuery("")
    library.setFolderId("all")
    library.setStarredOnly(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-md lg:max-w-lg"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{t("picker.title")}</SheetTitle>
          <SheetDescription>{t("picker.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 border-b p-4">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("picker.searchAria")}
              onChange={(event) => library.setQuery(event.target.value)}
              placeholder={t("picker.searchPlaceholder")}
              value={library.query}
            />
          </InputGroup>
          <DataTableToolbar
            className="px-0"
            loading={library.status === "loading" && library.assets.length > 0}
          >
            <DataTableFilter
              ariaLabel={t("picker.folder")}
              onValueChange={library.setFolderId}
              options={[
                { label: t("picker.allFolders"), value: "all" },
                ...library.folders.map((folder) => ({
                  label: folder.name,
                  value: folder.id,
                })),
              ]}
              value={library.folderId}
            />
            <Toggle
              aria-label={t("picker.starredAria")}
              onPressedChange={library.setStarredOnly}
              pressed={library.starredOnly}
            >
              <Star aria-hidden="true" data-icon="inline-start" />
              {t("picker.starred")}
            </Toggle>
          </DataTableToolbar>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {library.status === "loading" && library.assets.length === 0 ? (
            <PageLoading />
          ) : null}
          {library.status === "error" ? (
            <EmptyState
              action={
                <RetryButton
                  onClick={library.reload}
                  variant="brand-secondary"
                />
              }
              description={t("retryHint")}
              icon={TriangleAlert}
              title={t("picker.loadFailed")}
            />
          ) : null}
          {library.status === "ready" && library.assets.length === 0 ? (
            <EmptyState
              action={
                isFiltering ? (
                  <TableResetFiltersButton onClickAction={clearFilters} />
                ) : null
              }
              description={
                isFiltering
                  ? t("picker.emptyFilteredDescription")
                  : t("picker.emptyDescription")
              }
              icon={ImageIcon}
              title={
                isFiltering ? t("picker.noMatches") : t("picker.emptyTitle")
              }
            />
          ) : null}
          {library.assets.length > 0 && library.status !== "error" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {library.assets.map((asset) => {
                const selected = asset.id === selectedId
                return (
                  <button
                    className={`group flex min-w-0 flex-col overflow-hidden rounded-lg border text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${selected ? "border-primary" : "border-border"}`}
                    key={asset.id}
                    onClick={() => {
                      onSelect(asset)
                      onOpenChange(false)
                    }}
                    type="button"
                  >
                    <span className="flex aspect-square items-center justify-center bg-muted p-5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- la biblioteca sirve las imágenes desde la API, fuera del optimizador de Next. */}
                      <img
                        alt=""
                        className="max-h-full max-w-full object-contain"
                        src={asset.previewSrc}
                      />
                    </span>
                    <span className="truncate px-2.5 py-2 text-sm font-medium">
                      {asset.name}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function WatermarkPreview({
  draft,
  image,
}: {
  draft: WatermarkDraft
  image: WatermarkImageAsset | null
}) {
  const t = useTranslations("watermarks")
  return (
    <Card className="overflow-hidden" variant="surface">
      <CardHeader className="border-b">
        <CardTitle className="text-base">{t("preview.title")}</CardTitle>
        <CardDescription>{t("preview.description")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
          <Image
            alt={t("preview.samplePost")}
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 21rem, 100vw"
            src={previewContentSrc}
          />
          <div
            className={`absolute ${draft.type === "text" ? "max-w-[calc(100%-2rem)]" : ""} ${positionClass[draft.position]}`}
            style={{
              opacity: draft.opacityPercent / 100,
              width:
                draft.type === "image" ? `${draft.scalePercent}%` : undefined,
            }}
          >
            {draft.type === "image" && image ? (
              // eslint-disable-next-line @next/next/no-img-element -- la biblioteca sirve las imágenes desde la API, fuera del optimizador de Next.
              <img
                alt={t("preview.selectedWatermark")}
                className="h-auto w-full"
                src={image.previewSrc}
              />
            ) : null}
            {draft.type === "text" ? (
              <span
                className={`block max-w-full text-sm break-words ${textPresetClass[draft.textPreset]} ${textColorClass[draft.textColor]} ${textWeightClass[draft.textWeight]}`}
                style={{
                  fontSize: `${Math.max(10, draft.scalePercent / 1.75)}px`,
                }}
              >
                {draft.text || "Tu marca"}
              </span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function WatermarksPage() {
  const t = useTranslations("watermarks")
  const [rules, setRules] = useState<WatermarkRule[]>([])
  const [accounts, setAccounts] = useState<WatermarkAccount[]>([])
  const [canManage, setCanManage] = useState(false)
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  )
  const [pending, setPending] = useState(false)
  const [isGlobalScope, setIsGlobalScope] = useState(true)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const library = useLibraryImages()
  const [draft, setDraft] = useState<WatermarkDraft>(() => ({
    ...defaultDraft,
  }))

  const loadRules = useCallback(async () => {
    setListStatus("loading")
    try {
      const data = await watermarksApi.list()
      setAccounts(
        data.accounts.map(
          ({ capabilityKey, displayName, id, providerKey }) => ({
            capabilityKey,
            displayName,
            id,
            providerKey,
          })
        )
      )
      setRules(data.watermarks.map(toWatermarkRule))
      setCanManage(data.canManage)
      setListStatus("ready")
    } catch {
      setListStatus("error")
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void loadRules(), 0)
    return () => clearTimeout(timer)
  }, [loadRules])

  const targetAccountIds = isGlobalScope ? [null] : selectedAccountIds
  const targetRules = useMemo(
    () =>
      rules.filter((rule) =>
        isGlobalScope
          ? rule.socialAccountId === null
          : rule.socialAccountId !== null &&
            selectedAccountIds.includes(rule.socialAccountId)
      ),
    [isGlobalScope, rules, selectedAccountIds]
  )
  const hasTarget = targetAccountIds.length > 0
  const baselineDraft = useMemo(
    () => draftFromRule(targetRules[0] ?? null),
    [targetRules]
  )
  const isDirty = useMemo(
    () => DRAFT_COMPARED_KEYS.some((key) => draft[key] !== baselineDraft[key]),
    [baselineDraft, draft]
  )
  const isCreating = targetRules.length === 0
  const targetKey = isGlobalScope ? "global" : selectedAccountIds.join(",")
  const baselineKey = `${targetKey}:${rules.length}:${targetRules[0]?.id ?? ""}`
  const [lastBaselineKey, setLastBaselineKey] = useState(baselineKey)

  if (baselineKey !== lastBaselineKey) {
    setLastBaselineKey(baselineKey)
    setDraft(draftFromRule(targetRules[0] ?? null))
  }
  const hasContent =
    draft.type === "image"
      ? draft.imageFileAssetId !== null
      : (draft.text ?? "").trim() !== ""
  const canSave =
    canManage && hasTarget && hasContent && (isCreating || isDirty)

  function updateDraft<Key extends keyof WatermarkDraft>(
    key: Key,
    value: WatermarkDraft[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    if (!canSave || pending) return

    setPending(true)
    try {
      const configuredByAccountId = new Map(
        targetRules.map((rule) => [rule.socialAccountId, rule.id])
      )
      await Promise.all(
        targetAccountIds.map((socialAccountId) => {
          const payload = toWatermarkInput(draft, socialAccountId)
          if (!payload) return Promise.resolve()
          const existingId = configuredByAccountId.get(socialAccountId)
          return existingId
            ? watermarksApi.update(existingId, payload)
            : watermarksApi.create(payload)
        })
      )
      await loadRules()
      toast.success(isCreating ? t("created") : t("updated"))
    } catch (error) {
      toast.error(t(`error.${watermarkErrorKey(error)}`))
    } finally {
      setPending(false)
    }
  }

  const selectedImage =
    library.assets.find(({ id }) => id === draft.imageFileAssetId) ?? null

  if (listStatus === "loading") return <PageLoading className="min-h-dvh" />

  if (listStatus === "error") {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void loadRules()}
                variant="brand-secondary"
              />
            }
            description={t("retryHint")}
            icon={TriangleAlert}
            title={t("loadFailed")}
          />
        </CardContent>
      </Card>
    )
  }

  if (!canManage) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={Sparkles}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader description={t("description")} title={t("title")} />
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Card variant="subtle">
            <CardContent className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:p-6">
              <div className="flex flex-col gap-6 lg:self-center">
                <Field>
                  <FieldLabel>
                    Aplicar en{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <WatermarkScopePicker
                    accounts={accounts}
                    isGlobalScope={isGlobalScope}
                    onGlobalSelect={() => {
                      setIsGlobalScope(true)
                      setSelectedAccountIds([])
                    }}
                    onSelectedAccountIdsChange={(accountIds) => {
                      setIsGlobalScope(false)
                      setSelectedAccountIds(accountIds)
                    }}
                    selectedAccountIds={selectedAccountIds}
                  />
                  <FieldDescription>{t("scopeHint")}</FieldDescription>
                </Field>
                <Tabs
                  onValueChange={(value) =>
                    updateDraft("type", value as WatermarkType)
                  }
                  value={draft.type}
                >
                  <TabsList>
                    <TabsTrigger value="image">{t("image")}</TabsTrigger>
                    <TabsTrigger value="text">{t("text")}</TabsTrigger>
                  </TabsList>
                  <TabsContent className="pt-4" value="image">
                    <Field>
                      <FieldLabel>
                        Archivo de la biblioteca{" "}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <button
                        aria-expanded={imagePickerOpen}
                        aria-required="true"
                        className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        onClick={() => setImagePickerOpen(true)}
                        role="combobox"
                        type="button"
                      >
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted p-2 text-muted-foreground">
                          {selectedImage ? (
                            // eslint-disable-next-line @next/next/no-img-element -- la biblioteca sirve las imágenes desde la API, fuera del optimizador de Next.
                            <img
                              alt=""
                              className="max-h-full max-w-full object-contain"
                              src={selectedImage.previewSrc}
                            />
                          ) : (
                            <ImageIcon aria-hidden="true" className="size-5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {selectedImage?.name ?? t("pickFile")}
                          </span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {t("pickFileHint")}
                          </span>
                        </span>
                        <Button asChild size="sm" variant="outline">
                          <span>{t("change")}</span>
                        </Button>
                      </button>
                    </Field>
                  </TabsContent>
                  <TabsContent className="pt-4" value="text">
                    <Field>
                      <FieldLabel htmlFor="watermark-text">
                        {t("watermarkText")}{" "}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FieldLabel>
                      <Textarea
                        aria-required="true"
                        id="watermark-text"
                        maxLength={1000}
                        onChange={(event) =>
                          updateDraft("text", event.target.value)
                        }
                        placeholder={t("watermarkTextPlaceholder")}
                        rows={3}
                        value={draft.text ?? ""}
                      />
                      <FieldDescription>
                        {t("watermarkTextHint")}
                      </FieldDescription>
                    </Field>
                  </TabsContent>
                </Tabs>
                <FieldGroup className="gap-5">
                  <Field>
                    <FieldLabel>{t("position")}</FieldLabel>
                    <ToggleGroup
                      onValueChange={(value) => {
                        if (value)
                          updateDraft("position", value as WatermarkPosition)
                      }}
                      size="sm"
                      spacing={1}
                      type="single"
                      value={draft.position}
                      variant="outline"
                    >
                      {positionItems.map(({ value, icon: Icon }) => (
                        <ToggleGroupItem
                          aria-label={t(`positionLabel.${value}`)}
                          key={value}
                          value={value}
                        >
                          <Icon />
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="watermark-scale">
                      {t("size")}{" "}
                      <span className="text-muted-foreground">
                        {draft.scalePercent}%
                      </span>
                    </FieldLabel>
                    <Slider
                      id="watermark-scale"
                      max={100}
                      min={5}
                      onValueChange={([value]) =>
                        updateDraft("scalePercent", value ?? draft.scalePercent)
                      }
                      step={1}
                      value={[draft.scalePercent]}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="watermark-opacity">
                      {t("opacity")}{" "}
                      <span className="text-muted-foreground">
                        {draft.opacityPercent}%
                      </span>
                    </FieldLabel>
                    <Slider
                      id="watermark-opacity"
                      max={100}
                      min={5}
                      onValueChange={([value]) =>
                        updateDraft(
                          "opacityPercent",
                          value ?? draft.opacityPercent
                        )
                      }
                      step={1}
                      value={[draft.opacityPercent]}
                    />
                  </Field>
                </FieldGroup>
                {draft.type === "text" ? (
                  <FieldGroup className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel>{t("style")}</FieldLabel>
                      <Select
                        onValueChange={(value) =>
                          updateDraft(
                            "textPreset",
                            value as WatermarkTextPreset
                          )
                        }
                        value={draft.textPreset}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="glass">
                              {t("preset.glass")}
                            </SelectItem>
                            <SelectItem value="solid-dark">
                              {t("preset.solidDark")}
                            </SelectItem>
                            <SelectItem value="solid-light">
                              {t("preset.solidLight")}
                            </SelectItem>
                            <SelectItem value="minimal">
                              {t("preset.minimal")}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>{t("colorLabel")}</FieldLabel>
                      <Select
                        onValueChange={(value) =>
                          updateDraft("textColor", value as WatermarkTextColor)
                        }
                        value={draft.textColor}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="brand-gradient">
                              {t("color.brand")}
                            </SelectItem>
                            <SelectItem value="sunset-gradient">
                              {t("color.sunset")}
                            </SelectItem>
                            <SelectItem value="ocean-gradient">
                              {t("color.ocean")}
                            </SelectItem>
                            <SelectItem value="dark">
                              {t("color.dark")}
                            </SelectItem>
                            <SelectItem value="white">
                              {t("color.white")}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>{t("weightLabel")}</FieldLabel>
                      <Select
                        onValueChange={(value) =>
                          updateDraft(
                            "textWeight",
                            value as WatermarkTextWeight
                          )
                        }
                        value={draft.textWeight}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="medium">
                              {t("weight.medium")}
                            </SelectItem>
                            <SelectItem value="semibold">
                              {t("weight.semibold")}
                            </SelectItem>
                            <SelectItem value="bold">
                              {t("weight.bold")}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
                ) : null}
              </div>
              <WatermarkPreview draft={draft} image={selectedImage} />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button
              aria-busy={pending}
              className="hidden sm:inline-flex"
              disabled={!canSave || pending}
              type="submit"
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : isCreating ? (
                <Plus aria-hidden="true" data-icon="inline-start" />
              ) : (
                <Save aria-hidden="true" data-icon="inline-start" />
              )}
              {isCreating
                ? isGlobalScope
                  ? t("create")
                  : t("applyToAccounts")
                : t("saveChanges")}
            </Button>
          </div>
        </form>
        <FloatingActionButton
          aria-busy={pending}
          disabled={!canSave || pending}
          icon={
            isCreating ? undefined : (
              <Save aria-hidden="true" className="size-6" />
            )
          }
          label={
            isCreating
              ? isGlobalScope
                ? t("create")
                : t("applyToAccounts")
              : t("saveChanges")
          }
          onClick={() => void save()}
        />
      </div>
      <WatermarkImagePicker
        library={library}
        onOpenChange={setImagePickerOpen}
        onSelect={(asset) => updateDraft("imageFileAssetId", asset.id)}
        open={imagePickerOpen}
        selectedId={draft.imageFileAssetId}
      />
    </>
  )
}
