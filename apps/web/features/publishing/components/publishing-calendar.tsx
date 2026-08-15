"use client"

import * as React from "react"
import { useCalendarController } from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/react/daygrid"
import interactionPlugin from "@fullcalendar/react/interaction"
import listPlugin from "@fullcalendar/react/list"
import esLocale from "@fullcalendar/react/locales/es"
import multiMonthPlugin from "@fullcalendar/react/multimonth"
import timeGridPlugin from "@fullcalendar/react/timegrid"
import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  XIcon,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type {
  PublishingPost,
  PublishingProvider,
  PublishingStatus,
} from "@/features/publishing/types/publishing-calendar"

import { EventCalendarViews } from "./event-calendar-views"

const views = [
  { key: "dayGridMonth", label: "Mes" },
  { key: "timeGridWeek", label: "Semana" },
  { key: "timeGridDay", label: "Día" },
]

const initialCalendarView = "dayGridMonth"

const calendars: Array<{ key: PublishingProvider | "all"; label: string }> = [
  { key: "all", label: "Todos los canales" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "whatsapp", label: "WhatsApp" },
]

const plugins = [
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin,
  multiMonthPlugin,
]

const editableStatuses = new Set<PublishingStatus>([
  "draft",
  "failed",
  "scheduled",
])

type PublishingCalendarProps = {
  initialDate: string
  onCreateAtDate: (date: string) => void
  onEditPost: (post: PublishingPost) => void
  posts: PublishingPost[]
}

function toEventStart(post: PublishingPost) {
  return `${post.date}T${post.time === "Ahora" ? "12:00" : post.time}`
}

export function PublishingCalendar({
  initialDate,
  onCreateAtDate,
  onEditPost,
  posts,
}: PublishingCalendarProps) {
  const controller = useCalendarController()
  const [selectedCalendar, setSelectedCalendar] = React.useState<
    PublishingProvider | "all"
  >("all")
  const [dateInfo, setDateInfo] = React.useState(() => {
    const date = new Date(`${initialDate}T12:00:00`)

    return {
      title: format(date, "MMMM 'de' yyyy", { locale: es }),
      days: differenceInCalendarDays(endOfMonth(date), startOfMonth(date)) + 1,
    }
  })

  const filteredPosts = React.useMemo(
    () =>
      selectedCalendar === "all"
        ? posts
        : posts.filter((post) => post.provider === selectedCalendar),
    [posts, selectedCalendar]
  )
  const events = React.useMemo(
    () =>
      filteredPosts.map((post) => ({
        id: post.id,
        start: toEventStart(post),
        title: post.title,
      })),
    [filteredPosts]
  )
  const eventCount = filteredPosts.filter((post) => {
    const start = new Date(toEventStart(post))
    const startOfVisibleRange = controller.view?.currentStart
    const endOfVisibleRange = controller.view?.currentEnd

    return (
      startOfVisibleRange &&
      endOfVisibleRange &&
      start >= startOfVisibleRange &&
      start < endOfVisibleRange
    )
  }).length

  return (
    <div className="flex h-[calc(100svh-5rem)] min-h-[30rem] flex-col overflow-hidden rounded-md border bg-card text-card-foreground md:h-[calc(100svh-7rem)]">
      <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 shrink-0 flex-col gap-1">
          <div className="text-lg leading-none font-medium first-letter:uppercase">
            {dateInfo.title}
          </div>
          <p className="text-sm text-muted-foreground">
            {dateInfo.days} días · {eventCount} publicaciones
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            onValueChange={(value) =>
              setSelectedCalendar(value as PublishingProvider | "all")
            }
            value={selectedCalendar}
          >
            <SelectTrigger className="w-full sm:w-max">
              <CalendarIcon />
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {calendars.map((calendar) => (
                  <SelectItem key={calendar.key} value={calendar.key}>
                    {calendar.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <ButtonGroup>
            <Button
              aria-label="Periodo anterior"
              onClick={() => controller.prev()}
              size="icon"
              variant="outline"
            >
              <ChevronLeft />
            </Button>
            <Button onClick={() => controller.today()} variant="outline">
              Hoy
            </Button>
            <Button
              aria-label="Periodo siguiente"
              onClick={() => controller.next()}
              size="icon"
              variant="outline"
            >
              <ChevronRight />
            </Button>
          </ButtonGroup>
          <Select
            onValueChange={(value) => {
              controller.changeView(value)
            }}
            value={controller.view?.type ?? initialCalendarView}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {views.map((view) => (
                  <SelectItem key={view.key} value={view.key}>
                    {view.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            className="hidden sm:inline-flex"
            onClick={() => onCreateAtDate(initialDate)}
          >
            <Plus />
            Nueva publicación
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <EventCalendarViews
          controller={controller}
          dateClick={(info) => onCreateAtDate(info.dateStr)}
          datesSet={(info) => {
            setDateInfo({
              title: info.view.title,
              days: differenceInCalendarDays(
                info.view.currentEnd,
                info.view.currentStart
              ),
            })
          }}
          dayMaxEvents
          eventClick={(info) => {
            const post = posts.find((item) => item.id === info.event.id)

            if (post && editableStatuses.has(post.status)) {
              onEditPost(post)
            }
          }}
          events={events}
          expandRows
          height="100%"
          initialDate={initialDate}
          initialView={initialCalendarView}
          locale={esLocale}
          nowIndicator
          plugins={[...plugins]}
          popoverCloseContent={() => (
            <XIcon className="size-5 text-muted-foreground group-hover:text-foreground" />
          )}
          scrollTime="08:00:00"
        />
      </div>

      <FloatingActionButton
        label="Nueva publicación"
        onClick={() => onCreateAtDate(initialDate)}
        withSpacer={false}
      />
    </div>
  )
}
