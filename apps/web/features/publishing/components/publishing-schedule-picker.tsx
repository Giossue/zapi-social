"use client"

import { CalendarDays } from "lucide-react"
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
  onDateChange,
  onTimeChange,
  time,
}: PublishingSchedulePickerProps) {
  const selectedDate = new Date(`${date}T12:00:00`)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel>Fecha</FieldLabel>
        <Popover>
          <PopoverTrigger asChild>
            <Button className="justify-start" variant="surface">
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
        <FieldLabel>Hora</FieldLabel>
        <TimePicker onValueChange={onTimeChange} value={time} />
      </Field>
    </div>
  )
}
