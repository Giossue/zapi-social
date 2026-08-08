"use client"

import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
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
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@workspace/ui/components/field"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { ApiError, publishingApi } from "@workspace/api-client"
import { PublishingAccountPicker } from "@/features/publishing/components/publishing-account-picker"
import { PublishingCalendar } from "@/features/publishing/components/publishing-calendar"
import { PublishingMediaPicker } from "@/features/publishing/components/publishing-media-picker"
import { PublishingNetworkPreview } from "@/features/publishing/components/publishing-network-preview"
import {
  PublishingMetrics,
  PublishingPostsTable,
} from "@/features/publishing/components/publishing-posts-table"
import { PublishingSchedulePicker } from "@/features/publishing/components/publishing-schedule-picker"
import type {
  PublishingAccount,
  PublishingCalendarData,
  PublishingPost,
} from "@/features/publishing/types/publishing-calendar"

type PublishingSection = "calendar" | "queue" | "drafts"
type ComposerMode = "draft" | "now" | "schedule"

const defaultScheduleDate = "2026-08-03"

const sectionLinks: Array<{
  href: string
  label: string
  value: PublishingSection
}> = [
  {
    href: "/portal/publishing/calendar",
    label: "Calendario",
    value: "calendar",
  },
  { href: "/portal/publishing/queue", label: "Cola", value: "queue" },
  { href: "/portal/publishing/drafts", label: "Borradores", value: "drafts" },
]

