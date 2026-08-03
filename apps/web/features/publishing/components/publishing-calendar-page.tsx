"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
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
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  Card,
  CardContent,
  CardHeader,
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
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
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
  PublishingProvider,
  PublishingStatus,
} from "@/features/publishing/types/publishing-calendar"

type PublishingSection = "calendar" | "queue" | "drafts"
type ComposerMode = "draft" | "now" | "schedule"

const defaultScheduleDate = "2026-08-03"

const providerLabels: Record<PublishingProvider, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
}

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

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function postTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ")

  return normalized.length > 54
    ? `${normalized.slice(0, 51)}…`
    : normalized || "Publicación sin texto"
}

function PublishingLoading() {
  return (
    <div aria-busy="true" className="overflow-hidden rounded-md border">
      <div className="flex flex-col gap-4 border-b bg-sidebar p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-72" />
      </div>
      <Card className="border-0 shadow-none" size="sm" variant="surface">
        <CardHeader className="sr-only">Cargando calendario</CardHeader>
        <CardContent className="grid grid-cols-7 gap-px bg-border px-0">
          {Array.from({ length: 35 }, (_, index) => (
            <div className="min-h-32 bg-card p-3" key={index}>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="mt-5 h-14 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ComposerDialog({
  accounts,
  editingPost,
  initialScheduledDate,
  onClose,
  onSave,
  open,
}: {
  accounts: PublishingAccount[]
  editingPost: PublishingPost | null
  initialScheduledDate: string
  onClose: () => void
  onSave: (input: {
    content: string
    selectedAccounts: string[]
    hasMedia: boolean
    mode: ComposerMode
    scheduledAt: string
  }) => void
  open: boolean
}) {
  const [content, setContent] = useState(() => editingPost?.content ?? "")
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(() =>
    editingPost
      ? accounts
          .filter((account) => account.provider === editingPost.provider)
          .map((account) => account.id)
      : []
  )
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<string | null>(() =>
    editingPost?.hasMedia ? "campaign-launch" : null
  )
  const [mode, setMode] = useState<ComposerMode>(() =>
    editingPost?.status === "draft" ? "draft" : "schedule"
  )
  const [scheduledDate, setScheduledDate] = useState(() => editingPost?.date ?? initialScheduledDate)
  const [scheduledTime, setScheduledTime] = useState(() =>
    editingPost?.time === "Ahora" ? "10:00" : (editingPost?.time ?? "10:00")
  )
  const [activePreviewAccountId, setActivePreviewAccountId] = useState<string | null>(null)
  const hasMedia = selectedMediaAssetId !== null
  const selected = accounts.filter((account) => selectedAccounts.includes(account.id))
  const canSubmit =
    selected.length > 0 &&
    selected.every((account) => account.connected) &&
    Boolean(content.trim()) &&
    selected.every((account) => account.provider === "facebook" || hasMedia) &&
    (mode !== "schedule" || Boolean(scheduledDate && scheduledTime))

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[min(96vw,80rem)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPost ? "Editar publicación" : "Nueva publicación"}</DialogTitle>
          <DialogDescription>
            El mock valida cada destino antes de guardar, programar o publicar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <FieldGroup>
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
              <PublishingMediaPicker onChange={setSelectedMediaAssetId} selectedAssetId={selectedMediaAssetId} />
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

          <PublishingNetworkPreview
            accounts={accounts}
            activeAccountId={activePreviewAccountId}
            content={content}
            hasMedia={hasMedia}
            onAccountChange={setActivePreviewAccountId}
            selectedAccountIds={selectedAccounts}
          />
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
                hasMedia,
                mode,
                scheduledAt: `${scheduledDate}T${scheduledTime}`,
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
            {mode === "draft" ? "Guardar borrador" : mode === "now" ? "Publicar ahora" : "Programar"}
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
  const [posts, setPosts] = useState(calendar.posts)
  const [section, setSection] = useState<PublishingSection>(initialSection)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerScheduledDate, setComposerScheduledDate] = useState(defaultScheduleDate)
  const [editingPost, setEditingPost] = useState<PublishingPost | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const queuePosts = useMemo(() => posts.filter((post) => post.status !== "draft"), [posts])
  const drafts = useMemo(() => posts.filter((post) => post.status === "draft"), [posts])

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

  function openComposer(post: PublishingPost | null = null, scheduledDate = defaultScheduleDate) {
    setEditingPost(post)
    setComposerScheduledDate(post?.date ?? scheduledDate)
    setComposerOpen(true)
  }

  function savePost({
    content,
    selectedAccounts,
    hasMedia,
    mode,
    scheduledAt,
  }: {
    content: string
    selectedAccounts: string[]
    hasMedia: boolean
    mode: ComposerMode
    scheduledAt: string
  }) {
    const dateTime = mode === "schedule" ? new Date(scheduledAt) : parseDate(calendar.focusDate)
    const date = dateKey(dateTime)
    const time = mode === "schedule" ? scheduledAt.slice(11, 16) : "Ahora"
    const nextStatus: PublishingStatus =
      mode === "draft" ? "draft" : mode === "now" ? "processing" : "scheduled"
    const destinations = calendar.accounts.filter((account) => selectedAccounts.includes(account.id))
    const nextPosts = destinations.map((account, index): PublishingPost => ({
      id: `${Date.now()}-${account.id}-${index}`,
      date,
      time,
      title: postTitle(content),
      content,
      channel: `${account.name} · ${providerLabels[account.provider]}`,
      provider: account.provider,
      status: nextStatus,
      hasMedia,
    }))

    if (editingPost) {
      setPosts((current) =>
        current.map((post) => (post.id === editingPost.id ? { ...post, ...nextPosts[0] } : post))
      )
      setNotice("Los cambios del borrador se guardaron en este mock.")
    } else {
      setPosts((current) => [...nextPosts, ...current])
      setNotice(
        mode === "now"
          ? `Iniciamos la operación para ${nextPosts.length} destino${nextPosts.length === 1 ? "" : "s"}.`
          : mode === "draft"
            ? "El borrador se guardó."
            : `Programamos ${nextPosts.length} publicación${nextPosts.length === 1 ? "" : "es"}.`
      )
    }
    setComposerOpen(false)
    setEditingPost(null)
  }

  function retryPost(post: PublishingPost) {
    setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, status: "processing" } : item)))
    setNotice("El reintento se añadió a la cola mock.")
  }

  function deletePost(post: PublishingPost) {
    setPosts((current) => current.filter((item) => item.id !== post.id))
    setNotice("El borrador se eliminó.")
  }

  return (
    <div className="flex flex-col gap-4">
      {section !== "calendar" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Secciones de Publishing">
            <ButtonGroup>
              {sectionLinks.map((item) => (
                <Button
                  asChild
                  key={item.value}
                  onClick={() => setSection(item.value)}
                  size="sm"
                  variant={section === item.value ? "sidebar-active" : "brand-secondary"}
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </ButtonGroup>
          </nav>
          <Button onClick={() => openComposer()}>
            <CalendarDays data-icon="inline-start" />
            Nueva publicación
          </Button>
        </div>
      ) : null}

      {notice ? (
        <Alert>
          <CalendarClock aria-hidden="true" />
          <AlertTitle>Actualización del mock</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
          <AlertAction>
            <Button onClick={() => setNotice(null)} size="sm" variant="brand-secondary">
              Cerrar
            </Button>
          </AlertAction>
        </Alert>
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
        <section aria-label="Cola de publicaciones" className="flex flex-col gap-4">
          <PublishingMetrics
            items={[
              {
                icon: CalendarClock,
                label: "Programadas",
                value: queuePosts.filter((post) => post.status === "scheduled").length,
              },
              {
                icon: LoaderCircle,
                label: "En proceso",
                value: queuePosts.filter((post) => post.status === "processing").length,
              },
              {
                icon: XCircle,
                label: "Fallidas",
                value: queuePosts.filter((post) => post.status === "failed").length,
              },
            ]}
          />
          <PublishingPostsTable mode="queue" onRetry={retryPost} posts={queuePosts} />
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
                value: drafts.filter((post) => post.content.trim().length > 0).length,
              },
            ]}
          />
          <PublishingPostsTable mode="drafts" onContinue={openComposer} onDelete={deletePost} posts={drafts} />
        </section>
      ) : null}

      {composerOpen ? (
        <ComposerDialog
          accounts={calendar.accounts}
          editingPost={editingPost}
          initialScheduledDate={composerScheduledDate}
          onClose={() => {
            setComposerOpen(false)
            setEditingPost(null)
          }}
          onSave={savePost}
          open={composerOpen}
        />
      ) : null}
    </div>
  )
}

export { PublishingLoading }
