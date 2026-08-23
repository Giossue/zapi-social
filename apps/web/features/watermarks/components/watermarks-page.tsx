"use client"

import Image from "next/image"
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react"
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
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
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
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@workspace/ui/components/page-loading"
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

/** Publicación sintética que sirve de lienzo en la vista previa del editor. */
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
  { label: "Todas", value: "all" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
  { label: "LinkedIn", value: "linkedin" },
] as const

const positionItems: Array<{
  value: WatermarkPosition
  label: string
  icon: typeof MoveUpLeft
}> = [
  { value: "top-left", label: "Superior izquierda", icon: MoveUpLeft },
  { value: "top-right", label: "Superior derecha", icon: MoveUpRight },
  { value: "center", label: "Centro", icon: ScanLine },
  { value: "bottom-left", label: "Inferior izquierda", icon: MoveDownLeft },
  { value: "bottom-right", label: "Inferior derecha", icon: MoveDownRight },
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

/** Campos que definen la configuración; `socialAccountId` lo fija el objetivo, no el editor. */
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

/**
 * El contrato es una unión discriminada estricta: `image` no admite `text` ni al
 * revés. Devuelve `null` cuando falta el contenido obligatorio del modo activo.
 */
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

function watermarkErrorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return "No pudimos guardar los cambios. Inténtalo de nuevo."

  if (error.code === "WATERMARK_TARGET_EXISTS")
    return "Ese destino ya tiene una marca de agua. Recarga la página para verla."
  if (error.status === 403)
    return "No tienes permiso para administrar marcas de agua."
  if (error.status === 404)
    return "La marca de agua ya no existe. Recarga la página."
  if (error.status === 400)
    return "Revisa la imagen o el texto: el servidor rechazó la configuración."
  return "No pudimos guardar los cambios. Inténtalo de nuevo."
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
  const [open, setOpen] = useState(false)
  const [provider, setProvider] =
    useState<(typeof accountProviderFilters)[number]["value"]>("all")
  const [query, setQuery] = useState("")
  const selectedAccounts = accounts.filter((account) =>
    selectedAccountIds.includes(account.id)
  )
  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
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
          .toLocaleLowerCase("es")
          .includes(normalizedQuery)

      return matchesProvider && matchesQuery
    })
  }, [accounts, provider, query])

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
                ? "Regla global · todos los canales"
                : selectedAccounts.length
                  ? `${selectedAccounts.length} cuenta${selectedAccounts.length === 1 ? "" : "s"} seleccionada${selectedAccounts.length === 1 ? "" : "s"}`
                  : "Seleccionar cuentas"}
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
                aria-label="Buscar cuentas"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar una cuenta"
                value={query}
              />
            </InputGroup>
            <ToggleGroup
              aria-label="Filtrar cuentas por red"
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
                  {filter.label}
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
                      Regla global
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Se aplica a todos los canales sin una regla propia.
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
                    No encontramos cuentas con esos filtros.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {!isGlobalScope && selectedAccounts.length ? (
        <div
          aria-label="Cuentas seleccionadas"
          className="flex flex-wrap gap-2"
        >
          {selectedAccounts.map((account) => (
            <Badge key={account.id} variant="neutral">
              {account.displayName} · {providerLabels[account.providerKey]}
              <Button
                aria-label={`Quitar ${account.displayName}`}
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

/** Imágenes del administrador de archivos, únicas candidatas a marca de agua. */
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
    void load()
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
          <SheetTitle>Elegir archivo de la biblioteca</SheetTitle>
          <SheetDescription>
            Selecciona una imagen cuadrada o con fondo transparente para usarla
            como marca de agua.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 border-b p-4">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Buscar imágenes"
              onChange={(event) => library.setQuery(event.target.value)}
              placeholder="Buscar imágenes..."
              value={library.query}
            />
          </InputGroup>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              onValueChange={library.setFolderId}
              value={library.folderId}
            >
              <SelectTrigger aria-label="Carpeta" className="max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todas las carpetas</SelectItem>
                  {library.folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Toggle
              aria-label="Solo destacados"
              onPressedChange={library.setStarredOnly}
              pressed={library.starredOnly}
            >
              <Star aria-hidden="true" data-icon="inline-start" />
              Destacados
            </Toggle>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {library.status === "loading" ? <PageLoading /> : null}
          {library.status === "error" ? (
            <EmptyState
              action={
                <RetryButton
                  onClick={library.reload}
                  variant="brand-secondary"
                />
              }
              description="Comprueba tu conexión e inténtalo de nuevo."
              icon={TriangleAlert}
              title="No pudimos cargar tu biblioteca"
            />
          ) : null}
          {library.status === "ready" && library.assets.length === 0 ? (
            <EmptyState
              action={
                isFiltering ? (
                  <Button onClick={clearFilters} variant="brand-secondary">
                    Limpiar filtros
                  </Button>
                ) : null
              }
              description={
                isFiltering
                  ? "Prueba con otro término o quita los filtros."
                  : "Sube una imagen al administrador de archivos para usarla como marca de agua."
              }
              icon={ImageIcon}
              title={
                isFiltering
                  ? "No encontramos imágenes"
                  : "Aún no tienes imágenes"
              }
            />
          ) : null}
          {library.status === "ready" && library.assets.length > 0 ? (
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
  return (
    <Card className="overflow-hidden" variant="surface">
      <CardHeader className="border-b">
        <CardTitle className="text-base">Vista previa</CardTitle>
        <CardDescription>
          Así se aplicará sobre el contenido al publicar.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
          <Image
            alt="Publicación de ejemplo"
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
                alt="Marca de agua seleccionada"
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
  const [deleteOpen, setDeleteOpen] = useState(false)
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
    void loadRules()
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
  /** Configuración ya guardada del objetivo actual; línea base para detectar cambios. */
  const baselineDraft = useMemo(
    () => draftFromRule(targetRules[0] ?? null),
    [targetRules]
  )
  const isDirty = useMemo(
    () => DRAFT_COMPARED_KEYS.some((key) => draft[key] !== baselineDraft[key]),
    [baselineDraft, draft]
  )
  const isCreating = targetRules.length === 0
  /** Al cambiar de objetivo el editor parte de lo que ese objetivo tiene guardado. */
  const targetKey = isGlobalScope ? "global" : selectedAccountIds.join(",")
  useEffect(() => {
    setDraft(draftFromRule(targetRules[0] ?? null))
    // El objetivo define la línea base; `targetRules` cambia también al recargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, rules])
  /** Una marca sin contenido no se puede aplicar: imagen en modo imagen, texto en modo texto. */
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
      toast.success(
        isCreating ? "Marca de agua creada" : "Marca de agua actualizada"
      )
    } catch (error) {
      toast.error(watermarkErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!targetRules.length || pending) return

    setPending(true)
    try {
      await Promise.all(
        targetRules.map((rule) => watermarksApi.remove(rule.id))
      )
      await loadRules()
      setDeleteOpen(false)
      toast.success(
        targetRules.length === 1
          ? "Marca de agua eliminada"
          : "Marcas de agua eliminadas"
      )
    } catch (error) {
      toast.error(watermarkErrorMessage(error))
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
            description="Comprueba tu conexión e inténtalo de nuevo."
            icon={TriangleAlert}
            title="No pudimos cargar las marcas de agua"
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
            description="Tu rol actual no permite administrar las marcas de agua de este espacio de trabajo."
            icon={Sparkles}
            title="Marca de agua no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <CollectionHeader
            description="Añade una marca visual que se aplicará al contenido antes de enviarlo a tus canales."
            title="Marca de agua"
          />
          {targetRules.length ? (
            <Button
              onClick={() => setDeleteOpen(true)}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Trash2 /> Eliminar
            </Button>
          ) : null}
        </div>
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
              <div className="flex flex-col gap-6">
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
                  <FieldDescription>
                    La regla global se aplica a todos los canales. Si
                    seleccionas cuentas, la misma configuración se aplicará solo
                    a ellas.
                  </FieldDescription>
                </Field>
                <Tabs
                  onValueChange={(value) =>
                    updateDraft("type", value as WatermarkType)
                  }
                  value={draft.type}
                >
                  <TabsList>
                    <TabsTrigger value="image">Imagen</TabsTrigger>
                    <TabsTrigger value="text">Texto</TabsTrigger>
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
                            {selectedImage?.name ?? "Seleccionar archivo"}
                          </span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            Elige una imagen del administrador de archivos.
                          </span>
                        </span>
                        <Button asChild size="sm" variant="outline">
                          <span>Cambiar</span>
                        </Button>
                      </button>
                    </Field>
                  </TabsContent>
                  <TabsContent className="pt-4" value="text">
                    <Field>
                      <FieldLabel htmlFor="watermark-text">
                        Texto de la marca{" "}
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
                        placeholder="Ej. @tu_marca"
                        rows={3}
                        value={draft.text ?? ""}
                      />
                      <FieldDescription>
                        Usa un texto breve que se mantenga legible sobre el
                        contenido.
                      </FieldDescription>
                    </Field>
                  </TabsContent>
                </Tabs>
                <FieldGroup className="gap-5">
                  <Field>
                    <FieldLabel>Posición</FieldLabel>
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
                      {positionItems.map(({ value, label, icon: Icon }) => (
                        <ToggleGroupItem
                          aria-label={label}
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
                      Tamaño{" "}
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
                      Opacidad{" "}
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
                      <FieldLabel>Estilo</FieldLabel>
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
                            <SelectItem value="glass">Cristal</SelectItem>
                            <SelectItem value="solid-dark">
                              Sólido oscuro
                            </SelectItem>
                            <SelectItem value="solid-light">
                              Sólido claro
                            </SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Color</FieldLabel>
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
                              Marca
                            </SelectItem>
                            <SelectItem value="sunset-gradient">
                              Atardecer
                            </SelectItem>
                            <SelectItem value="ocean-gradient">
                              Océano
                            </SelectItem>
                            <SelectItem value="dark">Oscuro</SelectItem>
                            <SelectItem value="white">Blanco</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Peso</FieldLabel>
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
                            <SelectItem value="medium">Medio</SelectItem>
                            <SelectItem value="semibold">Semibold</SelectItem>
                            <SelectItem value="bold">Negrita</SelectItem>
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
                  ? "Crear marca de agua"
                  : "Aplicar a cuentas"
                : "Guardar cambios"}
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
                ? "Crear marca de agua"
                : "Aplicar a cuentas"
              : "Guardar cambios"
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
      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetRules.length === 1
                ? "¿Eliminar esta marca de agua?"
                : "¿Eliminar estas marcas de agua?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Las publicaciones nuevas dejarán de usarlas. Esta acción no afecta
              el contenido ya publicado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                void remove()
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Eliminando..." : "Eliminar marca"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
