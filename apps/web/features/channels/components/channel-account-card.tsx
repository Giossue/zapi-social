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
  CardDescription,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

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
      <CardHeader className="flex flex-row items-center gap-3">
        <Avatar size="lg">
          {account.avatarUrl ? (
            <AvatarImage
              alt={t("avatarAlt", { name: account.displayName })}
              src={account.avatarUrl}
            />
          ) : null}
          <AvatarFallback>{initials(account.displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <CardTitle className="truncate">{account.displayName}</CardTitle>
            </TooltipTrigger>
            <TooltipContent side="top">{account.displayName}</TooltipContent>
          </Tooltip>
          {identity ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <CardDescription className="truncate">
                  {identity}
                </CardDescription>
              </TooltipTrigger>
              <TooltipContent side="top">{identity}</TooltipContent>
            </Tooltip>
          ) : (
            <CardDescription>—</CardDescription>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <Badge asChild variant={disconnected ? "warning" : "success"}>
              <TooltipTrigger>
                {disconnected
                  ? t("status.disconnected")
                  : t("status.connected")}
              </TooltipTrigger>
            </Badge>
            <TooltipContent
              align="end"
              className="flex-col items-start gap-2"
              sideOffset={6}
            >
              <div className="grid gap-0.5">
                <span className="font-semibold">{t("channelType")}</span>
                <span>{labels.capability(account.capabilityKey)}</span>
              </div>
              <div className="grid gap-0.5">
                <span className="font-semibold">{t("provider")}</span>
                <span>{provider}</span>
              </div>
              <div className="grid gap-0.5">
                <span className="font-semibold">{t("connectedAt")}</span>
                <span>
                  {format.dateTime(connectionInstant(account.connectedAt), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
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
        </div>
      </CardHeader>
    </Card>
  )
}
