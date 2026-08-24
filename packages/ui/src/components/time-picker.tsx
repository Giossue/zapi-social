"use client"

import { Input } from "@workspace/ui/components/input"

type TimePickerProps = {
  "aria-invalid"?: boolean
  "aria-required"?: boolean
  disabled?: boolean
  id?: string
  onValueChange: (value: string) => void
  value: string
}

function TimePicker({
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  disabled,
  id,
  onValueChange,
  value,
}: TimePickerProps) {
  return (
    <Input
      aria-invalid={ariaInvalid}
      aria-required={ariaRequired}
      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      disabled={disabled}
      id={id}
      onChange={(event) => onValueChange(event.target.value)}
      step={60}
      type="time"
      value={value}
    />
  )
}

export { TimePicker }
