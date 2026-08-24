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
  disabled?: boolean
  hourLabel: string
  minuteLabel: string
  id?: string
  onValueChange: (value: string) => void
  value: string
}

function TimePicker({
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  disabled,
  hourLabel,
  minuteLabel,
  id,
  onValueChange,
  value,
}: TimePickerProps) {
  const [hour = "00", minute = "00"] = value.split(":")

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <Select
        disabled={disabled}
        onValueChange={(nextHour) => onValueChange(`${nextHour}:${minute}`)}
        value={hour}
      >
        <SelectTrigger
          aria-invalid={ariaInvalid}
          aria-label={hourLabel}
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
        disabled={disabled}
        onValueChange={(nextMinute) => onValueChange(`${hour}:${nextMinute}`)}
        value={minute}
      >
        <SelectTrigger
          aria-invalid={ariaInvalid}
          aria-label={minuteLabel}
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
