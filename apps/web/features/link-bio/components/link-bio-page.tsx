"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  ExternalLink,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { ApiError, linkBioApi } from "@workspace/api-client"
import type {
  LinkBioBlock,
  LinkBioBlockType,
  PortalLinkBioPage,
  PortalLinkBioPagesResponse,
  UpsertPortalLinkBioPageInput,
} from "@workspace/contracts"
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
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"

import {
  blockTypes,
  emptyBlock,
  emptyItem,
  itemBlockTypes,
} from "./link-bio-blocks"
import { LinkBioRenderer } from "./link-bio-renderer"
import { linkBioTemplates } from "../link-bio-templates"
import { loginPath } from "@/features/identity/login-redirect"

const pageSize = 10

type Draft = UpsertPortalLinkBioPageInput

const emptyDraft: Draft = {
  appearance: {
    accent: "primary",
    avatarStyle: "circle",
    backgroundFit: "cover",
    backgroundOverlay: 28,
    backgroundPosition: "center",
    brandingText: "",
    buttonStyle: "rounded",
    contentAlign: "center",
  },
  avatarFileAssetId: null,
  blocks: [emptyBlock("links")],
  coverFileAssetId: null,
  description: "",
  headline: "",
  status: "draft",
  templateKey: "aurora",
  title: "",
}

function draftFrom(page: PortalLinkBioPage): Draft {
  return {
    appearance: page.appearance,
    avatarFileAssetId: page.avatarFileAssetId,
    blocks: page.blocks,
    coverFileAssetId: page.coverFileAssetId,
    description: page.description,
    headline: page.headline,
    slug: page.slug,
    status: page.status,
    templateKey: page.templateKey,
    title: page.title,
  }
}

