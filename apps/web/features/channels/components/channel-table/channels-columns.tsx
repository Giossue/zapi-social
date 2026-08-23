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

export const capabilityLabels = {
  facebook_page: "Página de Facebook",
  instagram_profile: "Perfil de Instagram",
  linkedin_page: "Página de LinkedIn",
  linkedin_profile: "Perfil de LinkedIn",
  x_profile: "Perfil de X",
  tiktok_profile: "Perfil de TikTok",
  whatsapp_status: "Historias de WhatsApp",
} as const

const providerLabels = {
  meta: "Meta",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  whatsapp: "Meta",
} as const

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

function formatConnectionDate(value: string) {
  const instant = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(instant)
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

function providerLabel(account: PortalChannelAccount) {
  return account.capabilityKey === "whatsapp_status"
    ? "Meta"
    : providerLabels[account.provider]
}

function StatusBadge({ status }: { status: PortalChannelAccount["status"] }) {
  const disconnected = status === "disconnected"

  return (
    <Badge variant={disconnected ? "warning" : "success"}>
      {disconnected ? "Desconectado" : "Conectado"}
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
  return (
    <div className="grid gap-0.5">
      <span className="whitespace-nowrap">
        {capabilityLabels[capabilityKey]}
      </span>
      <span className="text-xs text-muted-foreground">
        {providerLabels[provider]}
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
}: ChannelTableActions): ColumnDef<PortalChannelAccount>[] {
  return [
    {
      accessorKey: "displayName",
      header: "Cuenta",
      cell: ({ row }) => <AccountCell account={row.original} />,
    },
    {
      accessorKey: "capabilityKey",
      header: "Tipo de canal",
      cell: ({ row }) => (
        <CapabilityCell
          capabilityKey={row.original.capabilityKey}
          provider={row.original.provider}
        />
      ),
    },
    {
      accessorKey: "provider",
      header: "Proveedor",
      cell: ({ row }) => {
        const Icon = providerIcons[row.original.provider]

        return (
          <div className="flex items-center gap-2 text-sm">
            {Icon ? <Icon className="size-4 shrink-0" /> : null}
            {providerLabel(row.original)}
          </div>
        )
      },
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "connectedAt",
      header: "Conectado el",
      cell: ({ row }) => (
        <div className="text-sm text-foreground">
          {formatConnectionDate(row.original.connectedAt)}
        </div>
      ),
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
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
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() => onProfileSync(account)}
                  size="compact"
                >
                  <RefreshCw />
                  Actualizar
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
                  Eliminar
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
