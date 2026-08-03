import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const cardVariants = cva(
  "flex flex-col gap-6 rounded-xl py-6 text-card-foreground",
  {
    variants: {
      variant: {
        default: "border bg-card shadow-sm",
        subtle: "border bg-card shadow-xs",
        surface: "border bg-card shadow-none",
        outline: "border bg-transparent shadow-none",
        interactive:
          "border bg-background shadow-none transition-colors group-hover:border-primary/50 group-hover:bg-primary/15 group-hover:text-primary group-hover:[&_p]:text-primary group-hover:[&_svg]:text-primary",
        inset: "border bg-background shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      className={cn(cardVariants({ variant }), className)}
      data-slot="card"
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid grid-rows-[auto_auto] items-start gap-1.5 px-6",
        className
      )}
      data-slot="card-header"
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("leading-none font-semibold tracking-tight", className)}
      data-slot="card-title"
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      data-slot="card-description"
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-6", className)}
      data-slot="card-content"
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center px-6", className)}
      data-slot="card-footer"
      {...props}
    />
  )
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
