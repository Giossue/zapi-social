"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { type FormEvent, useEffect, useRef, useState } from "react"
import {
  BookOpenText,
  CalendarDays,
  CircleAlert,
  FileText,
  History,
  ImagePlus,
  ListChecks,
  NotebookText,
  Send,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@workspace/ui/components/field"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import {
  ApiError,
  captionsApi,
  filesApi,
  publishingApi,
} from "@workspace/api-client"
import type {
  GoogleDriveImportBatch,
  PortalGoogleDriveConfiguration,
  PortalCaption,
  PortalPublishingNote,
} from "@workspace/contracts"
import { PublishingAccountPicker } from "@/features/publishing/components/publishing-account-picker"
import { PublishingCalendar } from "@/features/publishing/components/publishing-calendar"
import { PublishingMediaPicker } from "@/features/publishing/components/publishing-media-picker"
import { openGoogleDrivePicker } from "@/features/files/components/google-drive-picker"
import { PublishingNetworkPreview } from "@/features/publishing/components/publishing-network-preview"
import { PublishingPostsTable } from "@/features/publishing/components/publishing-posts-table"
import { PublishingSchedulePicker } from "@/features/publishing/components/publishing-schedule-picker"
import type {
  PublishingAccount,
  PublishingCalendarData,
  PublishingMediaAsset,
  PublishingPost,
} from "@/features/publishing/types/publishing-calendar"
import { BulkPostsPage } from "@/features/bulk-posts/components/bulk-posts-page"

export type PublishingSection = "calendar" | "activity" | "bulk-posts"
type ComposerMode = "draft" | "now" | "schedule"
type ComposerTool = "captions" | "media" | "notes" | null

const defaultScheduleDate = "2026-08-03"
const defaultScheduleTime = "10:00"

const sectionRoutes: Record<PublishingSection, string> = {
  calendar: "/portal/publishing",
  activity: "/portal/publishing/activity",
  "bulk-posts": "/portal/publishing/bulk-posts",
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function toDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-")
}

function toTimeKey(value: Date) {
  return [
    String(value.getHours()).padStart(2, "0"),
    String(value.getMinutes()).padStart(2, "0"),
  ].join(":")
}

function nextQuarterHour(value: Date) {
  const next = new Date(value)
  next.setSeconds(0, 0)
  next.setMinutes(next.getMinutes() + (15 - (next.getMinutes() % 15)))
  return next
}

function ComposerActionIcon({ mode }: { mode: ComposerMode }) {
  if (mode === "draft") return <FileText data-icon="inline-start" />
  if (mode === "now") return <Send data-icon="inline-start" />
  return <CalendarDays data-icon="inline-start" />
}

function composerActionKey(mode: ComposerMode, pending: boolean) {
  if (pending) return `pending.${mode}` as const
  return `submit.${mode}` as const
}

