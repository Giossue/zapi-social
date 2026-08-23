"use client"

import { CalendarDays } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { TimePicker } from "@workspace/ui/components/time-picker"

type PublishingSchedulePickerProps = {
  date: string
  isRequired?: boolean
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  time: string
}

function toDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-")
}

export function PublishingSchedulePicker({
  date,
  isRequired = false,
  onDateChange,
  onTimeChange,
  time,
}: PublishingSchedulePickerProps) {
  const t = useTranslations("publishing.schedule")
  const tCommon = useTranslations("common")
  const selectedDate = new Date(`${date}T12:00:00`)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel>
          {t("date")}{" "}
          {isRequired ? (
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          ) : null}
        </FieldLabel>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              aria-required={isRequired}
              className="justify-start"
              role="combobox"
              type="button"
              variant="surface"
            >
              <CalendarDays data-icon="inline-start" />
              {selectedDate.toLocaleDateString("es", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              onSelect={(nextDate) =>
                nextDate && onDateChange(toDateKey(nextDate))
              }
              selected={selectedDate}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field>
        <FieldLabel htmlFor="publishing-scheduled-time">
          {t("time")}{" "}
          {isRequired ? (
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          ) : null}
        </FieldLabel>
        <TimePicker
          hourLabel={tCommon("hour")}
          minuteLabel={tCommon("minute")}
          aria-required={isRequired}
          id="publishing-scheduled-time"
          onValueChange={onTimeChange}
          value={time}
        />
      </Field>
    </div>
  )
}
