"use client"

import {
  ApiError,
  channelConnectionsApi,
  channelsApi,
} from "@workspace/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
  TriangleAlert,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { channelsFixture } from "../fixtures/channels"
import type {
  ChannelCapabilityKey,
  PortalChannelAccount,
  PortalChannelCapability,
} from "../types/channels"
import {
  ChannelConnectionDialog,
  type MetaPickerSession,
} from "./channel-connection-dialog"
import { ChannelsLoading } from "./channels-loading"

const META_OAUTH_SESSION_KEY = "zapi:channels:meta-oauth"
const CHANNELS_PAGE_SIZE = 12

type ChannelsResponse = Awaited<ReturnType<typeof channelsApi.list>>
type ChannelsSummary = ChannelsResponse["summary"]
type ChannelsPagination = ChannelsResponse["pagination"]

const providerLabels = {
  meta: "Meta",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  whatsapp: "Meta",
} as const

const providerFilterOptions = [
  ["meta", "Meta"],
  ["linkedin", "LinkedIn"],
  ["x", "X"],
  ["tiktok", "TikTok"],
] as const

const capabilityLabels = {
  facebook_page: "Página de Facebook",
  instagram_profile: "Perfil de Instagram",
  linkedin_page: "Página de LinkedIn",
  linkedin_profile: "Perfil de LinkedIn",
  x_profile: "Perfil de X",
  tiktok_profile: "Perfil de TikTok",
  whatsapp_status: "Historias de WhatsApp",
} as const

type MetaOAuthSession = {
  connectionId: string
  capabilityKey: ChannelCapabilityKey
}

