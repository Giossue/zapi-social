"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useTranslations } from "next-intl"

import type { BoardColumn } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetActions,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"

export function ColumnOrderSheet({
  columns,
  onMove,
  onOpenChange,
  open,
}: {
  columns: readonly BoardColumn[]
  onMove: (columnId: string, direction: "up" | "down") => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const t = useTranslations("boards")

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("orderColumnsTitle")}</SheetTitle>
          <SheetDescription>{t("orderColumnsDescription")}</SheetDescription>
        </SheetHeader>
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
          {columns.map((column, index) => (
            <li
              className="flex items-center gap-3 rounded-lg border px-3 py-2"
              key={column.id}
            >
              <span className="w-5 text-sm text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {column.name}
              </span>
              <Button
                aria-label={t("moveColumnUp", { name: column.name })}
                disabled={index === 0}
                onClick={() => onMove(column.id, "up")}
                size="icon"
                type="button"
                variant="brand-secondary"
              >
                <ChevronUp aria-hidden="true" />
              </Button>
              <Button
                aria-label={t("moveColumnDown", { name: column.name })}
                disabled={index === columns.length - 1}
                onClick={() => onMove(column.id, "down")}
                size="icon"
                type="button"
                variant="brand-secondary"
              >
                <ChevronDown aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <SheetActions>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="brand-secondary"
          >
            {t("closeSheet")}
          </Button>
        </SheetActions>
      </SheetContent>
    </Sheet>
  )
}
