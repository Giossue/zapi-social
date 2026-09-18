"use client"

import { useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"

export function TableResetFiltersButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("common")

  return (
    <Button onClick={onClick} type="button" variant="outline">
      {t("resetFilters")}
    </Button>
  )
}
