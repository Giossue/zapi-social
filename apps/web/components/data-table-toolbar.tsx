"use client"

import { useTranslations } from "next-intl"

import { DataTableToolbar as DataTableToolbarPrimitive } from "@workspace/ui/components/data-table-controls"

export function DataTableToolbar(
  props: Omit<
    React.ComponentProps<typeof DataTableToolbarPrimitive>,
    "filtersLabel"
  >
) {
  const t = useTranslations("common")

  return (
    <DataTableToolbarPrimitive
      {...props}

      filtersLabel={t("filters")}
    />
  )
}
