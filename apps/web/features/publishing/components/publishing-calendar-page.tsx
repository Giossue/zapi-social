"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
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
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  PublishingMetrics,
  PublishingPostsTable,
} from "@/features/publishing/components/publishing-posts-table"
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
  if (view === "month")
    return focusDate.toLocaleDateString("es", {
      month: "long",
      year: "numeric",
    })

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

function preflightMessage(
  account: PublishingAccount,
  content: string,
  hasMedia: boolean
) {
  if (!account.connected)
    return "Esta cuenta debe reconectarse antes de publicar."
  if (!content.trim()) return "Añade un texto antes de continuar."
  if (account.provider === "instagram" && !hasMedia)
    return "Instagram requiere una imagen o video."
  if (account.provider === "whatsapp" && !hasMedia)
    return "El estado de WhatsApp requiere una imagen o video."
  return null
}

function PublishingLoading() {
  return (
    <div aria-busy="true" className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-44 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-96 animate-pulse rounded-xl border bg-card" />
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
  const [hasMedia, setHasMedia] = useState(() => editingPost?.hasMedia ?? false)
  const [mode, setMode] = useState<ComposerMode>(() =>
    editingPost?.status === "draft" ? "draft" : "schedule"
  )
  const [scheduledDate, setScheduledDate] = useState("2026-08-03")
  const [scheduledTime, setScheduledTime] = useState("10:00")

  const selected = accounts.filter((account) =>
    selectedAccounts.includes(account.id)
  )
  const validations = selected.map((account) => ({
    account,
    message: preflightMessage(account, content, hasMedia),
  }))
  const canSubmit =
    selected.length > 0 &&
    validations.every(({ message }) => !message) &&
    (mode !== "schedule" || Boolean(scheduledDate && scheduledTime))

  function toggleAccount(accountId: string, checked: boolean) {
    setSelectedAccounts((current) =>
      checked
        ? [...current, accountId]
        : current.filter((id) => id !== accountId)
    )
  }

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPost ? "Editar publicación" : "Nueva publicación"}
          </DialogTitle>
          <DialogDescription>
            El mock valida cada destino antes de guardar, programar o publicar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-5">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Cuentas destino</legend>
              <div className="space-y-2">
                {accounts.map((account) => {
                  const checked = selectedAccounts.includes(account.id)
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
                          {account.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {account.detail}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {providerMeta[account.provider]}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="publishing-content"
              >
                Texto
              </label>
              <Textarea
                id="publishing-content"
                onChange={(event) => setContent(event.target.value)}
                placeholder="Escribe el contenido de tu publicación"
                value={content}
              />
            </div>

            <Card variant="inset">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <ImagePlus
                    aria-hidden="true"
                    className="mt-0.5 size-5 text-muted-foreground"
                  />
                  <div>
                    <p className="text-sm font-medium">Archivo desde Files</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Mock: selecciona una imagen o video autorizado del
                      espacio.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setHasMedia((current) => !current)}
                  size="sm"
                  variant="brand-secondary"
                >
                  {hasMedia ? "Quitar archivo" : "Añadir archivo"}
                </Button>
              </CardContent>
            </Card>

            <Tabs
              aria-label="Momento de publicación"
              onValueChange={(value) => setMode(value as ComposerMode)}
              value={mode}
            >
              <TabsList className="w-full justify-start">
                <TabsTrigger value="draft">Borrador</TabsTrigger>
                <TabsTrigger value="now">Ahora</TabsTrigger>
                <TabsTrigger value="schedule">Programar</TabsTrigger>
              </TabsList>
            </Tabs>
            {mode === "schedule" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha</label>
                  <Select
                    onValueChange={setScheduledDate}
                    value={scheduledDate}
                  >
                    <SelectTrigger aria-label="Fecha de publicación">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026-08-03">
                        3 de agosto de 2026
                      </SelectItem>
                      <SelectItem value="2026-08-04">
                        4 de agosto de 2026
                      </SelectItem>
                      <SelectItem value="2026-08-05">
                        5 de agosto de 2026
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hora</label>
                  <Select
                    onValueChange={setScheduledTime}
                    value={scheduledTime}
                  >
                    <SelectTrigger aria-label="Hora de publicación">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="09:00">09:00</SelectItem>
                      <SelectItem value="10:00">10:00</SelectItem>
                      <SelectItem value="12:30">12:30</SelectItem>
                      <SelectItem value="16:00">16:00</SelectItem>
                      <SelectItem value="18:00">18:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </div>

          <Card variant="inset">
            <CardHeader>
              <CardTitle>Comprobación por destino</CardTitle>
              <CardDescription>
                La API y el Worker repetirán estas comprobaciones con permisos y
                capabilities reales.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {validations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Selecciona al menos una cuenta.
                </p>
              ) : null}
              {validations.map(({ account, message }) => (
                <div className="flex gap-2 text-sm" key={account.id}>
                  {message ? (
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-warning"
                    />
                  ) : (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-success"
                    />
                  )}
                  <div>
                    <p className="font-medium">{account.detail}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {message ?? "Listo para este destino."}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} variant="ghost">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PublishingCalendar({
  focusDate,
  onOpenComposer,
  posts,
  view,
}: {
  focusDate: Date
  onOpenComposer: () => void
  posts: PublishingPost[]
  view: CalendarView
}) {
  const days = calendarDays(focusDate, view)
  const focusKey = dateKey(focusDate)

  return (
    <Card className="overflow-hidden" variant="surface">
      <CardContent className="overflow-x-auto px-0">
        <div className="grid min-w-[56rem] grid-cols-7">
          {days.map((day, index) => {
            const key = dateKey(day)
            const dayPosts = posts.filter((post) => post.date === key)
            const isCurrentMonth = day.getMonth() === focusDate.getMonth()
            const isLastColumn = (index + 1) % 7 === 0
            const isLastRow = index >= days.length - 7
            return (
              <section
                className={[
                  view === "week" ? "min-h-[34rem] p-3" : "min-h-56 p-3",
                  !isLastColumn && "border-r border-border",
                  !isLastRow && "border-b border-border",
                  key === focusKey && "bg-primary/5",
                  !isCurrentMonth && "text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={key}
              >
                <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {day.toLocaleDateString("es", { weekday: "short" })}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {day.getDate()}
                    </p>
                  </div>
                  {key === focusKey ? (
                    <Badge variant="neutral">Hoy</Badge>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {dayPosts.map((post) => (
                    <button
                      className="w-full rounded-lg border border-border px-2 py-2 text-left transition-colors hover:bg-muted"
                      key={post.id}
                      onClick={onOpenComposer}
                      type="button"
                    >
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="size-3" />
                        {post.time}
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium">
                        {post.title}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-1">
                        <span className="truncate text-xs text-muted-foreground">
                          {providerMeta[post.provider]}
                        </span>
                        <PostStatusBadge status={post.status} />
                      </span>
                    </button>
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Secciones de Publishing"
          className="flex flex-wrap items-center gap-1"
        >
          {sectionLinks.map((item) => (
            <Button
              asChild
              key={item.value}
              onClick={() => setSection(item.value)}
              size="sm"
              variant={section === item.value ? "default" : "ghost"}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>
        <Button onClick={() => openComposer()} size="lg">
          <Plus data-icon="inline-start" />
          Nueva publicación
        </Button>
      </div>

      {notice ? (
        <Card variant="inset">
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{notice}</p>
            <Button onClick={() => setNotice(null)} size="sm" variant="ghost">
              Cerrar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {section === "calendar" ? (
        <section aria-label="Calendario de publicaciones" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                aria-label="Periodo anterior"
                onClick={() =>
                  setFocusDate((current) =>
                    addDays(current, view === "week" ? -7 : -31)
                  )
                }
                size="icon"
                variant="surface"
              >
                <ChevronLeft />
              </Button>
              <Button
                onClick={() => setFocusDate(parseDate(calendar.focusDate))}
                variant="brand-secondary"
              >
                Hoy
              </Button>
              <Button
                aria-label="Periodo siguiente"
                onClick={() =>
                  setFocusDate((current) =>
                    addDays(current, view === "week" ? 7 : 31)
                  )
                }
                size="icon"
                variant="surface"
              >
                <ChevronRight />
              </Button>
              <p className="ml-1 text-sm font-semibold capitalize">
                {calendarTitle(focusDate, view)}
              </p>
            </div>
            <Tabs
              aria-label="Vista del calendario"
              onValueChange={(value) => setView(value as CalendarView)}
              value={view}
            >
              <TabsList>
                <TabsTrigger value="month">Mes</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <PublishingCalendar
            focusDate={focusDate}
            onOpenComposer={() => openComposer()}
            posts={posts}
            view={view}
          />
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {posts.length} publicaciones mock
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle className="size-4" />
              En proceso
            </span>
            <span className="inline-flex items-center gap-1.5">
              <XCircle className="size-4" />
              Fallida
            </span>
          </div>
        </section>
      ) : null}

      {section === "queue" ? (
        <section aria-label="Cola de publicaciones" className="space-y-4">
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
        <section aria-label="Borradores" className="space-y-4">
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