function ComposerDialog({
  accounts,
  editingPost,
  initialScheduledDate,
  onClose,
  onSave,
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
  media: PublishingCalendarData["media"]
  open: boolean
}) {
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
    editingPost?.time === "Ahora" ? "10:00" : (editingPost?.time ?? "10:00")
  )
  const [activePreviewAccountId, setActivePreviewAccountId] = useState<
    string | null
  >(null)
  const hasMedia = selectedMediaAssetId !== null
  const selected = accounts.filter((account) =>
    selectedAccounts.includes(account.id)
  )
  const canSubmit =
    selected.length > 0 &&
    selected.every((account) => account.connected) &&
    Boolean(content.trim()) &&
    selected.every((account) => account.provider === "facebook" || hasMedia) &&
    (mode !== "schedule" || Boolean(scheduledDate && scheduledTime))

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:w-[min(90vw,80rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>
            {editingPost ? "Editar publicación" : "Nueva publicación"}
          </DialogTitle>
          <DialogDescription>
            Valida cada destino antes de guardar, programar o publicar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
          <FieldGroup className="min-w-0">
            <FieldSet>
              <FieldLabel asChild>
                <legend>Cuentas destino</legend>
              </FieldLabel>
              <PublishingAccountPicker
                accounts={accounts}
                onChange={setSelectedAccounts}
                selectedAccountIds={selectedAccounts}
              />
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="publishing-content">Texto</FieldLabel>
              <Textarea
                id="publishing-content"
                onChange={(event) => setContent(event.target.value)}
                placeholder="Escribe el contenido de tu publicación"
                value={content}
              />
            </Field>

            <Field>
              <FieldLabel>Media</FieldLabel>
              <PublishingMediaPicker
                assets={media ?? []}
                onChange={setSelectedMediaAssetId}
                selectedAssetId={selectedMediaAssetId}
              />
            </Field>

            <Field>
              <FieldLabel>Cuándo publicar</FieldLabel>
              <Tabs
                aria-label="Cuándo publicar"
                onValueChange={(value) => setMode(value as ComposerMode)}
                value={mode}
              >
                <TabsList className="w-full justify-start sm:w-fit">
                  <TabsTrigger value="draft">Borrador</TabsTrigger>
                  <TabsTrigger value="now">Ahora</TabsTrigger>
                  <TabsTrigger value="schedule">Programar</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>

            {mode === "schedule" ? (
              <PublishingSchedulePicker
                date={scheduledDate}
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

        <DialogFooter>
          <Button onClick={onClose} variant="brand-secondary">
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              onSave({
                content,
                selectedAccounts,
                mediaAssetIds: selectedMediaAssetId
                  ? [selectedMediaAssetId]
                  : [],
                mode,
                scheduledAt: new Date(
                  `${scheduledDate}T${scheduledTime}:00`
                ).toISOString(),
              })
            }
          >
            {mode === "draft" ? (
              <FileText data-icon="inline-start" />
            ) : mode === "now" ? (
              <Send data-icon="inline-start" />
            ) : (
              <CalendarDays data-icon="inline-start" />
            )}
            {mode === "draft"
              ? "Guardar borrador"
              : mode === "now"
                ? "Publicar ahora"
                : "Programar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PublishingCalendarPage({
  calendar,
  initialSection = "calendar",
}: {
  calendar: PublishingCalendarData
  initialSection?: PublishingSection
}) {
  const router = useRouter()
  const [posts, setPosts] = useState(calendar.posts)
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

  if (!calendar.canView) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Pide acceso a un administrador del espacio de trabajo para gestionar publicaciones."
            icon={CircleAlert}
            title="No tienes acceso a Publishing"
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
        toast.success("Los cambios se guardaron.")
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
            ? `Iniciamos la operación para ${nextPosts.length} destino${nextPosts.length === 1 ? "" : "s"}.`
            : mode === "draft"
              ? "El borrador se guardó."
              : `Programamos ${nextPosts.length} publicación${nextPosts.length === 1 ? "" : "es"}.`
        )
      }
      createIdempotencyKey.current = null
      setComposerOpen(false)
      setEditingPost(null)
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === "VALIDATION_FAILED"
          ? "Revisa las cuentas, media y fecha antes de continuar."
          : "No pudimos guardar la publicación. Inténtalo de nuevo."
      )
    }
  }

  async function retryPost(post: PublishingPost) {
    try {
      const updated = await publishingApi.retry(post.id)
      setPosts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
      toast.success("El reintento se añadió a la cola.")
    } catch {
      toast.error("No pudimos reintentar la publicación.")
    }
  }

  async function deletePost(post: PublishingPost) {
    try {
      await publishingApi.remove(post.id)
      setPosts((current) => current.filter((item) => item.id !== post.id))
      toast.success("El borrador se eliminó.")
    } catch {
      toast.error("No pudimos eliminar el borrador.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {section !== "calendar" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Secciones de Publishing">
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
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </nav>
          <Button onClick={() => openComposer()}>
            <CalendarDays data-icon="inline-start" />
            Nueva publicación
          </Button>
        </div>
      ) : null}

      {section === "calendar" ? (
        <section aria-label="Calendario de publicaciones">
          <PublishingCalendar
            initialDate={calendar.focusDate}
            onCreateAtDate={(date) => openComposer(null, date)}
            onEditPost={openComposer}
            posts={posts}
          />
        </section>
      ) : null}

      {section === "queue" ? (
        <section
          aria-label="Cola de publicaciones"
          className="flex flex-col gap-4"
        >
          <PublishingMetrics
            items={[
              {
                icon: CalendarClock,
                label: "Programadas",
                value: queuePosts.filter((post) => post.status === "scheduled")
                  .length,
              },
              {
                icon: LoaderCircle,
                label: "En proceso",
                value: queuePosts.filter((post) => post.status === "processing")
                  .length,
              },
              {
                icon: XCircle,
                label: "Fallidas",
                value: queuePosts.filter((post) => post.status === "failed")
                  .length,
              },
            ]}
          />
          <PublishingPostsTable
            mode="queue"
            onRetry={retryPost}
            posts={queuePosts}
          />
        </section>
      ) : null}

      {section === "drafts" ? (
        <section aria-label="Borradores" className="flex flex-col gap-4">
          <PublishingMetrics
            items={[
              { icon: FileText, label: "Total", value: drafts.length },
              {
                icon: ImagePlus,
                label: "Con archivo",
                value: drafts.filter((post) => post.hasMedia).length,
              },
              {
                icon: Send,
                label: "Listos para programar",
                value: drafts.filter((post) => post.content.trim().length > 0)
                  .length,
              },
            ]}
          />
          <PublishingPostsTable
            mode="drafts"
            onContinue={openComposer}
            onDelete={deletePost}
            posts={drafts}
          />
        </section>
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
          media={calendar.media}
          open={composerOpen}
        />
      ) : null}
    </div>
  )
}
