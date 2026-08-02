"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@workspace/ui/lib/utils"
import { Button, buttonVariants } from "@workspace/ui/components/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      className={cn("p-2", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-4",
        month_caption:
          "flex h-8 items-center justify-center px-8 text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-8"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-8"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "flex-1 text-center text-xs font-normal text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "relative flex-1 p-0 text-center",
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-8 rounded-md aria-selected:bg-primary aria-selected:text-primary-foreground"
        ),
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground",
        today: "[&>button]:bg-muted [&>button]:text-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft
              className={cn("size-4", iconClassName)}
              {...iconProps}
            />
          ) : (
            <ChevronRight
              className={cn("size-4", iconClassName)}
              {...iconProps}
            />
          ),
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  )
}

export { Calendar }