function ComposerDialog({
  accounts,
  editingPost,
  initialScheduledDate,
  initialScheduledTime,
  onClose,
  onSave,
  onMediaImported,
  media,
  open,
}: {
  accounts: PublishingAccount[]
  editingPost: PublishingPost | null
  initialScheduledDate: string
  initialScheduledTime: string
  onClose: () => void
  onSave: (input: {
    content: string
    selectedAccounts: string[]
    mediaAssetIds: string[]
    mode: ComposerMode
    scheduledAt: string
  }) => Promise<void>
  onMediaImported: (asset: PublishingMediaAsset) => void
  media: PublishingMediaAsset[]
  open: boolean
}) {
  const t = useTranslations("publishing.composer")
  const [content, setContent] = useState(() => editingPost?.content ?? "")
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(() =>
    editingPost ? [editingPost.socialAccountId] : []
  )
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<
    string | null
  >(() => editingPost?.mediaAssetIds[0] ?? null)
  const [mode, setMode] = useState<ComposerMode>(() =>
    editingPost?.status === "draft" ? "draft" : "schedule"
  )
  const [scheduledDate, setScheduledDate] = useState(
    () => editingPost?.date ?? initialScheduledDate
  )
  const [scheduledTime, setScheduledTime] = useState(() =>
    editingPost?.time === "now"
      ? defaultScheduleTime
      : (editingPost?.time ?? initialScheduledTime)
  )
  const [activePreviewAccountId, setActivePreviewAccountId] = useState<
    string | null
  >(null)
  const [pending, setPending] = useState(false)
  const [availableMedia, setAvailableMedia] = useState(media)
  const [driveProvider, setDriveProvider] =
    useState<PortalGoogleDriveConfiguration | null>(null)
  const [driveBatch, setDriveBatch] = useState<GoogleDriveImportBatch | null>(
    null
  )
  const [openingDrive, setOpeningDrive] = useState(false)
  const [activeTool, setActiveTool] = useState<ComposerTool>(null)
  const [captions, setCaptions] = useState<PortalCaption[]>([])
  const [captionsLoaded, setCaptionsLoaded] = useState(false)
  const [notes, setNotes] = useState<PortalPublishingNote[]>([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [toolLoading, setToolLoading] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const handledDriveBatch = useRef<string | null>(null)
  const hasMedia = selectedMediaAssetId !== null
  const selected = accounts.filter((account) =>
    selectedAccounts.includes(account.id)
  )
  const requiresMedia = selected.some(
    (account) => account.provider !== "facebook"
  )
  const canSubmit =
    selected.length > 0 &&
    selected.every((account) => account.connected) &&
    Boolean(content.trim()) &&
    (!requiresMedia || hasMedia) &&
    (mode !== "schedule" || Boolean(scheduledDate && scheduledTime)) &&
    !pending

  useEffect(() => {
    void filesApi
      .googleDriveProvider()
      .then(setDriveProvider)
      .catch(() =>
        setDriveProvider({
          enabled: false,
          oauthClientId: null,
          browserApiKey: null,
          appId: null,
          configurationFingerprint: null,
        })
      )
  }, [])

  useEffect(() => {
    if (activeTool === "captions" && !captionsLoaded) {
      setToolLoading(true)
      void captionsApi
        .list({ status: "active" })
        .then((response) => {
          setCaptions(response.captions)
          setCaptionsLoaded(true)
        })
        .catch(() => toast.error(t("toolLoadFailed")))
        .finally(() => setToolLoading(false))
    }
    if (activeTool === "notes" && !notesLoaded) {
      setToolLoading(true)
      void publishingApi
        .listNotes()
        .then((response) => {
          setNotes(response.notes)
          setNotesLoaded(true)
        })
        .catch(() => toast.error(t("toolLoadFailed")))
        .finally(() => setToolLoading(false))
    }
  }, [activeTool, captionsLoaded, notesLoaded, t])

  useEffect(() => {
    if (!driveBatch) return
    const terminal = ["completed", "partial", "failed", "expired"].includes(
      driveBatch.status
    )
    if (!terminal) {
      const timer = window.setTimeout(() => {
        void filesApi
          .googleDriveImport(driveBatch.id)
          .then(setDriveBatch)
          .catch(() => undefined)
      }, 1500)
      return () => window.clearTimeout(timer)
    }
    if (handledDriveBatch.current === driveBatch.id) return
    handledDriveBatch.current = driveBatch.id
    const fileAssetId = driveBatch.items.find(
      (item) => item.status === "completed"
    )?.fileAssetId
    if (!fileAssetId) {
      toast.error(t("driveImportFailed"))
      return
    }
    void publishingApi
      .list({ mediaLimit: 200 })
      .then((data) => {
        const asset = data.media.find((item) => item.id === fileAssetId)
        if (!asset) throw new Error("Imported asset not found")
        setAvailableMedia((current) => [
          asset,
          ...current.filter((item) => item.id !== asset.id),
        ])
        setSelectedMediaAssetId(asset.id)
        onMediaImported(asset)
        setDriveBatch(null)
        toast.success(t("driveImportSuccess"))
      })
      .catch(() => toast.error(t("driveSelectFailed")))
  }, [driveBatch, onMediaImported, t])

  async function importFromGoogleDrive() {
    setOpeningDrive(true)
    try {
      const currentProvider = await filesApi.googleDriveProvider()
      setDriveProvider(currentProvider)
      if (
        !currentProvider.enabled ||
        !currentProvider.oauthClientId ||
        !currentProvider.browserApiKey ||
        !currentProvider.appId
      ) {
        toast.error(t("driveUnavailable"))
        return
      }
      const picked = await openGoogleDrivePicker({
        configuration: {
          oauthClientId: currentProvider.oauthClientId,
          browserApiKey: currentProvider.browserApiKey,
          appId: currentProvider.appId,
        },
        diagnostics: {
          pagePath: window.location.pathname,
          serverFingerprint: currentProvider.configurationFingerprint,
          sourceContext: "publishing",
        },
        multiselect: false,
      })
      if (!picked) return
      handledDriveBatch.current = null
      setDriveBatch(
        await filesApi.createGoogleDriveImport({
          ...picked,
          destinationFolderId: null,
          idempotencyKey: crypto.randomUUID(),
          sourceContext: "publishing",
        })
      )
    } catch {
      toast.error(t("driveStartFailed"))
    } finally {
      setOpeningDrive(false)
    }
  }

  function toggleTool(tool: Exclude<ComposerTool, null>) {
    setActiveTool((current) => (current === tool ? null : tool))
  }

  function appendContent(value: string) {
    setContent((current) =>
      current.trim() ? `${current.trim()}\n\n${value}` : value
    )
  }

  async function saveNote() {
    const nextContent = noteDraft.trim()
    if (!nextContent || savingNote) return
    setSavingNote(true)
    try {
      const note = await publishingApi.createNote({ content: nextContent })
      setNotes((current) => [note, ...current])
      setNotesLoaded(true)
      setNoteDraft("")
      toast.success(t("noteSaved"))
    } catch {
      toast.error(t("noteSaveFailed"))
    } finally {
      setSavingNote(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setPending(true)
    try {
      await onSave({
        content,
        selectedAccounts,
        mediaAssetIds: selectedMediaAssetId ? [selectedMediaAssetId] : [],
        mode,
        scheduledAt: new Date(
          `${scheduledDate}T${scheduledTime}:00`
        ).toISOString(),
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet
      onOpenChange={(nextOpen) => !nextOpen && !pending && onClose()}
      open={open}
    >
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-none data-[side=right]:sm:w-full data-[side=right]:sm:border-l-0"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>
            {editingPost ? t("editTitle") : t("createTitle")}
          </SheetTitle>
          <SheetDescription>{t("composerDescription")}</SheetDescription>
        </SheetHeader>

        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <div
              className={cn(
                "mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]",
                activeTool === "notes" &&
                  "xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)_minmax(18rem,0.7fr)]"
              )}
            >
              <FieldGroup className="min-w-0">
                <FieldSet>
                  <FieldLabel asChild>
                    <legend>
                      {t("accounts")} <RequiredMark />
                    </legend>
                  </FieldLabel>
                  <PublishingAccountPicker
                    accounts={accounts}
                    ariaRequired
                    onChange={setSelectedAccounts}
                    selectedAccountIds={selectedAccounts}
                  />
                </FieldSet>

                <Field>
                  <FieldLabel htmlFor="publishing-content">
                    {t("content")} <RequiredMark />
                  </FieldLabel>
                  <Card variant="surface">
                    <CardContent className="flex flex-col gap-3 p-3">
                      <Textarea
                        aria-required="true"
                        className="min-h-56 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                        id="publishing-content"
                        onChange={(event) => setContent(event.target.value)}
                        placeholder={t("contentPlaceholder")}
                        value={content}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          aria-pressed={activeTool === "media"}
                          onClick={() => toggleTool("media")}
                          size="sm"
                          type="button"
                          variant="brand-secondary"
                        >
                          <ImagePlus data-icon="inline-start" />
                          {t("tool.media")}
                        </Button>
                        <Button
                          aria-pressed={activeTool === "captions"}
                          onClick={() => toggleTool("captions")}
                          size="sm"
                          type="button"
                          variant="brand-secondary"
                        >
                          <BookOpenText data-icon="inline-start" />
                          {t("tool.captions")}
                        </Button>
                        <Button
                          aria-pressed={activeTool === "notes"}
                          onClick={() => toggleTool("notes")}
                          size="sm"
                          type="button"
                          variant="brand-secondary"
                        >
                          <NotebookText data-icon="inline-start" />
                          {t("tool.notes")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Field>

                {activeTool === "media" ? (
                  <Field>
                    <FieldLabel>
                      {t("media")} {requiresMedia ? <RequiredMark /> : null}
                    </FieldLabel>
                    <PublishingMediaPicker
                      ariaRequired={requiresMedia}
                      assets={availableMedia ?? []}
                      driveEnabled={driveProvider?.enabled ?? false}
                      driveImportStatus={
                        driveBatch
                          ? driveBatch.status === "failed" ||
                            driveBatch.status === "expired" ||
                            driveBatch.status === "partial"
                            ? "failed"
                            : "processing"
                          : undefined
                      }
                      driveOpening={openingDrive}
                      onChange={setSelectedMediaAssetId}
                      onImportFromDrive={() => void importFromGoogleDrive()}
                      selectedAssetId={selectedMediaAssetId}
                    />
                  </Field>
                ) : null}

                {activeTool === "captions" ? (
                  <Card size="sm" variant="inset">
                    <CardHeader>
                      <CardTitle>{t("captionsTitle")}</CardTitle>
                      <CardDescription>
                        {t("captionsDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 p-3">
                      {toolLoading ? (
                        <PageLoading className="min-h-28" />
                      ) : captions.length ? (
                        captions.map((caption) => (
                          <Button
                            className="h-auto justify-start text-left whitespace-normal"
                            key={caption.id}
                            onClick={() => appendContent(caption.content)}
                            type="button"
                            variant="brand-secondary"
                          >
                            <span className="line-clamp-2">
                              {caption.content}
                            </span>
                          </Button>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t("captionsEmpty")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                <Field>
                  <FieldLabel>{t("when")}</FieldLabel>
                  <Tabs
                    aria-label={t("when")}
                    onValueChange={(value) => setMode(value as ComposerMode)}
                    value={mode}
                  >
                    <TabsList className="w-full justify-start sm:w-fit">
                      <TabsTrigger value="draft">{t("mode.draft")}</TabsTrigger>
                      <TabsTrigger value="now">{t("mode.now")}</TabsTrigger>
                      <TabsTrigger value="schedule">
                        {t("mode.schedule")}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </Field>

                {mode === "schedule" ? (
                  <PublishingSchedulePicker
                    date={scheduledDate}
                    isRequired
                    onDateChange={setScheduledDate}
                    onTimeChange={setScheduledTime}
                    time={scheduledTime}
                  />
                ) : null}
              </FieldGroup>

              <div className="min-w-0">
                <PublishingNetworkPreview
                  accounts={accounts}
                  activeAccountId={activePreviewAccountId}
                  content={content}
                  hasMedia={hasMedia}
                  onAccountChange={setActivePreviewAccountId}
                  selectedAccountIds={selectedAccounts}
                />
              </div>

              {activeTool === "notes" ? (
                <Card
                  className="min-w-0 xl:col-start-3 xl:row-start-1"
                  variant="surface"
                >
                  <CardHeader>
                    <CardTitle>{t("notesTitle")}</CardTitle>
                    <CardDescription>{t("notesDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 p-3">
                    <Textarea
                      aria-label={t("notePlaceholder")}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder={t("notePlaceholder")}
                      value={noteDraft}
                    />
                    <Button
                      disabled={!noteDraft.trim() || savingNote}
                      onClick={() => void saveNote()}
                      type="button"
                    >
                      {savingNote ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <NotebookText data-icon="inline-start" />
                      )}
                      {t("saveNote")}
                    </Button>
                    {toolLoading ? (
                      <PageLoading className="min-h-28" />
                    ) : notes.length ? (
                      <div className="flex flex-col gap-2">
                        {notes.map((note) => (
                          <Button
                            className="h-auto justify-start text-left whitespace-normal"
                            key={note.id}
                            onClick={() => appendContent(note.content)}
                            type="button"
                            variant="brand-secondary"
                          >
                            <span className="line-clamp-3">{note.content}</span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("notesEmpty")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>

          <SheetActions>
            <Button
              disabled={pending}
              onClick={onClose}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={!canSubmit} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ComposerActionIcon mode={mode} />
              )}
              {t(composerActionKey(mode, pending))}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function PublishingCalendarPage({
  calendar,
  initialSection = "calendar",
}: {
  calendar: PublishingCalendarData
  initialSection?: PublishingSection
}) {
  const t = useTranslations("publishing.page")
  const [posts, setPosts] = useState(calendar.posts)
  const [media, setMedia] = useState(calendar.media ?? [])
  const section = initialSection
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerScheduledDate, setComposerScheduledDate] =
    useState(defaultScheduleDate)
  const [composerScheduledTime, setComposerScheduledTime] =
    useState(defaultScheduleTime)
  const [editingPost, setEditingPost] = useState<PublishingPost | null>(null)
  const createIdempotencyKey = useRef<string | null>(null)
  if (!calendar.canView) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("noAccessDescription")}
            icon={CircleAlert}
            title={t("noAccessTitle")}
          />
        </CardContent>
      </Card>
    )
  }

  function openComposer(
    post: PublishingPost | null = null,
    scheduledDate = defaultScheduleDate,
    scheduledTime = defaultScheduleTime
  ) {
    createIdempotencyKey.current = post ? null : crypto.randomUUID()
    setEditingPost(post)
    setComposerScheduledDate(post?.date ?? scheduledDate)
    setComposerScheduledTime(
      post?.time === "now" ? defaultScheduleTime : (post?.time ?? scheduledTime)
    )
    setComposerOpen(true)
  }

  function openComposerAtDate(date: Date, allDay: boolean) {
    const now = new Date()
    const nextAvailable = nextQuarterHour(now)
    if (date.getTime() < nextAvailable.getTime()) {
      openComposer(null, toDateKey(nextAvailable), toTimeKey(nextAvailable))
      return
    }

    const scheduledTime = allDay ? defaultScheduleTime : toTimeKey(date)

    openComposer(null, toDateKey(date), scheduledTime)
  }

  async function savePost({
    content,
    selectedAccounts,
    mediaAssetIds,
    mode,
    scheduledAt,
  }: {
    content: string
    selectedAccounts: string[]
    mediaAssetIds: string[]
    mode: ComposerMode
    scheduledAt: string
  }) {
    try {
      if (editingPost) {
        const post = await publishingApi.update(editingPost.id, {
          content,
          mediaAssetIds,
          mode,
          scheduledAt: mode === "schedule" ? scheduledAt : null,
        })
        setPosts((current) =>
          current.map((item) => (item.id === post.id ? post : item))
        )
        toast.success(t("saved"))
      } else {
        createIdempotencyKey.current ??= crypto.randomUUID()
        const nextPosts = await publishingApi.create({
          accountIds: selectedAccounts,
          content,
          idempotencyKey: createIdempotencyKey.current,
          mediaAssetIds,
          mode,
          ...(mode === "schedule" ? { scheduledAt } : {}),
        })
        setPosts((current) => [...nextPosts, ...current])
        toast.success(
          mode === "now"
            ? t("publishStarted", { count: nextPosts.length })
            : mode === "draft"
              ? t("draftSaved")
              : t("scheduled", { count: nextPosts.length })
        )
      }
      createIdempotencyKey.current = null
      setComposerOpen(false)
      setEditingPost(null)
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === "VALIDATION_FAILED"
          ? t("validationFailed")
          : t("saveFailed")
      )
    }
  }

  async function retryPost(post: PublishingPost) {
    try {
      const updated = await publishingApi.retry(post.id)
      setPosts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
      toast.success(t("retryQueued"))
    } catch {
      toast.error(t("retryFailed"))
    }
  }

  async function deletePost(post: PublishingPost) {
    try {
      await publishingApi.remove(post.id)
      setPosts((current) => current.filter((item) => item.id !== post.id))
      toast.success(t("draftDeleted"))
      return true
    } catch {
      toast.error(t("draftDeleteFailed"))
      return false
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        section === "calendar" &&
          "h-[calc(100svh-5rem)] min-h-[40rem] md:h-[calc(100svh-7rem)]"
      )}
    >
      <CollectionHeader
        description={t("pageDescription")}
        title={t("pageTitle")}
      />

      {section === "calendar" ? (
        <nav aria-label={t("sectionsLabel")} className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="brand-secondary">
            <Link href={sectionRoutes.activity}>
              <History data-icon="inline-start" />
              {t("section.activity")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="brand-secondary">
            <Link href={sectionRoutes["bulk-posts"]}>
              <ListChecks data-icon="inline-start" />
              {t("section.bulkPosts")}
            </Link>
          </Button>
        </nav>
      ) : null}

      {section === "calendar" ? (
        <section
          aria-label={t("calendarLabel")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <PublishingCalendar
            accounts={calendar.accounts}
            initialDate={calendar.focusDate}
            onCreateAtDate={openComposerAtDate}
            onEditPost={openComposer}
            posts={posts}
          />
        </section>
      ) : null}

      {section === "activity" ? (
        <section
          aria-label={t("activityLabel")}
          className="flex flex-col gap-4"
        >
          <PublishingPostsTable
            onContinue={openComposer}
            onDelete={deletePost}
            onRetry={retryPost}
            posts={posts}
          />
        </section>
      ) : null}

      {section === "bulk-posts" ? <BulkPostsPage embedded /> : null}

      {composerOpen ? (
        <ComposerDialog
          accounts={calendar.accounts}
          editingPost={editingPost}
          initialScheduledDate={composerScheduledDate}
          initialScheduledTime={composerScheduledTime}
          onClose={() => {
            createIdempotencyKey.current = null
            setComposerOpen(false)
            setEditingPost(null)
          }}
          onSave={savePost}
          media={media}
          onMediaImported={(asset) =>
            setMedia((current) => [
              asset,
              ...current.filter((item) => item.id !== asset.id),
            ])
          }
          open={composerOpen}
        />
      ) : null}
    </div>
  )
}
