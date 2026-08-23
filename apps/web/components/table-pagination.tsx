"use client"

import { useTranslations } from "next-intl"

import { TablePagination as TablePaginationPrimitive } from "@workspace/ui/components/table-pagination"

/**
 * Aporta el idioma al primitive de `packages/ui`, que no puede depender de
 * `next-intl`: es un paquete de tokens y primitives, no de features.
 *
 * Las rutas de Portal y Admin importan este envoltorio, no el primitive, para
 * que el rango («1-1 de 1») y el vacío («0 canales») salgan en el idioma
 * activo sin repetir el mismo mensaje en cada tabla.
 */
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
