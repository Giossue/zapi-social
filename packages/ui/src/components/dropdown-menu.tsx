"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@workspace/ui/lib/utils"

type DropdownMenuSize = "default" | "compact"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuSeparator = DropdownMenuPrimitive.Separator

function DropdownMenuContent({
  className,
  sideOffset = 8,
  size = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  size?: DropdownMenuSize
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-sm outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          size === "compact" ? "min-w-0 rounded-lg p-0.5" : "min-w-52",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  size?: DropdownMenuSize
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex cursor-default items-center gap-2 rounded-lg text-sm transition-colors outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        size === "compact"
          ? "h-8 gap-2 px-2 py-1 text-sm [&_svg]:size-4"
          : "px-2.5 py-2",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-lg py-2 pr-2.5 pl-8 text-sm transition-colors outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <DropdownMenuPrimitive.ItemIndicator className="absolute left-2.5 flex size-4 items-center justify-center text-primary">
        <Check className="size-3" />
      </DropdownMenuPrimitive.ItemIndicator>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuLabel({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  size?: DropdownMenuSize
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        size === "compact" ? "px-2 py-1.5 text-sm" : "px-2.5 py-2 text-sm",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
