"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  MoveDownLeft,
  MoveDownRight,
  MoveUpLeft,
  MoveUpRight,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Trash2,
  Type,
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
  AlertDialogMedia,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
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
import { Slider } from "@workspace/ui/components/slider"
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

import {
  watermarkAccountsFixture,
  watermarkImageAssetsFixture,
  watermarksFixture,
} from "@/features/watermarks/fixtures/watermarks"
import type {
  WatermarkDraft,
  WatermarkImageAsset,
  WatermarkPosition,
  WatermarkRule,
  WatermarkTextColor,
  WatermarkTextPreset,
  WatermarkTextWeight,
  WatermarkType,
} from "@/features/watermarks/types/watermarks"

const defaultDraft: WatermarkDraft = {
  socialAccountId: null,
  type: "image",
  imageFileAssetId: watermarkImageAssetsFixture[0]!.id,
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
  isGlobalScope,
  onGlobalSelect,
  onSelectedAccountIdsChange,
  selectedAccountIds,
}: {
  isGlobalScope: boolean
  onGlobalSelect: () => void
  onSelectedAccountIdsChange: (accountIds: string[]) => void
  selectedAccountIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] =
    useState<(typeof accountProviderFilters)[number]["value"]>("all")
  const [query, setQuery] = useState("")
  const selectedAccounts = watermarkAccountsFixture.filter((account) =>
    selectedAccountIds.includes(account.id)
  )
  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return watermarkAccountsFixture.filter((account) => {
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
  }, [provider, query])

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
          <Button className="w-full justify-between" variant="brand-secondary">
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

