"use client"

import { Clock3 } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

const hours = Array.from({ length: 24 }, (_, value) =>
  String(value).padStart(2, "0")
)
const minutes = ["00", "15", "30", "45"]

type TimePickerProps = {
  "aria-invalid"?: boolean
  "aria-required"?: boolean
  id?: string
  onValueChange: (value: string) => void
  value: string
}

function TimePicker({
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  id,
  onValueChange,
  value,
}: TimePickerProps) {
  const [hour = "00", minute = "00"] = value.split(":")

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <Select
        onValueChange={(nextHour) => onValueChange(`${nextHour}:${minute}`)}
        value={hour}
      >
        <SelectTrigger
          aria-invalid={ariaInvalid}
          aria-label="Hora"
          aria-required={ariaRequired}
          id={id}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {hours.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Clock3 aria-hidden="true" className="text-muted-foreground" />
      <Select
        onValueChange={(nextMinute) => onValueChange(`${hour}:${nextMinute}`)}
        value={minute}
      >
        <SelectTrigger
          aria-invalid={ariaInvalid}
          aria-label="Minuto"
          aria-required={ariaRequired}
          id={id ? `${id}-minute` : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {minutes.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export { TimePicker }
