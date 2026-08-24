"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarClock,
  CalendarDays,
  CircleAlert,
  FileText,
  ImagePlus,
  LoaderCircle,
  Send,
  XCircle,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
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
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
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
import { ApiError, filesApi, publishingApi } from "@workspace/api-client"
import type {
  GoogleDriveImportBatch,
  PortalGoogleDriveConfiguration,
} from "@workspace/contracts"
import { PublishingAccountPicker } from "@/features/publishing/components/publishing-account-picker"
import { PublishingCalendar } from "@/features/publishing/components/publishing-calendar"
import { PublishingMediaPicker } from "@/features/publishing/components/publishing-media-picker"
import { openGoogleDrivePicker } from "@/features/files/components/google-drive-picker"
import { PublishingNetworkPreview } from "@/features/publishing/components/publishing-network-preview"
import {
  PublishingMetrics,
  PublishingPostsTable,
} from "@/features/publishing/components/publishing-posts-table"
import { PublishingSchedulePicker } from "@/features/publishing/components/publishing-schedule-picker"
import type {
  PublishingAccount,
  PublishingCalendarData,
  PublishingMediaAsset,
  PublishingPost,
} from "@/features/publishing/types/publishing-calendar"

type PublishingSection = "calendar" | "queue" | "drafts"
type ComposerMode = "draft" | "now" | "schedule"

const defaultScheduleDate = "2026-08-03"

const sectionLinks: Array<{ href: string; value: PublishingSection }> = [
  { href: "/portal/publishing/calendar", value: "calendar" },
  { href: "/portal/publishing/queue", value: "queue" },
  { href: "/portal/publishing/drafts", value: "drafts" },
]

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
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
  onClose,
  onSave,
  onMediaImported,
  media,
  open,
}: {
  accounts: PublishingAccount[]
  editingPost: PublishingPost | null
  initialScheduledDate: string
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
    editingPost?.time === "now" ? "10:00" : (editingPost?.time ?? "10:00")
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
            <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
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
                  <Textarea
                    aria-required="true"
                    id="publishing-content"
                    onChange={(event) => setContent(event.target.value)}
                    placeholder={t("contentPlaceholder")}
                    value={content}
                  />
                </Field>

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
  const router = useRouter()
  const [posts, setPosts] = useState(calendar.posts)
  const [media, setMedia] = useState(calendar.media ?? [])
  const [section, setSection] = useState<PublishingSection>(initialSection)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerScheduledDate, setComposerScheduledDate] =
    useState(defaultScheduleDate)
  const [editingPost, setEditingPost] = useState<PublishingPost | null>(null)
  const createIdempotencyKey = useRef<string | null>(null)
  const queuePosts = useMemo(
    () => posts.filter((post) => post.status !== "draft"),
    [posts]
  )
  const drafts = useMemo(
    () => posts.filter((post) => post.status === "draft"),
    [posts]
  )

  useEffect(() => {
    for (const link of sectionLinks) router.prefetch(link.href)
  }, [router])

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
    scheduledDate = defaultScheduleDate
  ) {
    createIdempotencyKey.current = post ? null : crypto.randomUUID()
    setEditingPost(post)
    setComposerScheduledDate(post?.date ?? scheduledDate)
    setComposerOpen(true)
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

      <nav aria-label={t("sectionsLabel")}>
        <Tabs
          onValueChange={(value) => {
            const nextSection = value as PublishingSection
            const nextLink = sectionLinks.find(
              (item) => item.value === nextSection
            )
            if (!nextLink) return

            setSection(nextSection)
            router.push(nextLink.href)
          }}
          value={section}
        >
          <TabsList>
            {sectionLinks.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {t(`section.${item.value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </nav>

      {section === "calendar" ? (
        <section aria-label={t("calendarLabel")} className="min-h-0 flex-1">
          <PublishingCalendar
            initialDate={calendar.focusDate}
            onCreateAtDate={(date) => openComposer(null, date)}
            onEditPost={openComposer}
            posts={posts}
          />
        </section>
      ) : null}

      {section === "queue" ? (
        <section aria-label={t("queueLabel")} className="flex flex-col gap-4">
          <PublishingMetrics
            items={[
              {
                description: t("metrics.scheduledDescription"),
                icon: CalendarClock,
                label: t("metrics.scheduled"),
                value: queuePosts.filter((post) => post.status === "scheduled")
                  .length,
              },
              {
                description: t("metrics.processingDescription"),
                icon: LoaderCircle,
                label: t("metrics.processing"),
                value: queuePosts.filter((post) => post.status === "processing")
                  .length,
              },
              {
                description: t("metrics.failedDescription"),
                icon: XCircle,
                label: t("metrics.failed"),
                value: queuePosts.filter((post) => post.status === "failed")
                  .length,
              },
            ]}
          />
          <PublishingPostsTable
            mode="queue"
            onCreate={() => openComposer()}
            onRetry={retryPost}
            posts={queuePosts}
          />
        </section>
      ) : null}

      {section === "drafts" ? (
        <section aria-label={t("draftsLabel")} className="flex flex-col gap-4">
          <PublishingMetrics
            items={[
              {
                description: t("metrics.draftsDescription"),
                icon: FileText,
                label: t("metrics.drafts"),
                value: drafts.length,
              },
              {
                description: t("metrics.withMediaDescription"),
                icon: ImagePlus,
                label: t("metrics.withMedia"),
                value: drafts.filter((post) => post.hasMedia).length,
              },
              {
                description: t("metrics.readyDescription"),
                icon: Send,
                label: t("metrics.ready"),
                value: drafts.filter((post) => post.content.trim().length > 0)
                  .length,
              },
            ]}
          />
          <PublishingPostsTable
            mode="drafts"
            onContinue={openComposer}
            onCreate={() => openComposer()}
            onDelete={deletePost}
            posts={drafts}
          />
        </section>
      ) : null}

      {section !== "calendar" ? (
        <FloatingActionButton
          icon={<CalendarDays aria-hidden="true" className="size-6" />}
          label={t("createTitle")}
          onClick={() => openComposer()}
        />
      ) : null}

      {composerOpen ? (
        <ComposerDialog
          accounts={calendar.accounts}
          editingPost={editingPost}
          initialScheduledDate={composerScheduledDate}
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
