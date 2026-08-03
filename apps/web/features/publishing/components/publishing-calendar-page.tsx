"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  ImagePlus,
  LoaderCircle,
  Plus,
  Send,
  XCircle,
} from "lucide-react"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  Card,
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
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { PublishingAccountPicker } from "@/features/publishing/components/publishing-account-picker"
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

type CalendarView = "month" | "week"
type PublishingSection = "calendar" | "queue" | "drafts"
type ComposerMode = "draft" | "now" | "schedule"

type StatusMeta = {
  label: string
  variant: "neutral" | "success" | "warning" | "destructive"
}

const statusMeta: Record<PublishingStatus, StatusMeta> = {
  draft: { label: "Borrador", variant: "neutral" },
  failed: { label: "Fallida", variant: "destructive" },
  processing: { label: "En proceso", variant: "warning" },
  published: { label: "Publicada", variant: "success" },
  scheduled: { label: "Programada", variant: "neutral" },
}

const providerMeta: Record<PublishingProvider, string> = {
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

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date: Date) {
  const day = date.getDay()
  return addDays(date, day === 0 ? -6 : 1 - day)
}

function calendarDays(focusDate: Date, view: CalendarView) {
  if (view === "week") {
    const start = startOfWeek(focusDate)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }

  const firstDay = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
  const lastDay = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0)
  const start = startOfWeek(firstDay)
  const end = addDays(
    lastDay,
    lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay()
  )
  const days: Date[] = []

  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

function calendarTitle(focusDate: Date, view: CalendarView) {
  if (view === "month") {
    return focusDate.toLocaleDateString("es", {
      month: "long",
      year: "numeric",
    })
  }

  const start = startOfWeek(focusDate)
  const end = addDays(start, 6)
  return `${start.toLocaleDateString("es", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}`
}

function postTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ")
  return normalized.length > 54
    ? `${normalized.slice(0, 51)}…`
    : normalized || "Publicación sin texto"
}

function PublishingLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Card size="sm" variant="surface">
        <CardHeader className="border-b">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="grid grid-cols-7 gap-px bg-border px-0">
          {Array.from({ length: 14 }, (_, index) => (
            <div className="min-h-40 bg-card p-3" key={index}>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="mt-5 h-14 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function PostStatusBadge({ status }: { status: PublishingStatus }) {
  const meta = statusMeta[status]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

function ComposerDialog({
  accounts,
  editingPost,
  onClose,
  onSave,
  open,
}: {
  accounts: PublishingAccount[]
  editingPost: PublishingPost | null
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
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<
    string | null
  >(() => (editingPost?.hasMedia ? "campaign-launch" : null))
  const [mode, setMode] = useState<ComposerMode>(() =>
    editingPost?.status === "draft" ? "draft" : "schedule"
  )
  const [scheduledDate, setScheduledDate] = useState("2026-08-03")
  const [scheduledTime, setScheduledTime] = useState("10:00")
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[min(96vw,80rem)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPost ? "Editar publicación" : "Nueva publicación"}
          </DialogTitle>
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
              <PublishingMediaPicker
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

function PublishingCalendar({
  focusDate,
  onNextPeriod,
  onOpenComposer,
  onPreviousPeriod,
  onResetPeriod,
  onViewChange,
  posts,
  view,
}: {
  focusDate: Date
  onNextPeriod: () => void
  onOpenComposer: () => void
  onPreviousPeriod: () => void
  onResetPeriod: () => void
  onViewChange: (view: CalendarView) => void
  posts: PublishingPost[]
  view: CalendarView
}) {
  const days = calendarDays(focusDate, view)
  const focusKey = dateKey(focusDate)

  return (
    <Card className="overflow-hidden" size="sm" variant="surface">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="capitalize">
              {calendarTitle(focusDate, view)}
            </CardTitle>
            <CardDescription>
              {posts.length} publicaciones en el calendario mock
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonGroup aria-label="Navegación del calendario">
              <Button
                aria-label="Periodo anterior"
                onClick={onPreviousPeriod}
                size="icon-sm"
                variant="surface"
              >
                <ChevronLeft />
              </Button>
              <Button onClick={onResetPeriod} size="sm" variant="surface">
                Hoy
              </Button>
              <Button
                aria-label="Periodo siguiente"
                onClick={onNextPeriod}
                size="icon-sm"
                variant="surface"
              >
                <ChevronRight />
              </Button>
            </ButtonGroup>
            <Tabs
              aria-label="Vista del calendario"
              onValueChange={(value) => onViewChange(value as CalendarView)}
              value={view}
            >
              <TabsList>
                <TabsTrigger value="month">Mes</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <div className="grid min-w-[52rem] grid-cols-7 gap-px bg-border">
          {days.map((day) => {
            const key = dateKey(day)
            const dayPosts = posts.filter((post) => post.date === key)
            const isCurrentMonth = day.getMonth() === focusDate.getMonth()

            return (
              <section
                className={cn(
                  "flex min-h-48 flex-col gap-3 bg-card p-3",
                  view === "week" && "min-h-[28rem]",
                  key === focusKey && "bg-muted/50",
                  !isCurrentMonth && "text-muted-foreground"
                )}
                key={key}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {day.toLocaleDateString("es", { weekday: "short" })}
                    </p>
                    <p className="text-base font-semibold">{day.getDate()}</p>
                  </div>
                  {key === focusKey ? (
                    <Badge variant="neutral">Hoy</Badge>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  {dayPosts.map((post) => (
                    <Button
                      className="h-auto w-full items-start justify-start px-2 py-2 text-left"
                      key={post.id}
                      onClick={onOpenComposer}
                      variant="brand-secondary"
                    >
                      <span className="flex w-full flex-col gap-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 aria-hidden="true" />
                          {post.time}
                        </span>
                        <span className="truncate text-sm font-medium">
                          {post.title}
                        </span>
                        <span className="flex items-center justify-between gap-1">
                          <span className="truncate text-xs text-muted-foreground">
                            {providerMeta[post.provider]}
                          </span>
                          <PostStatusBadge status={post.status} />
                        </span>
                      </span>
                    </Button>
                  ))}
                  {dayPosts.length === 0 ? (
                    <Button
                      className="w-full justify-start"
                      onClick={onOpenComposer}
                      size="sm"
                      variant="brand-secondary"
                    >
                      <Plus data-icon="inline-start" />
                      Añadir publicación
                    </Button>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </CardContent>
    </Card>
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
  const [view, setView] = useState<CalendarView>("week")
  const [focusDate, setFocusDate] = useState(() =>
    parseDate(calendar.focusDate)
  )
  const [section, setSection] = useState<PublishingSection>(initialSection)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<PublishingPost | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  function openComposer(post: PublishingPost | null = null) {
    setEditingPost(post)
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
    const dateTime = mode === "schedule" ? new Date(scheduledAt) : focusDate
    const date = dateKey(dateTime)
    const time = mode === "schedule" ? scheduledAt.slice(11, 16) : "Ahora"
    const nextStatus: PublishingStatus =
      mode === "draft" ? "draft" : mode === "now" ? "processing" : "scheduled"
    const destinations = calendar.accounts.filter((account) =>
      selectedAccounts.includes(account.id)
    )
    const nextPosts = destinations.map((account, index): PublishingPost => ({
      id: `${Date.now()}-${account.id}-${index}`,
      date,
      time,
      title: postTitle(content),
      content,
      channel: `${account.name} · ${providerMeta[account.provider]}`,
      provider: account.provider,
      status: nextStatus,
      hasMedia,
    }))

    if (editingPost) {
      setPosts((current) =>
        current.map((post) =>
          post.id === editingPost.id ? { ...post, ...nextPosts[0] } : post
        )
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
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id ? { ...item, status: "processing" } : item
      )
    )
    setNotice("El reintento se añadió a la cola mock.")
  }

  function deletePost(post: PublishingPost) {
    setPosts((current) => current.filter((item) => item.id !== post.id))
    setNotice("El borrador se eliminó.")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Secciones de Publishing">
          <ButtonGroup>
            {sectionLinks.map((item) => (
              <Button
                asChild
                key={item.value}
                onClick={() => setSection(item.value)}
                size="sm"
                variant={
                  section === item.value ? "sidebar-active" : "brand-secondary"
                }
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </ButtonGroup>
        </nav>
        <Button onClick={() => openComposer()}>
          <Plus data-icon="inline-start" />
          Nueva publicación
        </Button>
      </div>

      {notice ? (
        <Alert>
          <CalendarClock aria-hidden="true" />
          <AlertTitle>Actualización del mock</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
          <AlertAction>
            <Button
              onClick={() => setNotice(null)}
              size="sm"
              variant="brand-secondary"
            >
              Cerrar
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {section === "calendar" ? (
        <section aria-label="Calendario de publicaciones">
          <PublishingCalendar
            focusDate={focusDate}
            onNextPeriod={() =>
              setFocusDate((current) =>
                addDays(current, view === "week" ? 7 : 31)
              )
            }
            onOpenComposer={() => openComposer()}
            onPreviousPeriod={() =>
              setFocusDate((current) =>
                addDays(current, view === "week" ? -7 : -31)
              )
            }
            onResetPeriod={() => setFocusDate(parseDate(calendar.focusDate))}
            onViewChange={setView}
            posts={posts}
            view={view}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="neutral">{posts.length} publicaciones mock</Badge>
            <Badge variant="warning">
              {queuePosts.filter((post) => post.status === "processing").length}{" "}
              en proceso
            </Badge>
            <Badge variant="destructive">
              {queuePosts.filter((post) => post.status === "failed").length}{" "}
              fallidas
            </Badge>
          </div>
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
