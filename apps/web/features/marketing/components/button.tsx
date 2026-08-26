import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

const marketingButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap ring-offset-background transition-all duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:opacity-70 hover:ring-4 hover:ring-primary/10",
        blue: "border border-input bg-primary text-primary-foreground hover:bg-primary/90",
        white: "bg-foreground text-background hover:opacity-70",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        subtle:
          "border border-input bg-accent/20 hover:bg-white/10 hover:text-accent-foreground",
        ghost: "hover:bg-white/10 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-7 px-2",
        sm: "h-8 px-3",
        lg: "h-10 px-8",
        xl: "h-12 px-10",
        icon: "size-8",
        iconlg: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function MarketingButton({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof marketingButtonVariants>) {
  return (
    <button
      className={cn(marketingButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { MarketingButton, marketingButtonVariants }
