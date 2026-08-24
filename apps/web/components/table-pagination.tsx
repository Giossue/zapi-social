"use client"

import { useTranslations } from "next-intl"

import { TablePagination as TablePaginationPrimitive } from "@workspace/ui/components/table-pagination"

export function TablePagination({
  itemLabel,
  rangeEnd,
  rangeStart,
  total,
  ...props
}: {
  itemLabel: string
  rangeEnd: number
  rangeStart: number
  total: number
  canGoNext: boolean
  canGoPrevious: boolean
  onNextPage: () => void
  onPreviousPage: () => void
}) {
  const t = useTranslations("common.pagination")

  return (
    <TablePaginationPrimitive
      {...props}
      rangeLabel={
        total > 0
          ? t("range", { from: rangeStart, to: rangeEnd, total })
          : t("empty", { items: itemLabel })
      }
    />
  )
}
