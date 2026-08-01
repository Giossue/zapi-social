"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/toast"
import {
  CheckCircle2,
  CircleAlert,
  Link2,
  LockKeyhole,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { channelsFixture } from "../fixtures/channels"
import type {
  PortalChannelAccount,
} from "../types/channels"
import { ChannelConnectionDialog } from "./channel-connection-dialog"
import { ChannelsLoading } from "./channels-loading"

const providerLabels = {
  meta: "Meta",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  whatsapp: "Historias de WhatsApp",
} as const

const capabilityLabels = {
  facebook_page: "Página de Facebook",
  instagram_profile: "Perfil de Instagram",
  linkedin_page: "Página de LinkedIn",
  linkedin_profile: "Perfil de LinkedIn",
  x_profile: "Perfil de X",
  tiktok_profile: "Perfil de TikTok",
  whatsapp_status: "Historias de WhatsApp",
} as const

function formatConnectionDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

function capabilityInitials(account: PortalChannelAccount) {
  return account.displayName
    .split(" ")
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()
}


function ChannelMetric({
  description,
  icon: Icon,
  value,
}: {
  description: string
  icon: typeof Link2
  value: number
}) {
  return (
    <Card variant="subtle">
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function ChannelAccountCard({
  account,
  onDelete,
  onEdit,
  onReconnect,
  pending,
}: {
  account: PortalChannelAccount
  onDelete: (account: PortalChannelAccount) => void
  onEdit: (account: PortalChannelAccount) => void
  onReconnect: (accountId: string) => void
  pending: boolean
}) {
  const disconnected = account.status === "disconnected"

  return (
    <Card variant="subtle">
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {capabilityInitials(account)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{account.displayName}</p>
              {account.handle ? (
                <p className="truncate text-sm text-muted-foreground">@{account.handle}</p>
              ) : null}
              <p className="truncate text-sm text-muted-foreground">
                {capabilityLabels[account.capabilityKey]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={disconnected ? "warning" : "success"}>
              {disconnected ? "Desconectado" : "Conectado"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label={`Acciones para ${account.displayName}`} size="icon" variant="brand-secondary">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" size="compact">
                <DropdownMenuItem onSelect={() => onEdit(account)} size="compact">
                  <Pencil />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(account)} size="compact">
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {disconnected ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>Este canal no puede publicar hasta reconectarse.</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Proveedor</p>
            <p className="mt-1 font-medium">{providerLabels[account.provider]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conectado el</p>
            <p className="mt-1 font-medium">{formatConnectionDate(account.connectedAt)}</p>
          </div>
        </div>

        <div className="mt-auto flex gap-2">
          {disconnected ? (
            <Button className="flex-1" disabled={pending} onClick={() => onReconnect(account.id)}>
              {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
              Reconectar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}


function EditChannelDialog({
  account,
  onOpenChange,
  onSave,
  pending,
}: {
  account: PortalChannelAccount | null
  onOpenChange: (open: boolean) => void
  onSave: (displayName: string) => void
  pending: boolean
}) {
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const displayName = String(new FormData(event.currentTarget).get("displayName") ?? "").trim()
    if (!displayName) {
      toast.error("Introduce un nombre visible para el canal.")
      return
    }
    onSave(displayName)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={account !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar canal</DialogTitle>
          <DialogDescription>Este cambio solo actualiza el nombre visible en Zapi.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>
              Nombre visible<span aria-hidden="true" className="ml-0.5 text-destructive">*</span>
            </span>
            <Input defaultValue={account?.displayName} key={account?.id} maxLength={255} name="displayName" required />
          </label>
          <div className="flex justify-end gap-2">
            <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="brand-secondary">Cancelar</Button>
            <Button disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}Guardar cambios</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


function DeleteChannelDialog({
  account,
  onConfirm,
  onOpenChange,
  pending,
}: {
  account: PortalChannelAccount | null
  onConfirm: () => void
  pending: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={account !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar canal</DialogTitle>
          <DialogDescription>
            {account
              ? `Eliminarás “${account.displayName}” de este espacio de trabajo. Esta acción no se puede deshacer.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="brand-secondary">Cancelar</Button>
          <Button disabled={pending} onClick={onConfirm} type="button" variant="destructive">
            {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LiveChannelsPage() {
  const [accounts, setAccounts] = useState<PortalChannelAccount[]>(
    () => [...channelsFixture.accounts]
  )
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [providerFilter, setProviderFilter] = useState("all")
  const [capabilityFilter, setCapabilityFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<PortalChannelAccount | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<PortalChannelAccount | null>(null)
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null)
  const [isFiltering, setIsFiltering] = useState(false)
  const hasMountedFilters = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!hasMountedFilters.current) {
      hasMountedFilters.current = true
      return
    }
    setIsFiltering(true)
    const timer = window.setTimeout(() => setIsFiltering(false), 250)
    return () => window.clearTimeout(timer)
  }, [query, providerFilter, capabilityFilter, statusFilter])

  const visibleAccounts = accounts.filter((account) => {
    const value = `${account.displayName} ${account.handle ?? ""} ${capabilityLabels[account.capabilityKey]}`.toLowerCase()
    return (
      value.includes(query.trim().toLowerCase()) &&
      (providerFilter === "all" || account.provider === providerFilter) &&
      (capabilityFilter === "all" || account.capabilityKey === capabilityFilter) &&
      (statusFilter === "all" || account.status === statusFilter)
    )
  })
  const connectedAccounts = accounts.filter((account) => account.status === "connected")
  const disconnectedAccounts = accounts.filter((account) => account.status === "disconnected")

  function openConnection() {
    setIsConnectOpen(true)
  }

  function addAccount(account: PortalChannelAccount) {
    setAccounts((current) => [
      ...current.filter((item) => item.id !== account.id),
      account,
    ])
  }

  async function reconnect(accountId: string) {
    setPendingAccountId(accountId)
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    setAccounts((current) =>
      current.map((account) =>
        account.id === accountId ? { ...account, status: "connected" } : account
      )
    )
    setPendingAccountId(null)
    toast.success("Canal reconectado en el mock.")
  }

  async function renameAccount(displayName: string) {
    if (!editingAccount) return
    setPendingAccountId(editingAccount.id)
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    setAccounts((current) => current.map((account) => account.id === editingAccount.id ? { ...account, displayName } : account))
    setPendingAccountId(null)
    setEditingAccount(null)
    toast.success("Nombre del canal actualizado en el mock.")
  }

  async function confirmDelete() {
    if (!deletingAccount) return
    setPendingAccountId(deletingAccount.id)
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    removeAccount(deletingAccount.id)
    setPendingAccountId(null)
    setDeletingAccount(null)
  }

  function removeAccount(accountId: string) {
    setAccounts((current) => current.filter((account) => account.id !== accountId))
    toast.success("Canal eliminado en el mock.")
  }

  if (isLoading) return <ChannelsLoading />

  if (!channelsFixture.canView) {
    return (
      <EmptyState
        description="Pide acceso a un administrador del espacio de trabajo."
        icon={LockKeyhole}
        title="No tienes acceso a los canales"
      />
    )
  }

  return (
    <div className="space-y-7">
      {channelsFixture.canManage ? (
        <div className="flex justify-end">
          <Button onClick={() => openConnection()} size="lg">
            <Plus data-icon="inline-start" />
            Conectar canal
          </Button>
        </div>
      ) : null}


      <section aria-label="Inventario de canales" className="space-y-4 border-t border-border pt-7">
        <div className="grid gap-3 sm:grid-cols-3">
          <ChannelMetric description="Canales registrados" icon={Link2} value={accounts.length} />
          <ChannelMetric description="Listos para publicar" icon={CheckCircle2} value={connectedAccounts.length} />
          <ChannelMetric description="Requieren reconexión" icon={CircleAlert} value={disconnectedAccounts.length} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_14rem_12rem]">
          <div className="relative">
            <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar canales" className="pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar canales" value={query} />
          </div>
          <Select onValueChange={setProviderFilter} value={providerFilter}>
            <SelectTrigger aria-label="Proveedor"><SelectValue placeholder="Proveedor" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los proveedores</SelectItem>{Object.entries(providerLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={setCapabilityFilter} value={capabilityFilter}>
            <SelectTrigger aria-label="Tipo de canal"><SelectValue placeholder="Tipo de canal" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{Object.entries(capabilityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={setStatusFilter} value={statusFilter}>
            <SelectTrigger aria-label="Estado"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="connected">Conectados</SelectItem><SelectItem value="disconnected">Desconectados</SelectItem></SelectContent>
          </Select>
        </div>

        {isFiltering ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {["one", "two", "three"].map((item) => <Skeleton className="h-64" key={item} />)}
          </div>
        ) : visibleAccounts.length > 0 ? (
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleAccounts.map((account) => (
              <ChannelAccountCard account={account} key={account.id} onDelete={setDeletingAccount} onEdit={setEditingAccount} onReconnect={(accountId) => void reconnect(accountId)} pending={pendingAccountId === account.id} />
            ))}
          </div>
        ) : (
          <Card variant="surface"><CardContent><EmptyState description={query ? "Prueba con otro término de búsqueda." : "Conecta un tipo de canal para empezar."} icon={Link2} title={query ? "No encontramos canales" : "Aún no hay canales"} /></CardContent></Card>
        )}
      </section>

      <EditChannelDialog account={editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)} onSave={(displayName) => void renameAccount(displayName)} pending={pendingAccountId === editingAccount?.id} />
      <DeleteChannelDialog account={deletingAccount} onConfirm={() => void confirmDelete()} onOpenChange={(open) => !open && setDeletingAccount(null)} pending={pendingAccountId === deletingAccount?.id} />

      <ChannelConnectionDialog
        capabilities={channelsFixture.capabilities}
        onConnected={addAccount}
        onOpenChange={(open) => {
          setIsConnectOpen(open)
        }}
        open={isConnectOpen}
      />
    </div>
  )
}