function WatermarkImagePicker({
  onOpenChange,
  onSelect,
  open,
  selectedId,
}: {
  onOpenChange: (open: boolean) => void
  onSelect: (asset: WatermarkImageAsset) => void
  open: boolean
  selectedId: string | null
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Elegir archivo de la biblioteca</DialogTitle>
          <DialogDescription>
            Selecciona una imagen cuadrada o con fondo transparente para usarla
            como marca de agua.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {watermarkImageAssetsFixture.map((asset) => {
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
                  <Image
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    height={96}
                    src={asset.previewSrc}
                    width={96}
                  />
                </span>
                <span className="truncate px-2.5 py-2 text-sm font-medium">
                  {asset.name}
                </span>
              </button>
            )
          })}
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WatermarkPreview({ draft }: { draft: WatermarkDraft }) {
  const image = watermarkImageAssetsFixture.find(
    ({ id }) => id === draft.imageFileAssetId
  )
  return (
    <Card className="overflow-hidden" variant="surface">
      <CardHeader className="border-b">
        <CardTitle className="text-base">Vista previa</CardTitle>
        <CardDescription>
          Así se aplicará sobre el contenido al publicar.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-72 overflow-hidden rounded-lg border bg-linear-to-br from-muted via-secondary/70 to-muted">
          <div className="absolute inset-x-5 top-6 space-y-2">
            <div className="h-2 w-20 rounded-full bg-background/60" />
            <div className="h-2 w-32 rounded-full bg-background/40" />
          </div>
          <div className="absolute inset-x-5 bottom-7 rounded-lg bg-background/35 p-3 backdrop-blur-sm">
            <p className="text-xs font-medium">Contenido de ejemplo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              La marca se verá sobre imágenes y vídeos compatibles.
            </p>
          </div>
          <div
            className={`absolute max-w-[45%] ${positionClass[draft.position]}`}
            style={{ opacity: draft.opacityPercent / 100 }}
          >
            {draft.type === "image" && image ? (
              <Image
                alt="Marca de agua seleccionada"
                className="max-h-16 max-w-full object-contain"
                height={128}
                src={image.previewSrc}
                style={{ width: `${Math.max(30, draft.scalePercent * 2)}px` }}
                width={128}
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
  const [rules, setRules] = useState<WatermarkRule[]>(watermarksFixture)
  const [isGlobalScope, setIsGlobalScope] = useState(true)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canManage = true
  const [draft, setDraft] = useState<WatermarkDraft>(() =>
    draftFromRule(
      watermarksFixture.find((rule) => rule.socialAccountId === null) ?? null
    )
  )
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

  if (!canManage) {
    return (
      <Card>
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

  function updateDraft<Key extends keyof WatermarkDraft>(
    key: Key,
    value: WatermarkDraft[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function save() {
    if (!hasTarget) return

    const now = new Date().toISOString()
    setRules((current) => {
      const targetIds = new Set(targetAccountIds)
      const configuredTargetIds = new Set(
        current
          .filter((rule) => targetIds.has(rule.socialAccountId))
          .map((rule) => rule.socialAccountId)
      )
      const updatedRules = current.map((rule) =>
        targetIds.has(rule.socialAccountId)
          ? {
              ...rule,
              ...draft,
              socialAccountId: rule.socialAccountId,
              updatedAt: now,
            }
          : rule
      )
      const createdRules = targetAccountIds
        .filter((accountId) => !configuredTargetIds.has(accountId))
        .map((socialAccountId, index) => ({
          ...draft,
          id: `fixture-watermark-${Date.now()}-${index}`,
          socialAccountId,
          updatedAt: now,
        }))

      return [...updatedRules, ...createdRules]
    })
  }

  function remove() {
    if (!targetRules.length) return
    const targetRuleIds = new Set(targetRules.map(({ id }) => id))
    setRules((current) => current.filter(({ id }) => !targetRuleIds.has(id)))
    setDeleteOpen(false)
  }

  const selectedImage =
    watermarkImageAssetsFixture.find(
      ({ id }) => id === draft.imageFileAssetId
    ) ?? null

  return (
    <>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Marca de agua</CardTitle>
          <CardDescription className="max-w-xl leading-snug">
            Añade una marca visual que se aplicará al contenido antes de
            enviarlo a tus canales.
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:justify-end md:justify-self-end">
            {targetRules.length ? (
              <Button
                onClick={() => setDeleteOpen(true)}
                size="sm"
                variant="destructive"
              >
                <Trash2 /> Eliminar
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:p-6">
          <div className="space-y-6">
            <Field>
              <FieldLabel>Aplicar en</FieldLabel>
              <WatermarkScopePicker
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
                La regla global se aplica a todos los canales. Si seleccionas
                cuentas, la misma configuración se aplicará solo a ellas.
              </FieldDescription>
            </Field>
            <Tabs
              onValueChange={(value) =>
                updateDraft("type", value as WatermarkType)
              }
              value={draft.type}
            >
              <TabsList>
                <TabsTrigger value="image">
                  <ImageIcon /> Imagen
                </TabsTrigger>
                <TabsTrigger value="text">
                  <Type /> Texto
                </TabsTrigger>
              </TabsList>
              <TabsContent className="pt-4" value="image">
                <Field>
                  <FieldLabel>Archivo de la biblioteca</FieldLabel>
                  <button
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={() => setImagePickerOpen(true)}
                    type="button"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted p-2">
                      <Image
                        alt=""
                        className="max-h-full max-w-full object-contain"
                        height={48}
                        src={
                          selectedImage?.previewSrc ?? "/brand/zapi-logo.png"
                        }
                        width={48}
                      />
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
                    Texto de la marca
                  </FieldLabel>
                  <Textarea
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
                    updateDraft("opacityPercent", value ?? draft.opacityPercent)
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
                      updateDraft("textPreset", value as WatermarkTextPreset)
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
                        <SelectItem value="brand-gradient">Marca</SelectItem>
                        <SelectItem value="sunset-gradient">
                          Atardecer
                        </SelectItem>
                        <SelectItem value="ocean-gradient">Océano</SelectItem>
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
                      updateDraft("textWeight", value as WatermarkTextWeight)
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
            <div className="flex justify-end">
              <Button disabled={!hasTarget} onClick={save}>
                {targetRules.length ? (
                  "Guardar cambios"
                ) : (
                  <>
                    <Plus data-icon="inline-start" />
                    {isGlobalScope
                      ? "Crear marca de agua"
                      : "Aplicar a cuentas"}
                  </>
                )}
              </Button>
            </div>
          </div>
          <WatermarkPreview draft={draft} />
        </CardContent>
      </Card>
      <WatermarkImagePicker
        onOpenChange={setImagePickerOpen}
        onSelect={(asset) => updateDraft("imageFileAssetId", asset.id)}
        open={imagePickerOpen}
        selectedId={draft.imageFileAssetId}
      />
      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} variant="destructive">
              Eliminar marca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
