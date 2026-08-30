"use client"

import * as React from "react"
import { useCalendarController } from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/react/daygrid"
import interactionPlugin from "@fullcalendar/react/interaction"
import listPlugin from "@fullcalendar/react/list"
import multiMonthPlugin from "@fullcalendar/react/multimonth"
import timeGridPlugin from "@fullcalendar/react/timegrid"
import { format } from "date-fns"
import { useTranslations } from "next-intl"
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
  PublishingAccount,
  PublishingPost,
  PublishingProvider,
  PublishingStatus,
} from "@/features/publishing/types/publishing-calendar"

import { useDateLocale } from "@/lib/date-locale"
import { EventCalendarViews } from "./event-calendar-views"

const initialCalendarView = "dayGridMonth"

const views = [
  { key: initialCalendarView, messageKey: "month" },
  { key: "timeGridWeek", messageKey: "week" },
  { key: "timeGridDay", messageKey: "day" },
] as const

const channelOptions: Array<{ key: PublishingProvider; label: string }> = [
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
  accounts: PublishingAccount[]
  initialDate: string
  onCreateAtDate: (date: Date, allDay: boolean) => void
  onEditPost: (post: PublishingPost) => void
  posts: PublishingPost[]
}

function toEventStart(post: PublishingPost) {
  return `${post.date}T${post.time === "now" ? "12:00" : post.time}`
}

export function PublishingCalendar({
  accounts,
  initialDate,
  onCreateAtDate,
  onEditPost,
  posts,
}: PublishingCalendarProps) {
  const t = useTranslations("publishing.calendar")
  const dateLocale = useDateLocale()
  const controller = useCalendarController()
  const [query, setQuery] = React.useState("")
  const [selectedChannels, setSelectedChannels] = React.useState<
    PublishingProvider[]
  >([])
  const availableChannels = React.useMemo(
    () =>
      channelOptions.filter((channel) =>
        accounts.some((account) => account.provider === channel.key)
      ),
    [accounts]
  )
  const selectedAvailableChannels = React.useMemo(
    () =>
      selectedChannels.filter((provider) =>
        availableChannels.some((channel) => channel.key === provider)
      ),
    [availableChannels, selectedChannels]
  )
  const [title, setTitle] = React.useState(() =>
    format(new Date(`${initialDate}T12:00:00`), "MMMM yyyy", {
      locale: dateLocale.dateFns,
    })
  )

  const viewKey = controller.view?.type ?? initialCalendarView
  const currentView = views.find((view) => view.key === viewKey)
  const currentLabel = t(
    `current.${currentView?.messageKey ?? "day"}` as "current.day"
  )

  const events = React.useMemo(() => {
    const term = query.trim().toLowerCase()

    return posts
      .filter((post) => {
        const matchesQuery = !term || post.title.toLowerCase().includes(term)
        const matchesChannel =
          selectedAvailableChannels.length === 0 ||
          selectedAvailableChannels.includes(post.provider)

        return matchesQuery && matchesChannel
      })
      .map((post) => ({
        id: post.id,
        start: toEventStart(post),
        title: post.title || t("untitled"),
      }))
  }, [posts, query, selectedAvailableChannels, t])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border bg-card text-card-foreground">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <DataTableSearch
          ariaLabel={t("searchLabel")}
          onChange={setQuery}
          placeholder={t("searchPlaceholder")}
          value={query}
        />

        <Button onClick={() => controller.today()} size="sm" variant="outline">
          {currentLabel}
        </Button>

        <ButtonGroup>
          <Button
            aria-label={t("previousPeriod")}
            onClick={() => controller.prev()}
            size="icon-sm"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
          <ButtonGroupText className="h-7 min-w-0 whitespace-nowrap max-sm:max-w-44">
            <CalendarDays aria-hidden="true" />
            <span className="truncate first-letter:uppercase">{title}</span>
          </ButtonGroupText>
          <Button
            aria-label={t("nextPeriod")}
            onClick={() => controller.next()}
            size="icon-sm"
            variant="outline"
          >
            <ChevronRight />
          </Button>
        </ButtonGroup>

        {availableChannels.length > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={t("filterChannel")}
                className="relative"
                size="icon-sm"
                variant="outline"
              >
                <Funnel />
                {selectedAvailableChannels.length > 0 ? (
                  <Badge className="absolute -end-1.5 -top-1.5 size-4 justify-center rounded-full p-0 text-[0.625rem]">
                    {selectedAvailableChannels.length}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-3">
              <div className="flex flex-col gap-3">
                <div className="text-sm font-medium">{t("channels")}</div>
                {availableChannels.map((channel) => (
                  <div className="flex items-center gap-2" key={channel.key}>
                    <Checkbox
                      checked={selectedAvailableChannels.includes(channel.key)}
                      id={`channel-${channel.key}`}
                      onCheckedChange={(checked) =>
                        setSelectedChannels((current) => {
                          const selected = current.filter((provider) =>
                            availableChannels.some(
                              (available) => available.key === provider
                            )
                          )

                          return checked === true
                            ? [...selected, channel.key]
                            : selected.filter((item) => item !== channel.key)
                        })
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
                  disabled={selectedAvailableChannels.length === 0}
                  onClick={() => setSelectedChannels([])}
                  size="sm"
                  variant="outline"
                >
                  {t("clearFilters")}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={t("options")} size="icon-sm" variant="outline">
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>{t("viewLabel")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={(value) => controller.changeView(value)}
              value={viewKey}
            >
              {views.map((view) => (
                <DropdownMenuRadioItem key={view.key} value={view.key}>
                  {t(`view.${view.messageKey}` as "view.day")}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          className="ms-auto hidden sm:inline-flex"
          onClick={() =>
            onCreateAtDate(new Date(`${initialDate}T12:00:00`), true)
          }
          size="sm"
        >
          <Plus />
          {t("create")}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <EventCalendarViews
          controller={controller}
          dateClick={(info) => onCreateAtDate(info.date, info.allDay)}
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
          locale={dateLocale.fullCalendar}
          nowIndicator
          plugins={[...plugins]}
          popoverCloseContent={() => (
            <XIcon className="size-5 text-muted-foreground group-hover:text-foreground" />
          )}
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          slotHeaderFormat={{
            hour: "2-digit",
            hour12: false,
            minute: "2-digit",
          }}
          slotHeaderInterval="01:00:00"
          snapDuration="00:15:00"
        />
      </div>

      <FloatingActionButton
        label={t("create")}
        onClick={() =>
          onCreateAtDate(new Date(`${initialDate}T12:00:00`), true)
        }
        withSpacer={false}
      />
    </div>
  )
}
