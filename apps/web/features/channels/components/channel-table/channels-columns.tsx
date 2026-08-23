"use client"
"use no memo"

import type { ColumnDef, RowData } from "@tanstack/react-table"
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react"

import {
  BrandLinkedIn,
  BrandMeta,
  BrandTikTok,
  BrandX,
} from "@/components/brand-icons"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { useFormatter, useTranslations } from "next-intl"

import { useChannelLabels } from "@/lib/channel-labels"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import type { PortalChannelAccount } from "../../types/channels"

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string
  }
}

const providerIcons = {
  meta: BrandMeta,
  linkedin: BrandLinkedIn,
  x: BrandX,
  tiktok: BrandTikTok,
  whatsapp: BrandMeta,
} as const

export type ChannelTableActions = {
  onDelete: (account: PortalChannelAccount) => void
  onEdit: (account: PortalChannelAccount) => void
  onReconnect: (account: PortalChannelAccount) => void
  onProfileSync: (account: PortalChannelAccount) => void
  pendingAccountId: string | null
}

/** El backend envía fecha sola o instante completo. */
function connectionInstant(value: string) {
  return value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`)
}

function capabilityInitials(account: PortalChannelAccount) {
  return account.displayName
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

function StatusBadge({ status }: { status: PortalChannelAccount["status"] }) {
  const t = useTranslations("channels")
  const disconnected = status === "disconnected"

  return (
    <Badge variant={disconnected ? "warning" : "success"}>
      {disconnected ? t("status.disconnected") : t("status.connected")}
    </Badge>
  )
}

function AvatarCell({ account }: { account: PortalChannelAccount }) {
  return (
    <Avatar size="lg">
      {account.avatarUrl ? (
        <AvatarImage
          alt={`Avatar de ${account.displayName}`}
          src={account.avatarUrl}
        />
      ) : null}
      <AvatarFallback>{capabilityInitials(account)}</AvatarFallback>
    </Avatar>
  )
}

function AccountCell({ account }: { account: PortalChannelAccount }) {
  const handle = normalizedHandle(account.handle)
  const externalIdentity =
    account.capabilityKey === "facebook_page"
      ? account.externalName
      : account.capabilityKey === "whatsapp_status"
        ? whatsappPhone(handle)
        : handle
          ? `@${handle}`
          : null

  return (
    <div className="flex items-center gap-3">
      <AvatarCell account={account} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">
          {account.displayName}
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {externalIdentity ?? "—"}
        </div>
      </div>
    </div>
  )
}

function CapabilityCell({
  capabilityKey,
  provider,
}: Pick<PortalChannelAccount, "capabilityKey" | "provider">) {
  const labels = useChannelLabels()

  return (
    <div className="grid gap-0.5">
      <span className="whitespace-nowrap">
        {labels.capability(capabilityKey)}
      </span>
      <span className="text-xs text-muted-foreground">
        {labels.provider(provider)}
      </span>
    </div>
  )
}

export function createChannelsColumns({
  onDelete,
  onEdit,
  onReconnect,
  onProfileSync,
  pendingAccountId,
  labels,
  t,
  format,
}: ChannelTableActions & {
  labels: ReturnType<typeof useChannelLabels>
  t: ReturnType<typeof useTranslations<"channels">>
  format: ReturnType<typeof useFormatter>
}): ColumnDef<PortalChannelAccount>[] {
  return [
    {
      accessorKey: "displayName",
      header: t("account"),
      cell: ({ row }) => <AccountCell account={row.original} />,
    },
    {
      accessorKey: "capabilityKey",
      header: t("channelType"),
      cell: ({ row }) => (
        <CapabilityCell
          capabilityKey={row.original.capabilityKey}
          provider={row.original.provider}
        />
      ),
    },
    {
      accessorKey: "provider",
      header: t("provider"),
      cell: ({ row }) => {
        const Icon = providerIcons[row.original.provider]

        return (
          <div className="flex items-center gap-2 text-sm">
            {Icon ? <Icon className="size-4 shrink-0" /> : null}
            {row.original.capabilityKey === "whatsapp_status"
              ? "Meta"
              : labels.provider(row.original.provider)}
          </div>
        )
      },
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "status",
      header: t("statusColumn"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "connectedAt",
      header: t("connectedAt"),
      cell: ({ row }) => (
        <div className="text-sm text-foreground">
          {format.dateTime(connectionInstant(row.original.connectedAt), {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      ),
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">{t("actions")}</div>,
      cell: ({ row }) => {
        const account = row.original
        const pending = pendingAccountId === account.id
        const disconnected = account.status === "disconnected"

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={`Abrir acciones para ${account.displayName}`}
                  className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                  size="icon-sm"
                  variant="brand-secondary"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" size="compact">
                <DropdownMenuItem
                  onSelect={() => onEdit(account)}
                  size="compact"
                >
                  <Pencil />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() => onProfileSync(account)}
                  size="compact"
                >
                  <RefreshCw />
                  {t("refresh")}
                </DropdownMenuItem>
                {disconnected ? (
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={() => onReconnect(account)}
                    size="compact"
                  >
                    <RefreshCw />
                    Reconectar
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete(account)}
                  size="compact"
                  variant="destructive"
                >
                  <Trash2 />
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      enableHiding: false,
      enableSorting: false,
    },
  ]
}
