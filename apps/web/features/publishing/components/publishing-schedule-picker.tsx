"use client"

import { CalendarDays, Clock3 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

type PublishingSchedulePickerProps = {
  date: string
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  time: string
}

const hours = Array.from({ length: 24 }, (_, value) =>
  String(value).padStart(2, "0")
)
const minutes = ["00", "15", "30", "45"]

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
  const [hour, minute] = time.split(":")
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
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Select
            onValueChange={(value) =>
              onTimeChange(`${value}:${minute ?? "00"}`)
            }
            value={hour}
          >
            <SelectTrigger aria-label="Hora">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {hours.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Clock3 aria-hidden="true" className="text-muted-foreground" />
          <Select
            onValueChange={(value) => onTimeChange(`${hour ?? "00"}:${value}`)}
            value={minute}
          >
            <SelectTrigger aria-label="Minuto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {minutes.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </Field>
    </div>
  )
}
