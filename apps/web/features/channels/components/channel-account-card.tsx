"use client"

import { MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"

import { useChannelLabels } from "@/lib/channel-labels"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import type { PortalChannelAccount } from "../types/channels"

export type ChannelCardActions = {
  onDelete: (account: PortalChannelAccount) => void
  onEdit: (account: PortalChannelAccount) => void
  onReconnect: (account: PortalChannelAccount) => void
  onProfileSync: (account: PortalChannelAccount) => void
  pendingAccountId: string | null
}

function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function normalizedHandle(handle?: string | null) {
  const value = handle?.replace(/^@+/, "").trim()
  return value || null
}

function whatsappPhone(handle?: string | null) {
  const value = normalizedHandle(handle)
  if (!value) return null
  const digits = (value.split("@", 1)[0] ?? "").replace(/\D/g, "")
  return digits ? `+${digits}` : value
}

function connectionInstant(value: string) {
  return value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`)
}

function externalIdentity(account: PortalChannelAccount) {
  const handle = normalizedHandle(account.handle)

  if (account.capabilityKey === "facebook_page") return account.externalName
  if (account.capabilityKey === "whatsapp_status") return whatsappPhone(handle)
  return handle ? `@${handle}` : null
}

export function ChannelAccountCard({
  account,
  onDelete,
  onEdit,
  onReconnect,
  onProfileSync,
  pendingAccountId,
}: { account: PortalChannelAccount } & ChannelCardActions) {
  const t = useTranslations("channels")
  const labels = useChannelLabels()
  const format = useFormatter()
  const disconnected = account.status === "disconnected"
  const identity = externalIdentity(account)
  const provider =
    account.capabilityKey === "whatsapp_status"
      ? "Meta"
      : labels.provider(account.provider)
  const pending = pendingAccountId === account.id

  return (
    <Card className="h-full" variant="subtle">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <Avatar size="lg">
            {account.avatarUrl ? (
              <AvatarImage
                alt={t("avatarAlt", { name: account.displayName })}
                src={account.avatarUrl}
              />
            ) : null}
            <AvatarFallback>{initials(account.displayName)}</AvatarFallback>
          </Avatar>
          <Badge variant={disconnected ? "warning" : "success"}>
            {disconnected ? t("status.disconnected") : t("status.connected")}
          </Badge>
        </div>
        <CardTitle className="truncate">{account.displayName}</CardTitle>
        <CardDescription className="truncate">
          {identity || "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid flex-1 gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("channelType")}
          </span>
          <span className="line-clamp-2 font-medium">
            {labels.capability(account.capabilityKey)}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("provider")}</span>
          <span className="truncate font-medium">{provider}</span>
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t("connectedAt")}</p>
          <p className="truncate text-sm">
            {format.dateTime(connectionInstant(account.connectedAt), {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("openActions", { name: account.displayName })}
              size="icon-sm"
              variant="brand-secondary"
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onEdit(account)}>
                <Pencil />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => onProfileSync(account)}
              >
                <RefreshCw />
                {t("refresh")}
              </DropdownMenuItem>
              {disconnected ? (
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() => onReconnect(account)}
                >
                  <RefreshCw />
                  {t("reconnect")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => onDelete(account)}
                variant="destructive"
              >
                <Trash2 />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  )
}
