"use client"

import {
  ApiError,
  channelConnectionsApi,
  channelsApi,
} from "@workspace/api-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { Link2, LockKeyhole, Save, Trash2, TriangleAlert } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"

import { channelsFixture } from "../fixtures/channels"
import type {
  ChannelCapabilityKey,
  PortalChannelAccount,
  PortalChannelCapability,
} from "../types/channels"
import {
  capabilityLabels,
  type ChannelTableActions,
} from "./channel-table/channels-columns"
import { ChannelsUsers } from "./channel-table/channels-users"
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

const providerFilterOptions = [
  ["meta", "Meta"],
  ["linkedin", "LinkedIn"],
  ["x", "X"],
  ["tiktok", "TikTok"],
] as const

type MetaOAuthSession = {
  connectionId: string
  capabilityKey: ChannelCapabilityKey
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
  const [displayName, setDisplayName] = useState(account?.displayName ?? "")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedDisplayName = displayName.trim()
    if (!normalizedDisplayName) {
      toast.error("Introduce un nombre visible para el canal.")
      return
    }
    onSave(normalizedDisplayName)
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
        <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="channel-display-name">
                Nombre visible
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FieldLabel>
              <Input
                aria-required="true"
                id="channel-display-name"
                maxLength={255}
                name="displayName"
                onChange={(event) => setDisplayName(event.target.value)}
                value={displayName}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={pending || !displayName.trim()} type="submit">
              {pending ? (
                <Spinner
                  aria-label="Guardando nombre del canal"
                  data-icon="inline-start"
                />
              ) : (
                <Save data-icon="inline-start" />
              )}
              Guardar cambios
            </Button>
          </DialogFooter>
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
    <AlertDialog onOpenChange={onOpenChange} open={account !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Eliminar canal</AlertDialogTitle>
          <AlertDialogDescription>
            {account
              ? `Eliminarás “${account.displayName}” de este espacio de trabajo. Esta acción no se puede deshacer.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={onConfirm}
            variant="destructive"
          >
            {pending ? (
              <Spinner aria-label="Eliminando canal" data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
  const [whatsappReconnectAccountId, setWhatsappReconnectAccountId] = useState<
    string | null
  >(null)
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
      toast.success(
        "Actualización de perfil programada. Puede tardar unos minutos."
      )
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "CHANNEL_PROFILE_SYNC_COOLDOWN"
      ) {
        toast.error(
          "Ya solicitaste una actualización. Inténtalo de nuevo en 15 minutos."
        )
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

  const rangeStart = accounts.length
    ? cursorHistory.length * CHANNELS_PAGE_SIZE + 1
    : 0
  const rangeEnd = accounts.length
    ? Math.min(
        cursorHistory.length * CHANNELS_PAGE_SIZE + accounts.length,
        summary.total
      )
    : 0
  const tableActions: ChannelTableActions = {
    onDelete: setDeletingAccount,
    onEdit: setEditingAccount,
    onReconnect: (account) => void reconnect(account),
    onProfileSync: (account) => void refreshProfile(account),
    pendingAccountId,
  }

  if (isLoading) return <ChannelsLoading />
  if (!hasPermission)
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Pide acceso a un administrador del espacio de trabajo."
            icon={LockKeyhole}
            title="No tienes acceso a los canales"
          />
        </CardContent>
      </Card>
    )
  if (hasError)
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={<RetryButton onClick={() => void loadChannels()} />}
            description="Comprueba tu conexión e inténtalo de nuevo."
            icon={TriangleAlert}
            title="No pudimos cargar los canales"
          />
        </CardContent>
      </Card>
    )

  return (
    <>
      <ChannelsUsers
        accounts={accounts}
        canGoNext={pagination.nextCursor !== null}
        canGoPrevious={cursorHistory.length > 0}
        canManage={canManage}
        capabilityFilter={capabilityFilter}
        capabilityOptions={Object.entries(capabilityLabels)}
        emptyState={
          <EmptyState
            description={
              query
                ? "Prueba con otro término de búsqueda."
                : "Conecta un tipo de canal para empezar."
            }
            icon={Link2}
            title={query ? "No encontramos canales" : "Aún no hay canales"}
          />
        }
        isFiltering={isFiltering}
        onCapabilityFilterChange={(value) => {
          setCapabilityFilter(value)
          resetPagination()
        }}
        onConnect={() => setIsConnectOpen(true)}
        onNextPage={goToNextPage}
        onPreviousPage={goToPreviousPage}
        onProviderFilterChange={(value) => {
          setProviderFilter(value)
          resetPagination()
        }}
        onQueryChange={setQuery}
        onStatusFilterChange={(value) => {
          setStatusFilter(value)
          resetPagination()
        }}
        providerFilter={providerFilter}
        providerOptions={providerFilterOptions}
        query={query}
        rangeEnd={rangeEnd}
        rangeStart={rangeStart}
        statusFilter={statusFilter}
        tableActions={tableActions}
        total={summary.total}
      />
      <EditChannelDialog
        account={editingAccount}
        key={editingAccount?.id ?? "closed"}
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
        onWhatsAppConnectionCompleted={async () => {
          await loadChannels()
        }}
        onOpenChange={(open) => {
          setIsConnectOpen(open)
          if (!open) setWhatsappReconnectAccountId(null)
        }}
        open={isConnectOpen}
        whatsappReconnectAccountId={whatsappReconnectAccountId}
      />
    </>
  )
}
