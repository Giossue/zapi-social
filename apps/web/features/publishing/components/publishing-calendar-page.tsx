"use client"

import { useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  FileText,
  Plus,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import type {
  PublishingCalendarData,
  PublishingPost,
  PublishingStatus,
} from "@/features/publishing/types/publishing-calendar"

type CalendarView = "month" | "week"

const statusMeta: Record<PublishingStatus, { label: string; variant: "neutral" | "success" | "warning" | "destructive" }> = {
  draft: { label: "Borrador", variant: "neutral" },
  failed: { label: "Fallido", variant: "destructive" },
  pending: { label: "Pendiente", variant: "warning" },
  published: { label: "Publicado", variant: "success" },
  scheduled: { label: "Programado", variant: "neutral" },
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-")
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)

  return next
}

function startOfWeek(date: Date) {
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day

  return addDays(date, mondayOffset)
}

function calendarDays(focusDate: Date, view: CalendarView) {
  if (view === "week") {
    const start = startOfWeek(focusDate)

    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }

  const firstDay = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
  const lastDay = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0)
  const start = startOfWeek(firstDay)
  const end = addDays(lastDay, lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay())
  const days: Date[] = []

  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day)
  }

  return days
}

function calendarTitle(focusDate: Date, view: CalendarView) {
  if (view === "month") {
    return focusDate.toLocaleDateString("es", { month: "long", year: "numeric" })
  }

  const start = startOfWeek(focusDate)
  const end = addDays(start, 6)

  return `${start.toLocaleDateString("es", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}`
}

function CalendarPost({ post, onOpen }: { post: PublishingPost; onOpen: (post: PublishingPost) => void }) {
  const status = statusMeta[post.status]

  return (
    <Button
      className="h-auto w-full justify-start p-2 text-left"
      onClick={() => onOpen(post)}
      variant="brand-secondary"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3" />
          {post.time}
        </span>
        <span className="mt-1 block truncate text-sm font-medium">{post.title}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{post.channel}</span>
      </span>
    </Button>
  )
}

export function PublishingCalendarPage({ calendar }: { calendar: PublishingCalendarData }) {
  const [view, setView] = useState<CalendarView>("week")
  const [focusDate, setFocusDate] = useState(() => parseDate(calendar.focusDate))
  const [notice, setNotice] = useState<string | null>(null)
  const days = calendarDays(focusDate, view)
  const focusKey = dateKey(focusDate)

  function movePeriod(direction: -1 | 1) {
    const amount = view === "week" ? 7 : 31
    setFocusDate((current) => addDays(current, direction * amount))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label="Periodo anterior" onClick={() => movePeriod(-1)} size="icon" variant="surface">
            <ChevronLeft />
          </Button>
          <Button onClick={() => setFocusDate(parseDate(calendar.focusDate))} variant="brand-secondary">
            Hoy
          </Button>
          <Button aria-label="Periodo siguiente" onClick={() => movePeriod(1)} size="icon" variant="surface">
            <ChevronRight />
          </Button>
          <p className="ml-1 text-sm font-semibold capitalize">{calendarTitle(focusDate, view)}</p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs aria-label="Vista del calendario" onValueChange={(value) => setView(value as CalendarView)} value={view}>
            <TabsList>
              <TabsTrigger value="month">Mes</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setNotice("Composer preparado como mock.")} size="lg">
            <Plus data-icon="inline-start" />
            Nueva publicación
          </Button>
        </div>
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

      <Card className="overflow-hidden" variant="surface">
        <CardContent className="overflow-x-auto px-0">
          <div className="grid min-w-[56rem] grid-cols-7">
            {days.map((day, index) => {
              const key = dateKey(day)
              const dayPosts = calendar.posts.filter((post) => post.date === key)
              const isFocusDay = key === focusKey
              const isCurrentMonth = day.getMonth() === focusDate.getMonth()
              const isWeekEnd = (index + 1) % 7 === 0
              const isLastRow = index >= days.length - 7

              return (
                <section
                  className={[
                    "min-h-80 border-border p-3",
                    !isWeekEnd && "border-r",
                    !isLastRow && "border-b",
                    isFocusDay ? "bg-primary/5" : "bg-card",
                    !isCurrentMonth && "text-muted-foreground",
                  ].filter(Boolean).join(" ")}
                  key={key}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {day.toLocaleDateString("es", { weekday: "short" })}
                      </p>
                      <p className={`mt-1 text-lg font-semibold ${isFocusDay ? "text-primary" : ""}`}>
                        {day.getDate()}
                      </p>
                    </div>
                    {isFocusDay ? <Badge variant="neutral">Hoy</Badge> : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    {dayPosts.map((post) => (
                      <CalendarPost
                        key={post.id}
                        onOpen={(selectedPost) => setNotice(`${selectedPost.title}: vista previa mock.`)}
                        post={post}
                      />
                    ))}
                    {dayPosts.length === 0 ? (
                      <Button
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => setNotice(`Nueva publicación para ${day.toLocaleDateString("es")}: mock.`)}
                        size="sm"
                        variant="ghost"
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

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" />
          {calendar.posts.length} publicaciones mock
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CircleCheck className="size-4 text-success" />
          Publicado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileText className="size-4" />
          Borrador
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CircleX className="size-4 text-destructive" />
          Fallido
        </span>
      </div>
    </div>
  )
}