function formatConnectionDate(value: string) {
  const instant = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`)
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
  return account.capabilityKey === "whatsapp_status" ? "Meta" : providerLabels[account.provider]
}

function AccountAvatar({ account }: { account: PortalChannelAccount }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-accent-foreground">
      <span aria-hidden="true">{capabilityInitials(account)}</span>
      {account.avatarUrl ? (
        <img
          alt={`Avatar de ${account.displayName}`}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
          src={account.avatarUrl}
        />
      ) : null}
    </span>
  )
}

function toPortalAccount(
  account: Awaited<ReturnType<typeof channelsApi.update>>
): PortalChannelAccount {
  return {
    id: account.id,
    capabilityKey: account.capabilityKey,
    provider: account.provider,
    displayName: account.displayName,
    externalName: account.externalName,
    handle: account.handle ?? undefined,
    avatarUrl: account.avatarUrl,
    status: account.status,
    connectedAt: account.createdAt,
  }
}

function toPortalCapability(
  capability: Awaited<
    ReturnType<typeof channelsApi.list>
  >["capabilities"][number]
): PortalChannelCapability {
  const reference = channelsFixture.capabilities.find(
    (item) => item.key === capability.key
  )
  if (!reference)
    throw new Error(`Unsupported channel capability: ${capability.key}`)
  return { ...capability, icon: reference.icon }
}

function metaOAuthPickerCapability(
  capabilityKey: ChannelCapabilityKey
): PortalChannelCapability | null {
  const reference = channelsFixture.capabilities.find(
    (item) => item.key === capabilityKey
  )
  if (!reference || reference.provider !== "meta") return null
  return { ...reference, connectionKind: "oauth_picker", candidates: undefined }
}

function clearMetaOAuthReturnUrl() {
  const canonicalPath = "/portal/channels"
  const hasFacebookReturnHash = window.location.hash === "#_=_"

  if (
    window.location.pathname !== canonicalPath ||
    window.location.search ||
    hasFacebookReturnHash
  ) {
    window.history.replaceState(window.history.state, "", canonicalPath)
  }
}

function readMetaOAuthSession(): MetaOAuthSession | null {
  try {
    const value = window.sessionStorage.getItem(META_OAUTH_SESSION_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<MetaOAuthSession>
    if (!parsed.connectionId || !parsed.capabilityKey) return null
    return {
      connectionId: parsed.connectionId,
      capabilityKey: parsed.capabilityKey,
    }
  } catch {
    return null
  }
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
  onProfileSync,
  pending,
}: {
  account: PortalChannelAccount
  onDelete: (account: PortalChannelAccount) => void
  onEdit: (account: PortalChannelAccount) => void
  onReconnect: (account: PortalChannelAccount) => void
  onProfileSync: (account: PortalChannelAccount) => void
  pending: boolean
}) {
  const disconnected = account.status === "disconnected"
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
    <Card variant="subtle">
      <CardContent className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AccountAvatar account={account} />
            <div className="min-h-16 min-w-0">
              <p className="truncate font-semibold">{account.displayName}</p>
              <p className="min-h-5 truncate text-sm text-muted-foreground">
                {externalIdentity ?? <span aria-hidden="true">&nbsp;</span>}
              </p>
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
                <Button
                  aria-label={`Acciones para ${account.displayName}`}
                  size="icon"
                  variant="brand-secondary"
                >
                  <MoreVertical />
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
                  Actualizar perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onDelete(account)}
                  size="compact"
                >
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {disconnected ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>Este canal no puede publicar hasta reconectarse.</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Proveedor</p>
            <p className="mt-1 font-medium">
              {providerLabel(account)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conectado el</p>
            <p className="mt-1 font-medium">
              {formatConnectionDate(account.connectedAt)}
            </p>
          </div>
        </div>
        {disconnected ? (
          <div className="mt-auto flex gap-2">
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() => onReconnect(account)}
            >
              {pending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Reconectar
            </Button>
          </div>
        ) : null}
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
    const displayName = String(
      new FormData(event.currentTarget).get("displayName") ?? ""
    ).trim()
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
          <DialogDescription>
            Este cambio solo actualiza el nombre visible en Zapi.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>
              Nombre visible
              <span aria-hidden="true" className="ml-0.5 text-destructive">
                *
              </span>
            </span>
            <Input
              defaultValue={account?.displayName}
              key={account?.id}
              maxLength={255}
              name="displayName"
              required
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? (
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
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="brand-secondary"
          >
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LiveChannelsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<PortalChannelAccount[]>([])
  const [capabilities, setCapabilities] = useState<PortalChannelCapability[]>(
    []
  )
  const [summary, setSummary] = useState<ChannelsSummary>({
    total: 0,
    connected: 0,
    disconnected: 0,
  })
  const [pagination, setPagination] = useState<ChannelsPagination>({
    limit: CHANNELS_PAGE_SIZE,
    nextCursor: null,
  })
  const [cursor, setCursor] = useState<string | undefined>()
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    []
  )
  const [canManage, setCanManage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [hasPermission, setHasPermission] = useState(true)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [providerFilter, setProviderFilter] = useState("all")
  const [capabilityFilter, setCapabilityFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  const [whatsappReconnectAccountId, setWhatsappReconnectAccountId] = useState<string | null>(null)
  const [editingAccount, setEditingAccount] =
    useState<PortalChannelAccount | null>(null)
  const [deletingAccount, setDeletingAccount] =
    useState<PortalChannelAccount | null>(null)
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null)
  const [isFiltering, setIsFiltering] = useState(false)
  const [metaPickerSession, setMetaPickerSession] =
    useState<MetaPickerSession | null>(null)
  const hasLoadedChannels = useRef(false)
  const requestSequence = useRef(0)
  const handledOAuthOutcome = useRef<string | null>(null)

  const loadChannels = useCallback(async () => {
    const requestId = ++requestSequence.current
    const isInitialLoad = !hasLoadedChannels.current

    if (isInitialLoad) setIsLoading(true)
    else setIsFiltering(true)
    setHasError(false)

    try {
      const response = await channelsApi.list({
        q: debouncedQuery.trim() || undefined,
        provider:
          providerFilter === "all"
            ? undefined
            : (providerFilter as ChannelsResponse["accounts"][number]["provider"]),
        capability:
          capabilityFilter === "all"
            ? undefined
            : (capabilityFilter as ChannelsResponse["accounts"][number]["capabilityKey"]),
        status:
          statusFilter === "all"
            ? undefined
            : (statusFilter as ChannelsResponse["accounts"][number]["status"]),
        limit: CHANNELS_PAGE_SIZE,
        cursor,
      })
      if (requestId !== requestSequence.current) return

      const portalCapabilities = response.capabilities.map(toPortalCapability)
      setAccounts(response.accounts.map(toPortalAccount))
      setCapabilities(portalCapabilities)
      setSummary(response.summary)
      setPagination(response.pagination)
      setCanManage(response.canManage)
      setHasPermission(true)
    } catch (error) {
      if (requestId !== requestSequence.current) return
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setHasPermission(false)
        return
      }
      console.error("Channels request failed", error)
      toast.error("No pudimos cargar tus canales. Inténtalo de nuevo.")
      setHasError(true)
    } finally {
      if (requestId !== requestSequence.current) return
      hasLoadedChannels.current = true
      setIsLoading(false)
      setIsFiltering(false)
    }
  }, [
    capabilityFilter,
    cursor,
    debouncedQuery,
    providerFilter,
    router,
    statusFilter,
  ])

  useEffect(() => {
    void loadChannels()
  }, [loadChannels])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
      setCursor(undefined)
      setCursorHistory([])
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  function resetPagination() {
    setCursor(undefined)
    setCursorHistory([])
  }

  function goToNextPage() {
    if (!pagination.nextCursor) return
    setCursorHistory((history) => [...history, cursor])
    setCursor(pagination.nextCursor)
  }

  function goToPreviousPage() {
    if (cursorHistory.length === 0) return
    setCursor(cursorHistory[cursorHistory.length - 1])
    setCursorHistory((history) => history.slice(0, -1))
  }

  useEffect(() => {
    const outcome = searchParams.get("oauth")
    if (!outcome) {
      handledOAuthOutcome.current = null
      if (window.location.hash === "#_=_") {
        clearMetaOAuthReturnUrl()
      }
      return
    }
    if (handledOAuthOutcome.current === outcome) return
    handledOAuthOutcome.current = outcome
    clearMetaOAuthReturnUrl()

    if (outcome === "denied" || outcome === "failed") {
      window.sessionStorage.removeItem(META_OAUTH_SESSION_KEY)
      toast.error(
        outcome === "denied"
          ? "La autorización con Meta fue cancelada."
          : "No pudimos completar la autorización con Meta."
      )
      return
    }

    if (outcome !== "authorized") {
      window.sessionStorage.removeItem(META_OAUTH_SESSION_KEY)
      toast.error("No pudimos completar la autorización con Meta.")
      return
    }

    const session = readMetaOAuthSession()
    if (!session) {
      return
    }

    void (async () => {
      try {
        const response = await channelConnectionsApi.candidates(
          session.connectionId
        )
        const capability =
          capabilities.find((item) => item.key === session.capabilityKey) ??
          metaOAuthPickerCapability(session.capabilityKey)
        if (!capability || capability.provider !== "meta")
          throw new Error("Missing Meta capability")
        setMetaPickerSession({
          capability,
          connectionId: response.connectionId,
          candidates: response.candidates.map((candidate) => ({
            ...candidate,
            avatarUrl: candidate.avatarUrl ?? null,
            metadata: candidate.metadata ?? undefined,
          })),
        })
        setIsConnectOpen(true)
      } catch (error) {
        window.sessionStorage.removeItem(META_OAUTH_SESSION_KEY)
        console.error("Meta candidates request failed", error)
        toast.error(
          "No pudimos recuperar las cuentas de Meta autorizadas. Inténtalo de nuevo."
        )
      }
    })()
  }, [capabilities, router, searchParams])

  function addAccount(account: PortalChannelAccount) {
    setAccounts((current) => [
      ...current.filter((item) => item.id !== account.id),
      account,
    ])
  }

  function beginMetaAuthorization(
    result: Awaited<ReturnType<typeof channelConnectionsApi.startMeta>>,
    capability: PortalChannelCapability
  ) {
    window.sessionStorage.setItem(
      META_OAUTH_SESSION_KEY,
      JSON.stringify({
        connectionId: result.connection.id,
        capabilityKey: capability.key,
      } satisfies MetaOAuthSession)
    )
    window.location.assign(result.authorizationUrl)
  }

  async function reconnect(account: PortalChannelAccount) {
    if (account.capabilityKey === "whatsapp_status") {
      setWhatsappReconnectAccountId(account.id)
      setIsConnectOpen(true)
      return
    }

    setPendingAccountId(account.id)
    try {
      const result = await channelsApi.reconnect(account.id)
      const capability = metaOAuthPickerCapability(account.capabilityKey)
      if (!capability) throw new Error("Missing Meta capability")
      beginMetaAuthorization(result, capability)
    } catch (error) {
      console.error("Channel reconnect failed", error)
      toast.error(
        "No pudimos iniciar la reconexión del canal. Inténtalo de nuevo."
      )
      setPendingAccountId(null)
    }
  }

  async function refreshProfile(account: PortalChannelAccount) {
    setPendingAccountId(account.id)
    try {
      await channelsApi.requestProfileSync(account.id)
      toast.success("Actualización de perfil programada. Puede tardar unos minutos.")
    } catch (error) {
      if (error instanceof ApiError && error.code === "CHANNEL_PROFILE_SYNC_COOLDOWN") {
        toast.error("Ya solicitaste una actualización. Inténtalo de nuevo en 15 minutos.")
      } else {
        console.error("Channel profile sync request failed", error)
        toast.error("No pudimos programar la actualización del perfil.")
      }
    } finally {
      setPendingAccountId(null)
    }
  }

  async function renameAccount(displayName: string) {
    if (!editingAccount) return
    setPendingAccountId(editingAccount.id)
    try {
      const updated = await channelsApi.update(editingAccount.id, {
        displayName,
      })
      addAccount(toPortalAccount(updated))
      setEditingAccount(null)
      toast.success("Nombre del canal actualizado.")
    } catch (error) {
      console.error("Channel update failed", error)
      toast.error("No pudimos actualizar el canal. Inténtalo de nuevo.")
    } finally {
      setPendingAccountId(null)
    }
  }

  async function confirmDelete() {
    if (!deletingAccount) return
    setPendingAccountId(deletingAccount.id)
    try {
      await channelsApi.remove(deletingAccount.id)
      setDeletingAccount(null)
      toast.success("Canal eliminado.")
      await loadChannels()
    } catch (error) {
      console.error("Channel delete failed", error)
      toast.error("No pudimos eliminar el canal. Inténtalo de nuevo.")
    } finally {
      setPendingAccountId(null)
    }
  }

  async function completeMetaConnection() {
    await loadChannels()
    window.sessionStorage.removeItem(META_OAUTH_SESSION_KEY)
    setMetaPickerSession(null)
    setIsConnectOpen(false)
  }

  function cancelMetaConnection() {
    window.sessionStorage.removeItem(META_OAUTH_SESSION_KEY)
    setMetaPickerSession(null)
  }

  if (isLoading) return <ChannelsLoading />
  if (!hasPermission)
    return (
      <EmptyState
        description="Pide acceso a un administrador del espacio de trabajo."
        icon={LockKeyhole}
        title="No tienes acceso a los canales"
      />
    )
  if (hasError)
    return (
      <EmptyState
        description="Comprueba tu conexión e inténtalo de nuevo."
        icon={TriangleAlert}
        title="No pudimos cargar los canales"
        action={<Button onClick={() => void loadChannels()}>Reintentar</Button>}
      />
    )

  return (
    <div className="space-y-7">
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={() => setIsConnectOpen(true)} size="lg">
            <Plus data-icon="inline-start" />
            Conectar canal
          </Button>
        </div>
      ) : null}
      <section
        aria-label="Inventario de canales"
        className="space-y-4 border-t border-border pt-7"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <ChannelMetric
            description="Canales registrados"
            icon={Link2}
            value={summary.total}
          />
          <ChannelMetric
            description="Listos para publicar"
            icon={CheckCircle2}
            value={summary.connected}
          />
          <ChannelMetric
            description="Requieren reconexión"
            icon={CircleAlert}
            value={summary.disconnected}
          />
        </div>
        <p className="text-sm text-muted-foreground">La información de perfil se actualiza automáticamente cada 24 horas. También puedes solicitar una actualización por canal cada 15 minutos.</p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_14rem_12rem]">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Buscar canales"
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar canales"
              value={query}
            />
          </div>
          <Select
            onValueChange={(value) => {
              setProviderFilter(value)
              resetPagination()
            }}
            value={providerFilter}
          >
            <SelectTrigger aria-label="Proveedor">
              <SelectValue placeholder="Proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proveedores</SelectItem>
              {providerFilterOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => {
              setCapabilityFilter(value)
              resetPagination()
            }}
            value={capabilityFilter}
          >
            <SelectTrigger aria-label="Tipo de canal">
              <SelectValue placeholder="Tipo de canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {Object.entries(capabilityLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => {
              setStatusFilter(value)
              resetPagination()
            }}
            value={statusFilter}
          >
            <SelectTrigger aria-label="Estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="connected">Conectados</SelectItem>
              <SelectItem value="disconnected">Desconectados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isFiltering ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {["one", "two", "three"].map((item) => (
              <Skeleton className="h-64" key={item} />
            ))}
          </div>
        ) : accounts.length > 0 ? (
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <ChannelAccountCard
                account={account}
                key={account.id}
                onDelete={setDeletingAccount}
                onEdit={setEditingAccount}
                onReconnect={(account) => void reconnect(account)}
                onProfileSync={(account) => void refreshProfile(account)}
                pending={pendingAccountId === account.id}
              />
            ))}
          </div>
        ) : (
          <Card variant="surface">
            <CardContent>
              <EmptyState
                description={
                  query
                    ? "Prueba con otro término de búsqueda."
                    : "Conecta un tipo de canal para empezar."
                }
                icon={Link2}
                title={query ? "No encontramos canales" : "Aún no hay canales"}
              />
            </CardContent>
          </Card>
        )}
        {summary.total > CHANNELS_PAGE_SIZE ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{`${cursorHistory.length * CHANNELS_PAGE_SIZE + 1}-${Math.min(cursorHistory.length * CHANNELS_PAGE_SIZE + accounts.length, summary.total)} de ${summary.total}`}</p>
            <div className="flex gap-2">
              <Button
                disabled={isFiltering || cursorHistory.length === 0}
                onClick={goToPreviousPage}
                type="button"
                variant="brand-secondary"
              >
                Anterior
              </Button>
              <Button
                disabled={isFiltering || !pagination.nextCursor}
                onClick={goToNextPage}
                type="button"
                variant="brand-secondary"
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      <EditChannelDialog
        account={editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        onSave={(displayName) => void renameAccount(displayName)}
        pending={pendingAccountId === editingAccount?.id}
      />
      <DeleteChannelDialog
        account={deletingAccount}
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        pending={pendingAccountId === deletingAccount?.id}
      />
      <ChannelConnectionDialog
        capabilities={capabilities}
        metaPickerSession={metaPickerSession}
        onConnected={addAccount}
        onMetaAuthorizationStart={beginMetaAuthorization}
        onMetaConnectionCancelled={cancelMetaConnection}
        onMetaConnectionCompleted={completeMetaConnection}
        onWhatsAppConnectionCompleted={async () => { await loadChannels() }}
        onOpenChange={(open) => {
          setIsConnectOpen(open)
          if (!open) setWhatsappReconnectAccountId(null)
        }}
        open={isConnectOpen}
        whatsappReconnectAccountId={whatsappReconnectAccountId}
      />
    </div>
  )
}
