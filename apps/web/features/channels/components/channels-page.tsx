"use client"

import { ApiError, channelsApi } from "@workspace/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/toast"
import {
  CalendarClock,
  CheckCircle2,
  CirclePause,
  Inbox,
  Link2,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ChannelConnectionDialog } from "./channel-connection-dialog"
import { ChannelsLoading } from "./channels-loading"
import type {
  ChannelAccount,
  ChannelList,
  ChannelStatus,
} from "../types/channels"

type Filters = {
  q: string
  status: "all" | ChannelStatus
  provider: string
  sort: "latest" | "name"
}

const initialFilters: Filters = {
  q: "",
  status: "all",
  provider: "all",
  sort: "latest",
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 403)
    return "No tienes permiso para administrar canales."
  if (error instanceof ApiError && error.status === 404)
    return "El canal ya no está disponible en este espacio."
  return fallback
}

function channelInitials(account: ChannelAccount) {
  return account.displayName
    .split(" ")
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function ChannelMetric({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Link2
  label: string
  value: number
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-4 text-sm font-medium">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function EditChannelDialog({
  account,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  account: ChannelAccount | null
  onOpenChange: (open: boolean) => void
  onSubmit: (displayName: string) => Promise<void>
  submitting: boolean
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await onSubmit(String(form.get("displayName") ?? "").trim())
  }

  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar nombre del canal</DialogTitle>
          <DialogDescription>
            El proveedor y el tipo de canal se conservan sin cambios.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <label
            className="grid gap-1.5 text-sm font-medium"
            htmlFor="edit-channel-display-name"
          >
            Nombre visible
            <Input
              defaultValue={account?.displayName}
              id="edit-channel-display-name"
              key={account?.id}
              name="displayName"
              required
              maxLength={255}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteChannelDialog({
  account,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  account: ChannelAccount | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  submitting: boolean
}) {
  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar canal</DialogTitle>
          <DialogDescription>
            {account
              ? `Eliminarás “${account.displayName}” de este espacio. Esta acción no se puede deshacer.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            disabled={submitting}
            onClick={() => void onConfirm()}
            variant="destructive"
          >
            {submitting ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            Eliminar canal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LiveChannelsPage() {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<ChannelList | null>(null)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<ChannelAccount | null>(
    null
  )
  const [deletingAccount, setDeletingAccount] = useState<ChannelAccount | null>(
    null
  )
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const hasActiveFilters =
    filters.q.trim().length > 0 ||
    filters.status !== "all" ||
    filters.provider !== "all"

  const loadChannels = useCallback(
    async (nextFilters: Filters) => {
      setIsLoading(true)
      setHasError(false)
      try {
        const nextDashboard = await channelsApi.list({
          q: nextFilters.q || undefined,
          status: nextFilters.status === "all" ? undefined : nextFilters.status,
          provider:
            nextFilters.provider === "all" ? undefined : nextFilters.provider,
          sort: nextFilters.sort,
        })
        setDashboard(nextDashboard)
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === "AUTH_SESSION_EXPIRED"
        ) {
          router.replace("/login")
          return
        }
        console.error("Channels request failed", error)
        toast.error(
          errorMessage(
            error,
            "No pudimos cargar los canales. Inténtalo de nuevo."
          )
        )
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    },
    [router]
  )

  useEffect(() => {
    void loadChannels(filters)
  }, [filters, loadChannels])

  async function saveName(displayName: string) {
    if (!editingAccount) return
    setPendingAction(editingAccount.id)
    try {
      await channelsApi.update(editingAccount.id, { displayName })
      setEditingAccount(null)
      toast.success("Nombre del canal actualizado.")
      await loadChannels(filters)
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos actualizar el canal."))
    } finally {
      setPendingAction(null)
    }
  }

  async function changeStatus(account: ChannelAccount) {
    setPendingAction(account.id)
    try {
      if (account.status === "active") {
        await channelsApi.pause(account.id)
        toast.success("Canal pausado.")
      } else {
        await channelsApi.resume(account.id)
        toast.success("Canal reanudado.")
      }
      await loadChannels(filters)
    } catch (error) {
      toast.error(
        errorMessage(error, "No pudimos cambiar el estado del canal.")
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function deleteChannel() {
    if (!deletingAccount) return
    setPendingAction(deletingAccount.id)
    try {
      await channelsApi.remove(deletingAccount.id)
      setDeletingAccount(null)
      toast.success("Canal eliminado.")
      await loadChannels(filters)
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos eliminar el canal."))
    } finally {
      setPendingAction(null)
    }
  }

  if (isLoading && !dashboard) return <ChannelsLoading />

  if (hasError || !dashboard) {
    return (
      <EmptyState
        action={
          <Button onClick={() => void loadChannels(filters)}>Reintentar</Button>
        }
        description="Comprueba tu conexión e inténtalo de nuevo. No se modificó ningún canal."
        icon={TriangleAlert}
        title="No pudimos cargar los canales"
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Canales</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los destinos conectados de este espacio de trabajo.
          </p>
        </div>
        {dashboard.canManage ? (
          <Button
            disabled={
              !dashboard.canConnect || dashboard.readyProviders.length === 0
            }
            onClick={() => setIsConnectOpen(true)}
            size="lg"
          >
            <Plus data-icon="inline-start" />
            Conectar canal
          </Button>
        ) : null}
      </div>

      {!dashboard.canManage ? (
        <p className="text-sm text-muted-foreground">
          Solo propietarios y administradores pueden administrar canales.
        </p>
      ) : !dashboard.canConnect || dashboard.readyProviders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Configura y habilita Meta o LinkedIn en Integraciones antes de
          conectar un canal.
        </p>
      ) : null}

      <section
        aria-label="Resumen de canales"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <ChannelMetric
          description="Destinos registrados en este espacio"
          icon={Link2}
          label="Total"
          value={dashboard.metrics.total}
        />
        <ChannelMetric
          description="Canales disponibles"
          icon={CheckCircle2}
          label="Activos"
          value={dashboard.metrics.active}
        />
        <ChannelMetric
          description="Canales detenidos temporalmente"
          icon={CirclePause}
          label="En pausa"
          value={dashboard.metrics.paused}
        />
        <ChannelMetric
          description="Añadidos durante los últimos 30 días"
          icon={CalendarClock}
          label="Recientes"
          value={dashboard.metrics.recent}
        />
      </section>

      <section aria-label="Inventario de canales" className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Buscar canales"
              className="pl-9"
              onChange={(event) =>
                setFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Buscar por nombre, usuario o proveedor"
              value={filters.q}
            />
          </div>
          <Select
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: value as Filters["status"],
              }))
            }
            value={filters.status}
          >
            <SelectTrigger aria-label="Estado" className="w-full lg:w-44">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="paused">En pausa</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) =>
              setFilters((current) => ({ ...current, provider: value }))
            }
            value={filters.provider}
          >
            <SelectTrigger aria-label="Proveedor" className="w-full lg:w-44">
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proveedores</SelectItem>
              {dashboard.providers.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                sort: value as Filters["sort"],
              }))
            }
            value={filters.sort}
          >
            <SelectTrigger
              aria-label="Ordenar canales"
              className="w-full lg:w-40"
            >
              <SelectValue placeholder="Más recientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Más recientes</SelectItem>
              <SelectItem value="name">Nombre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {dashboard.accounts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {dashboard.accounts.map((account) => {
              const pending = pendingAction === account.id
              return (
                <Card key={account.id}>
                  <CardContent className="space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                          {channelInitials(account)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {account.displayName}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {account.handle ? `@${account.handle} · ` : ""}
                            {account.capabilityKey}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          account.status === "active" ? "success" : "warning"
                        }
                      >
                        {account.status === "active" ? "Activo" : "En pausa"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.providerKey}
                    </p>
                    {dashboard.canManage ? (
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          aria-label={`Editar ${account.displayName}`}
                          disabled={pending}
                          onClick={() => setEditingAccount(account)}
                          size="icon"
                          variant="brand-secondary"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          aria-label={
                            account.status === "active"
                              ? `Pausar ${account.displayName}`
                              : `Reanudar ${account.displayName}`
                          }
                          disabled={pending}
                          onClick={() => void changeStatus(account)}
                          size="icon"
                          variant="brand-secondary"
                        >
                          {pending ? (
                            <LoaderCircle className="animate-spin" />
                          ) : account.status === "active" ? (
                            <Pause />
                          ) : (
                            <Play />
                          )}
                        </Button>
                        <Button
                          aria-label={`Eliminar ${account.displayName}`}
                          disabled={pending}
                          onClick={() => setDeletingAccount(account)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent>
              <EmptyState
                action={
                  hasActiveFilters ? (
                    <Button
                      onClick={() => setFilters(initialFilters)}
                      variant="brand-secondary"
                    >
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
                description={
                  hasActiveFilters
                    ? "Ajusta los filtros para ver otros canales."
                    : "Conecta un canal para empezar a gestionar destinos."
                }
                icon={Inbox}
                title={
                  hasActiveFilters
                    ? "Ningún canal coincide con esta vista"
                    : "Aún no hay canales"
                }
              />
            </CardContent>
          </Card>
        )}
      </section>

      <ChannelConnectionDialog
        onOpenChange={setIsConnectOpen}
        open={isConnectOpen}
        readyProviders={dashboard.readyProviders}
      />
      <EditChannelDialog
        account={editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        onSubmit={saveName}
        submitting={pendingAction === editingAccount?.id}
      />
      <DeleteChannelDialog
        account={deletingAccount}
        onConfirm={deleteChannel}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        submitting={pendingAction === deletingAccount?.id}
      />
    </div>
  )
}
