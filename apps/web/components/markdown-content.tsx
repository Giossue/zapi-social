"use client"

import { Streamdown } from "streamdown"

import { cn } from "@workspace/ui/lib/utils"

export function MarkdownContent({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <Streamdown
      linkSafety={{ enabled: false }}
      mode="static"
      className={cn(
        "w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      {children}
    </Streamdown>
  )
}
