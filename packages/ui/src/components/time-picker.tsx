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

const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hour = String(Math.floor(index / 4)).padStart(2, "0")
  const minute = String((index % 4) * 15).padStart(2, "0")
  return `${hour}:${minute}`
})

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
    <Select disabled={disabled} onValueChange={onValueChange} value={value}>
      <SelectTrigger
        aria-invalid={ariaInvalid}
        aria-label={`${hourLabel}: ${hour}, ${minuteLabel}: ${minute}`}
        aria-required={ariaRequired}
        className="w-full"
        id={id}
      >
        <Clock3 aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {timeOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export { TimePicker }