function BlockEditor({
  block,
  index,
  onChange,
  onMove,
  onRemove,
  total,
}: {
  block: LinkBioBlock
  index: number
  onChange: (next: LinkBioBlock) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  total: number
}) {
  const t = useTranslations("linkBio")
  const hasItems = itemBlockTypes.includes(block.type)

  return (
    <Card variant="inset">
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">
              {t(`block.${block.type}.label`)}
            </span>
            <span className="text-sm text-muted-foreground">
              {t(`block.${block.type}.hint`)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Switch
              aria-label={t("showBlock", {
                block: t(`block.${block.type}.label`),
              })}
              checked={block.enabled}
              onCheckedChange={(enabled) => onChange({ ...block, enabled })}
            />
            <Button
              aria-label={t("moveUp")}
              disabled={index === 0}
              onClick={() => onMove(-1)}
              size="icon-sm"
              type="button"
              variant="brand-secondary"
            >
              <ArrowUp />
            </Button>
            <Button
              aria-label={t("moveDown")}
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              size="icon-sm"
              type="button"
              variant="brand-secondary"
            >
              <ArrowDown />
            </Button>
            <Button
              aria-label={t("removeBlock")}
              onClick={onRemove}
              size="icon-sm"
              type="button"
              variant="destructive"
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`block-${index}-title`}>
              {t("title")}
            </FieldLabel>
            <Input
              id={`block-${index}-title`}
              onChange={(event) =>
                onChange({ ...block, title: event.target.value })
              }
              value={block.title}
            />
          </Field>
          {block.type === "header" || block.type === "embed" ? (
            <Field>
              <FieldLabel htmlFor={`block-${index}-content`}>
                {block.type === "embed" ? t("codeOrUrl") : t("text")}
              </FieldLabel>
              <Textarea
                id={`block-${index}-content`}
                onChange={(event) =>
                  onChange({ ...block, content: event.target.value })
                }
                rows={3}
                value={block.content}
              />
            </Field>
          ) : null}
          {block.type === "video" ? (
            <Field>
              <FieldLabel htmlFor={`block-${index}-url`}>
                {t("videoUrl")}
              </FieldLabel>
              <Input
                id={`block-${index}-url`}
                onChange={(event) =>
                  onChange({ ...block, url: event.target.value })
                }
                placeholder="https://youtube.com/watch?v=…"
                value={block.url}
              />
            </Field>
          ) : null}
        </FieldGroup>

        {hasItems ? (
          <div className="flex flex-col gap-3">
            <Separator />
            {block.items.map((item, itemIndex) => (
              <div
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                key={itemIndex}
              >
                <Input
                  aria-label={t("label")}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      items: block.items.map((current, position) =>
                        position === itemIndex
                          ? { ...current, label: event.target.value }
                          : current
                      ),
                    })
                  }
                  placeholder={
                    block.type === "faq" ? t("question") : t("label")
                  }
                  value={item.label}
                />
                <Input
                  aria-label={
                    block.type === "faq" ? t("answer") : t("destination")
                  }
                  onChange={(event) =>
                    onChange({
                      ...block,
                      items: block.items.map((current, position) =>
                        position === itemIndex
                          ? block.type === "faq"
                            ? { ...current, answer: event.target.value }
                            : { ...current, url: event.target.value }
                          : current
                      ),
                    })
                  }
                  placeholder={block.type === "faq" ? t("answer") : "https://…"}
                  value={block.type === "faq" ? item.answer : item.url}
                />
                <Button
                  aria-label={t("removeItem")}
                  onClick={() =>
                    onChange({
                      ...block,
                      items: block.items.filter(
                        (_, position) => position !== itemIndex
                      ),
                    })
                  }
                  size="icon-sm"
                  type="button"
                  variant="brand-secondary"
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              className="w-fit"
              onClick={() =>
                onChange({ ...block, items: [...block.items, emptyItem()] })
              }
              size="sm"
              type="button"
              variant="brand-secondary"
            >
              {t("addItem")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LinkBioPreview({ draft }: { draft: Draft }) {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-border shadow-sm">
      <LinkBioRenderer
        page={{
          appearance: draft.appearance,
          avatarUrl: null,
          blocks: draft.blocks,
          coverUrl: null,
          description: draft.description,
          headline: draft.headline,
          templateKey: draft.templateKey,
          title: draft.title,
        }}
        placeholders
      />
    </div>
  )
}

function PageSheet({
  onOpenChange,
  onSubmit,
  open,
  page,
  pending,
}: {
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: Draft) => Promise<boolean>
  open: boolean
  page: PortalLinkBioPage | null
  pending: boolean
}) {
  const t = useTranslations("linkBio")
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(page ? draftFrom(page) : emptyDraft)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.title.trim()) {
      toast.error(t("titleRequired"))
      return
    }
    if (await onSubmit(draft)) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-none data-[side=right]:sm:w-full data-[side=right]:sm:border-l-0"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{page ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>{t("sheetDescription")}</SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
            <Tabs
              className="flex min-h-0 flex-col gap-0 border-r border-border"
              defaultValue="info"
            >
              <TabsList className="m-4 mb-0 grid w-auto grid-cols-3 max-lg:grid-cols-4 lg:grid-cols-3">
                <TabsTrigger value="info">{t("tab.info")}</TabsTrigger>
                <TabsTrigger value="blocks">{t("tab.blocks")}</TabsTrigger>
                <TabsTrigger value="style">{t("tab.style")}</TabsTrigger>
                <TabsTrigger className="lg:hidden" value="preview">
                  {t("preview.title")}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                className="min-h-0 flex-1 overflow-y-auto p-4"
                value="blocks"
              >
                <div className="flex flex-col gap-4">
                  {draft.blocks.map((block, index) => (
                    <BlockEditor
                      block={block}
                      index={index}
                      key={index}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          blocks: draft.blocks.map((current, position) =>
                            position === index ? next : current
                          ),
                        })
                      }
                      onMove={(direction) => {
                        const target = index + direction
                        if (target < 0 || target >= draft.blocks.length) return
                        const blocks = [...draft.blocks]
                        const [moved] = blocks.splice(index, 1)
                        blocks.splice(target, 0, moved!)
                        setDraft({ ...draft, blocks })
                      }}
                      onRemove={() =>
                        setDraft({
                          ...draft,
                          blocks: draft.blocks.filter(
                            (_, position) => position !== index
                          ),
                        })
                      }
                      total={draft.blocks.length}
                    />
                  ))}
                  <Select
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        blocks: [
                          ...draft.blocks,
                          emptyBlock(
                            value as LinkBioBlockType,
                            t(`block.${value as LinkBioBlockType}.label`)
                          ),
                        ],
                      })
                    }
                    value=""
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("addBlock")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {blockTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`block.${type}.label`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent
                className="min-h-0 flex-1 overflow-y-auto p-4"
                value="info"
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="page-title">
                      Título{" "}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                      <span className="sr-only"> {t("required")}</span>
                    </FieldLabel>
                    <Input
                      aria-required="true"
                      id="page-title"
                      onChange={(event) =>
                        setDraft({ ...draft, title: event.target.value })
                      }
                      value={draft.title}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="page-slug">{t("slug")}</FieldLabel>
                    <Input
                      id="page-slug"
                      onChange={(event) =>
                        setDraft({ ...draft, slug: event.target.value })
                      }
                      placeholder={t("slugPlaceholder")}
                      value={draft.slug ?? ""}
                    />
                    <FieldDescription>{t("slugHint")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="page-headline">
                      {t("headline")}
                    </FieldLabel>
                    <Input
                      id="page-headline"
                      onChange={(event) =>
                        setDraft({ ...draft, headline: event.target.value })
                      }
                      value={draft.headline}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="page-description">
                      {t("descriptionField")}
                    </FieldLabel>
                    <Textarea
                      id="page-description"
                      onChange={(event) =>
                        setDraft({ ...draft, description: event.target.value })
                      }
                      rows={3}
                      value={draft.description}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="page-align">{t("align")}</FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          appearance: {
                            ...draft.appearance,
                            contentAlign: value as "left" | "center",
                          },
                        })
                      }
                      value={draft.appearance.contentAlign}
                    >
                      <SelectTrigger className="w-full" id="page-align">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="center">
                            {t("alignCenter")}
                          </SelectItem>
                          <SelectItem value="left">{t("alignLeft")}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field orientation="horizontal">
                    <Switch
                      checked={draft.status === "published"}
                      id="page-published"
                      onCheckedChange={(checked) =>
                        setDraft({
                          ...draft,
                          status: checked ? "published" : "draft",
                        })
                      }
                    />
                    <FieldLabel htmlFor="page-published">
                      <FieldContent>
                        <FieldTitle>{t("published")}</FieldTitle>
                        <FieldDescription>
                          {t("publishedHint")}
                        </FieldDescription>
                      </FieldContent>
                    </FieldLabel>
                  </Field>
                </FieldGroup>
              </TabsContent>

              <TabsContent
                className="min-h-0 flex-1 overflow-y-auto p-4"
                value="style"
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel>{t("templateLabel")}</FieldLabel>
                    <div
                      aria-label={t("templateAria")}
                      className="grid grid-cols-3 gap-2"
                      role="radiogroup"
                    >
                      {linkBioTemplates.map((template) => {
                        const selected = template.key === draft.templateKey

                        return (
                          <button
                            aria-checked={selected}
                            className={cn(
                              "flex flex-col gap-1.5 rounded-lg border border-border p-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                              selected && "border-primary ring-1 ring-primary"
                            )}
                            key={template.key}
                            onClick={() =>
                              setDraft({ ...draft, templateKey: template.key })
                            }
                            role="radio"
                            type="button"
                          >
                            <span
                              aria-hidden="true"
                              className="flex h-14 w-full items-end rounded-md border border-border p-1.5"
                              style={{
                                background: template.theme["--bio-bg"],
                              }}
                            >
                              <span
                                className="block h-2.5 w-3/4 rounded-sm border"
                                style={{
                                  background: template.theme["--bio-card"],
                                  borderColor: template.theme["--bio-border"],
                                }}
                              />
                            </span>
                            <span className="truncate text-xs font-medium">
                              {t(`template.${template.key}.label`)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <FieldDescription>
                      {t(`template.${draft.templateKey}.description`)}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="page-buttons">
                      {t("buttons")}
                    </FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          appearance: {
                            ...draft.appearance,
                            buttonStyle: value as "rounded" | "pill" | "square",
                          },
                        })
                      }
                      value={draft.appearance.buttonStyle}
                    >
                      <SelectTrigger className="w-full" id="page-buttons">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="rounded">
                            {t("buttonStyle.rounded")}
                          </SelectItem>
                          <SelectItem value="pill">
                            {t("buttonStyle.pill")}
                          </SelectItem>
                          <SelectItem value="square">
                            {t("buttonStyle.square")}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="page-avatar-style">
                      {t("avatar")}
                    </FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          appearance: {
                            ...draft.appearance,
                            avatarStyle: value as
                              "circle" | "rounded" | "square",
                          },
                        })
                      }
                      value={draft.appearance.avatarStyle}
                    >
                      <SelectTrigger className="w-full" id="page-avatar-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="circle">
                            {t("avatarStyle.circle")}
                          </SelectItem>
                          <SelectItem value="rounded">
                            {t("avatarStyle.rounded")}
                          </SelectItem>
                          <SelectItem value="square">
                            {t("avatarStyle.square")}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="page-branding">
                      {t("brandingText")}
                    </FieldLabel>
                    <Input
                      id="page-branding"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          appearance: {
                            ...draft.appearance,
                            brandingText: event.target.value,
                          },
                        })
                      }
                      placeholder={t("brandingPlaceholder")}
                      value={draft.appearance.brandingText}
                    />
                    <FieldDescription>
                      Aparece al pie de la página pública; déjalo vacío para
                      ocultarlo.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </TabsContent>

              <TabsContent
                className="min-h-0 flex-1 overflow-y-auto bg-muted p-4 lg:hidden"
                value="preview"
              >
                <LinkBioPreview draft={draft} />
              </TabsContent>
            </Tabs>

            <div className="hidden min-h-0 flex-col bg-muted lg:flex">
              <div className="border-b border-border bg-background px-4 py-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("preview.title")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("previewHint")}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <LinkBioPreview draft={draft} />
              </div>
            </div>
          </div>
          <SheetActions>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={pending || !draft.title.trim()} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              {t("savePage")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function LinkBioPage() {
  const t = useTranslations("linkBio")
  const router = useRouter()
  const [data, setData] = useState<PortalLinkBioPagesResponse | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    PortalLinkBioPage["status"] | "all"
  >("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PortalLinkBioPage | null>(null)
  const [toDelete, setToDelete] = useState<PortalLinkBioPage | null>(null)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return true
      }
      return false
    },
    [router]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(await linkBioApi.list())
      setForbidden(false)
    } catch (error) {
      if (handleError(error)) return
      console.error("Link bio request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  async function save(draft: Draft) {
    setPending(true)
    try {
      if (editing) await linkBioApi.update(editing.id, draft)
      else await linkBioApi.create(draft)
      await load()
      toast.success(editing ? t("updated") : t("created"))
      return true
    } catch (error) {
      if (handleError(error)) return false
      if (error instanceof ApiError && error.code === "LINK_BIO_SLUG_TAKEN") {
        toast.error(t("slugTaken"))
        return false
      }
      console.error("Link bio save failed", error)
      toast.error(t("saveFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  async function remove(page: PortalLinkBioPage) {
    setPending(true)
    try {
      await linkBioApi.remove(page.id)
      setToDelete(null)
      await load()
      toast.success(t("deleted"))
    } catch (error) {
      if (handleError(error)) return
      console.error("Link bio deletion failed", error)
      toast.error(t("deleteFailed"))
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={LockKeyhole}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !data && !loadError) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError || !data) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void load()}
                variant="brand-secondary"
              />
            }
            description={t("loadFailedDescription")}
            icon={CircleAlert}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredPages = data.pages.filter((page) => {
    const matchesQuery =
      !normalizedQuery ||
      page.title.toLowerCase().includes(normalizedQuery) ||
      page.slug.toLowerCase().includes(normalizedQuery)
    const matchesStatus = statusFilter === "all" || page.status === statusFilter
    return matchesQuery && matchesStatus
  })
  const hasFilters = Boolean(query || statusFilter !== "all")
  const pageCount = Math.max(1, Math.ceil(filteredPages.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)
  const visiblePages = filteredPages.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )
  const rangeStart = filteredPages.length ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = filteredPages.length
    ? rangeStart + visiblePages.length - 1
    : 0

  function clearFilters() {
    setQuery("")
    setStatusFilter("all")
    setCurrentPage(1)
  }

  function openCreate() {
    setEditing(null)
    setIsSheetOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <Card variant="subtle">
          <DataTableHeader
            action={
              data.canManage ? (
                <Button
                  className="hidden sm:inline-flex"
                  onClick={openCreate}
                  size="sm"
                  type="button"
                >
                  <Plus data-icon="inline-start" /> {t("create")}
                </Button>
              ) : undefined
            }
            search={{
              ariaLabel: t("searchLabel"),
              onChange: (value) => {
                setQuery(value)
                setCurrentPage(1)
              },
              placeholder: t("searchPlaceholder"),
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar
              actions={
                statusFilter !== "all" ? (
                  <Button
                    onClick={clearFilters}
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
                ariaLabel={t("filterStatus")}
                label={t("status")}
                onValueChange={(value) => {
                  setStatusFilter(value as PortalLinkBioPage["status"] | "all")
                  setCurrentPage(1)
                }}
                options={[
                  { label: t("all"), value: "all" },
                  { label: t("statusLabel.published"), value: "published" },
                  { label: t("statusLabel.draft"), value: "draft" },
                ]}
                value={statusFilter}
              />
            </DataTableToolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("page")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("performance")}
                  </TableHead>
                  <TableHead>{t("status")}</TableHead>
                  {data.canManage ? (
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePages.length ? (
                  visiblePages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell>
                        <div className="flex min-w-48 flex-col">
                          <span className="font-medium">{page.title}</span>
                          <span className="text-sm text-muted-foreground">
                            /b/{page.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col">
                          <span>
                            {t("viewsAndClicks", {
                              views: page.views,
                              clicks: page.clicks,
                            })}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {page.views
                              ? t("conversionRate", {
                                  rate: (
                                    (page.clicks / page.views) *
                                    100
                                  ).toFixed(1),
                                })
                              : t("noViews")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            page.status === "published" ? "success" : "neutral"
                          }
                        >
                          {page.status === "published"
                            ? t("statusLabel.published")
                            : t("statusLabel.draft")}
                        </Badge>
                      </TableCell>
                      {data.canManage ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={t("openActions", {
                                  name: page.title,
                                })}
                                className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                size="icon-sm"
                                variant="brand-secondary"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" size="compact">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(page)
                                  setIsSheetOpen(true)
                                }}
                                size="compact"
                              >
                                <Pencil />
                                {t("edit")}
                              </DropdownMenuItem>
                              {page.status === "published" ? (
                                <DropdownMenuItem asChild size="compact">
                                  <a
                                    href={`/b/${page.slug}`}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <ExternalLink />
                                    {t("viewPublished")}
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => setToDelete(page)}
                                size="compact"
                                variant="destructive"
                              >
                                <Trash2 />
                                {t("delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    action={
                      hasFilters ? (
                        <Button onClick={clearFilters} variant="outline">
                          {t("clearFilters")}
                        </Button>
                      ) : null
                    }
                    colSpan={data.canManage ? 4 : 3}
                    description={
                      hasFilters
                        ? t("emptyFilteredDescription")
                        : t("emptyDescription")
                    }
                    title={hasFilters ? t("noMatches") : t("emptyTitle")}
                  />
                )}
              </TableBody>
            </Table>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel={t("itemLabel")}
              onNextPage={() =>
                setCurrentPage((current) => Math.min(current + 1, pageCount))
              }
              onPreviousPage={() =>
                setCurrentPage((current) => Math.max(current - 1, 1))
              }
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={filteredPages.length}
            />
          </CardContent>
        </Card>
        {data.canManage ? (
          <FloatingActionButton label={t("createTitle")} onClick={openCreate} />
        ) : null}
      </div>

      <PageSheet
        onOpenChange={setIsSheetOpen}
        onSubmit={save}
        open={isSheetOpen}
        page={editing}
        pending={pending}
      />

      <AlertDialog
        onOpenChange={(open) => !open && setToDelete(null)}
        open={Boolean(toDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", { title: toDelete?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                if (toDelete) void remove(toDelete)
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
