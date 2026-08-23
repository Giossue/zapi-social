"use client"

import { Image, MoreHorizontal, MonitorPlay } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import type {
  PublishingAccount,
  PublishingProvider,
} from "@/features/publishing/types/publishing-calendar"

const providerLabels: Record<PublishingProvider, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
}

type PublishingNetworkPreviewProps = {
  accounts: PublishingAccount[]
  activeAccountId: string | null
  content: string
  hasMedia: boolean
  onAccountChange: (accountId: string) => void
  selectedAccountIds: string[]
}

function AccountInitials({ account }: { account: PublishingAccount }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
      {(account.assignedName ?? account.name).slice(0, 2).toUpperCase()}
    </span>
  )
}

function MediaPlaceholder({
  ratio,
}: {
  ratio: "facebook" | "instagram" | "whatsapp"
}) {
  const t = useTranslations("publishing.preview")
  const ratioClass =
    ratio === "instagram"
      ? "aspect-square"
      : ratio === "facebook"
        ? "aspect-[1.25/1]"
        : "aspect-[9/16]"

  return (
    <div
      className={`flex ${ratioClass} items-center justify-center bg-muted text-muted-foreground`}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <Image className="size-6" />
        <span className="text-xs">{t("mediaPreview")}</span>
      </div>
    </div>
  )
}

function InstagramPreview({
  account,
  content,
  hasMedia,
}: {
  account: PublishingAccount
  content: string
  hasMedia: boolean
}) {
  const t = useTranslations("publishing.preview")

  return (
    <Card variant="surface">
      <CardContent className="px-0">
        <div className="flex items-center gap-3 px-4 pb-3">
          <AccountInitials account={account} />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {account.assignedName ?? account.name}
          </p>
          <MoreHorizontal className="size-4 text-muted-foreground" />
        </div>
        <MediaPlaceholder ratio="instagram" />
        <div className="flex flex-col gap-2 px-4 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {providerLabels.instagram}
            </span>
            <span className="text-xs text-muted-foreground">{t("now")}</span>
          </div>
          <p className="text-sm leading-6 whitespace-pre-line">
            {content.trim() || t("contentPlaceholder")}
          </p>
          {hasMedia ? (
            <p className="text-xs text-muted-foreground">
              {t("mediaSelected")}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function FacebookPreview({
  account,
  content,
  hasMedia,
}: {
  account: PublishingAccount
  content: string
  hasMedia: boolean
}) {
  const t = useTranslations("publishing.preview")

  return (
    <Card variant="surface">
      <CardContent className="px-0">
        <div className="flex items-start gap-3 px-4 pb-3">
          <AccountInitials account={account} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {account.assignedName ?? account.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("nowPublic")}
            </p>
          </div>
          <MoreHorizontal className="size-4 text-muted-foreground" />
        </div>
        <p className="px-4 pb-3 text-sm leading-6 whitespace-pre-line">
          {content.trim() || t("contentPlaceholder")}
        </p>
        <MediaPlaceholder ratio="facebook" />
        <div className="grid grid-cols-3 border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
          <span>{t("like")}</span>
          <span>{t("comment")}</span>
          <span>{t("share")}</span>
        </div>
        {hasMedia ? (
          <p className="px-4 pb-3 text-xs text-muted-foreground">
            {t("mediaSelected")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function WhatsAppPreview({
  account,
  content,
  hasMedia,
}: {
  account: PublishingAccount
  content: string
  hasMedia: boolean
}) {
  const t = useTranslations("publishing.preview")

  return (
    <Card className="mx-auto w-full max-w-56 overflow-hidden" variant="surface">
      <CardContent className="relative px-0">
        <div className="relative bg-foreground text-background">
          <MediaPlaceholder ratio="whatsapp" />
          <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-foreground/80 px-3 py-3">
            <AccountInitials account={account} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {account.assignedName ?? account.name}
              </p>
              <p className="text-xs text-background/70">{t("statusNow")}</p>
            </div>
            <MoreHorizontal className="size-4" />
          </div>
          {content.trim() ? (
            <p className="absolute inset-x-3 bottom-3 rounded-lg bg-foreground/80 px-3 py-2 text-sm leading-5">
              {content}
            </p>
          ) : null}
        </div>
        {hasMedia ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {t("mediaSelected")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function PublishingNetworkPreview({
  accounts,
  activeAccountId,
  content,
  hasMedia,
  onAccountChange,
  selectedAccountIds,
}: PublishingNetworkPreviewProps) {
  const t = useTranslations("publishing.preview")
  const selectedAccounts = accounts.filter((account) =>
    selectedAccountIds.includes(account.id)
  )
  const activeAccount =
    selectedAccounts.find((account) => account.id === activeAccountId) ??
    selectedAccounts[0]

  return (
    <Card variant="inset">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {selectedAccounts.length === 0 || !activeAccount ? (
          <EmptyState
            description={t("emptyDescription")}
            icon={MonitorPlay}
            title={t("emptyTitle")}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {selectedAccounts.map((account) => (
                <Button
                  key={account.id}
                  onClick={() => onAccountChange(account.id)}
                  size="sm"
                  type="button"
                  variant={
                    activeAccount.id === account.id
                      ? "default"
                      : "brand-secondary"
                  }
                >
                  {account.assignedName ?? account.name} ·{" "}
                  {providerLabels[account.provider]}
                </Button>
              ))}
            </div>
            {activeAccount.provider === "instagram" ? (
              <InstagramPreview
                account={activeAccount}
                content={content}
                hasMedia={hasMedia}
              />
            ) : activeAccount.provider === "facebook" ? (
              <FacebookPreview
                account={activeAccount}
                content={content}
                hasMedia={hasMedia}
              />
            ) : (
              <WhatsAppPreview
                account={activeAccount}
                content={content}
                hasMedia={hasMedia}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Representación de formato; la red puede mostrar el contenido de
              forma distinta.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
