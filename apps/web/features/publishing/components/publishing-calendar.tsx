"use client"

import * as React from "react"
import { useCalendarController } from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/react/daygrid"
import interactionPlugin from "@fullcalendar/react/interaction"
import listPlugin from "@fullcalendar/react/list"
import esLocale from "@fullcalendar/react/locales/es"
import multiMonthPlugin from "@fullcalendar/react/multimonth"
import timeGridPlugin from "@fullcalendar/react/timegrid"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Funnel,
  Plus,
  XIcon,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupText,
} from "@workspace/ui/components/button-group"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { DataTableSearch } from "@workspace/ui/components/data-table-controls"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import type {
  PublishingPost,
  PublishingProvider,
  PublishingStatus,
} from "@/features/publishing/types/publishing-calendar"

import { EventCalendarViews } from "./event-calendar-views"

const initialCalendarView = "dayGridMonth"

const views = [
  { key: initialCalendarView, label: "Mes", currentLabel: "Este mes" },
  { key: "timeGridWeek", label: "Semana", currentLabel: "Esta semana" },
  { key: "timeGridDay", label: "Día", currentLabel: "Hoy" },
]

const channels: Array<{ key: PublishingProvider; label: string }> = [
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
  const [query, setQuery] = React.useState("")
  const [selectedChannels, setSelectedChannels] = React.useState<
    PublishingProvider[]
  >([])
  const [title, setTitle] = React.useState(() =>
    format(new Date(`${initialDate}T12:00:00`), "MMMM 'de' yyyy", { locale: es })
  )

  const viewKey = controller.view?.type ?? initialCalendarView
  const currentLabel =
    views.find((view) => view.key === viewKey)?.currentLabel ?? "Hoy"

  const events = React.useMemo(() => {
    const term = query.trim().toLowerCase()

    return posts
      .filter((post) => {
        const matchesQuery =
          !term || post.title.toLowerCase().includes(term)
        const matchesChannel =
          selectedChannels.length === 0 ||
          selectedChannels.includes(post.provider)

        return matchesQuery && matchesChannel
      })
      .map((post) => ({
        id: post.id,
        start: toEventStart(post),
        title: post.title,
      }))
  }, [posts, query, selectedChannels])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border bg-card text-card-foreground">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <DataTableSearch
          ariaLabel="Buscar publicaciones"
          onChange={setQuery}
          placeholder="Buscar publicaciones..."
          value={query}
        />

        <Button onClick={() => controller.today()} size="sm" variant="outline">
          {currentLabel}
        </Button>

        <ButtonGroup>
          <Button
            aria-label="Periodo anterior"
            onClick={() => controller.prev()}
            size="icon-sm"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
          <ButtonGroupText className="h-7 whitespace-nowrap first-letter:uppercase">
            <CalendarDays aria-hidden="true" />
            {title}
          </ButtonGroupText>
          <Button
            aria-label="Periodo siguiente"
            onClick={() => controller.next()}
            size="icon-sm"
            variant="outline"
          >
            <ChevronRight />
          </Button>
        </ButtonGroup>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              aria-label="Filtrar por canal"
              className="relative"
              size="icon-sm"
              variant="outline"
            >
              <Funnel />
              {selectedChannels.length > 0 ? (
                <Badge className="absolute -end-1.5 -top-1.5 size-4 justify-center rounded-full p-0 text-[0.625rem]">
                  {selectedChannels.length}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-3">
            <div className="flex flex-col gap-3">
              <div className="text-sm font-medium">Canales</div>
              {channels.map((channel) => (
                <div className="flex items-center gap-2" key={channel.key}>
                  <Checkbox
                    checked={selectedChannels.includes(channel.key)}
                    id={`channel-${channel.key}`}
                    onCheckedChange={(checked) =>
                      setSelectedChannels((current) =>
                        checked === true
                          ? [...current, channel.key]
                          : current.filter((item) => item !== channel.key)
                      )
                    }
                  />
                  <Label
                    className="font-normal"
                    htmlFor={`channel-${channel.key}`}
                  >
                    {channel.label}
                  </Label>
                </div>
              ))}
              <Button
                disabled={selectedChannels.length === 0}
                onClick={() => setSelectedChannels([])}
                size="sm"
                variant="outline"
              >
                Limpiar filtros
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Opciones del calendario"
              size="icon-sm"
              variant="outline"
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Vista del calendario</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={(value) => controller.changeView(value)}
              value={viewKey}
            >
              {views.map((view) => (
                <DropdownMenuRadioItem key={view.key} value={view.key}>
                  {view.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          className="ms-auto hidden sm:inline-flex"
          onClick={() => onCreateAtDate(initialDate)}
          size="sm"
        >
          <Plus />
          Nueva publicación
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <EventCalendarViews
          controller={controller}
          dateClick={(info) => onCreateAtDate(info.dateStr)}
          datesSet={(info) => {
            setTitle(info.view.title)
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
