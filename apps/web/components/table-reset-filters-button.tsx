"use client"

import { useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"

export function TableResetFiltersButton({
  onClickAction,
}: {
  onClickAction: () => void
}) {
  const t = useTranslations("common")

  return (
    <Button onClick={onClickAction} type="button" variant="outline">
      {t("resetFilters")}
    </Button>
  )
}
