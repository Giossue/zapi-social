import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

type CollectionHeaderProps = ComponentPropsWithoutRef<"header"> & {
  description?: ReactNode
  level?: "h1" | "h2"
  title: ReactNode
}

function CollectionHeader({
  className,
  description,
  level = "h1",
  title,
  ...props
}: CollectionHeaderProps) {
  const Heading = level

  return (
    <header className={cn("flex flex-col gap-1", className)} {...props}>
      <Heading
        className={cn(
          "font-heading font-semibold tracking-tight",
          level === "h1" ? "text-2xl" : "text-lg"
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  )
}

export { CollectionHeader }
export type { CollectionHeaderProps }
