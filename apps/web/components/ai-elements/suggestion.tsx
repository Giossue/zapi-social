"use client"

import { useCallback, type ComponentProps } from "react"

import { Button } from "@workspace/ui/components/button"
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"

export type SuggestionsProps = ComponentProps<typeof ScrollArea> & {
  wrap?: boolean
}

export function Suggestions({
  className,
  children,
  wrap = false,
  ...props
}: SuggestionsProps) {
  return (
    <ScrollArea
      className={cn("w-full", !wrap && "overflow-x-auto whitespace-nowrap")}
      {...props}
    >
      <div
        className={cn(
          wrap
            ? "flex w-full flex-wrap items-center justify-center gap-2"
            : "flex w-max flex-nowrap items-center gap-2",
          className
        )}
      >
        {children}
      </div>
      {wrap ? null : <ScrollBar className="hidden" orientation="horizontal" />}
    </ScrollArea>
  )
}

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  onClick?: (suggestion: string) => void
  suggestion: string
}

export function Suggestion({
  suggestion,
  onClick,
  className,
  variant = "brand-secondary",
  size = "sm",
  children,
  ...props
}: SuggestionProps) {
  const handleClick = useCallback(() => {
    onClick?.(suggestion)
  }, [onClick, suggestion])

  return (
    <Button
      className={cn("cursor-pointer rounded-full px-4", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children ?? suggestion}
    </Button>
  )
}
