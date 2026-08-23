"use client"

import { useTranslations } from "next-intl"
import { CircleAlert, FolderLock, Image, Search } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"

export function FilesPermissionState({ mode }: { mode: "library" | "search" }) {
  const t = useTranslations("files.states")
  const isSearch = mode === "search"

  return (
    <EmptyState
      description={isSearch ? t("searchForbidden") : t("libraryForbidden")}
      icon={isSearch ? Search : FolderLock}
      title={isSearch ? t("searchUnavailable") : t("libraryUnavailable")}
    />
  )
}

export function FilesErrorState({
  onRetry,
  section,
}: {
  onRetry: () => void
  section: "library" | "search"
}) {
  const t = useTranslations("files.states")

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t(`${section}LoadFailed`)}</AlertTitle>
      <AlertDescription>{t("loadFailedDescription")}</AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          <Image data-icon="inline-start" />
          {t("retry")}
        </Button>
      </div>
    </Alert>
  )
}
