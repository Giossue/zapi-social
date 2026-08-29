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
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { LockKeyhole, Save, Share2, Trash2, TriangleAlert } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"

import { capabilityKeys, useChannelLabels } from "@/lib/channel-labels"

import { channelsFixture } from "../fixtures/channels"
import type {
  ChannelCapabilityKey,
  PortalChannelAccount,
  PortalChannelCapability,
} from "../types/channels"
import { type ChannelCardActions } from "./channel-account-card"
import { ChannelsUsers } from "./channels-users"
import {
  ChannelConnectionDialog,
  type MetaPickerSession,
} from "./channel-connection-dialog"
import { ChannelsLoading } from "./channels-loading"
import { loginPath } from "@/features/identity/login-redirect"

const META_OAUTH_SESSION_KEY = "zapi:channels:meta-oauth"

type ChannelsResponse = Awaited<ReturnType<typeof channelsApi.list>>

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
  return { ...reference, connectionKind: "oauth_picker" }
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

function EditChannelSheet({
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
  const t = useTranslations("channels")
  const [displayName, setDisplayName] = useState(account?.displayName ?? "")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedDisplayName = displayName.trim()
    if (!normalizedDisplayName) {
      toast.error(t("nameRequired"))
      return
    }
    onSave(normalizedDisplayName)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={account !== null}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("editTitle")}</SheetTitle>
          <SheetDescription>{t("renameHint")}</SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={submit}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup className="gap-4">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="channel-display-name">
                  {t("displayName")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="channel-display-name"
                  maxLength={255}
                  name="displayName"
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetActions>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={pending || !displayName.trim()} type="submit">
              {pending ? (
                <Spinner
                  aria-label={t("savingName")}
                  data-icon="inline-start"
                />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {t("saveChanges")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
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
  const t = useTranslations("channels")

  return (
    <AlertDialog onOpenChange={onOpenChange} open={account !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {account
              ? t("deleteDescription", { name: account.displayName })
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={onConfirm}
            variant="destructive"
          >
            {pending ? (
              <Spinner aria-label={t("deleting")} data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function LiveChannelsPage() {
  const t = useTranslations("channels")
  const labels = useChannelLabels()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<PortalChannelAccount[]>([])
  const [capabilities, setCapabilities] = useState<PortalChannelCapability[]>(
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
      const filters = {
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
        limit: 50,
      }
      const response = await channelsApi.list(filters)
      if (requestId !== requestSequence.current) return

      const allAccounts = [...response.accounts]
      let nextCursor = response.pagination.nextCursor

      while (nextCursor) {
        const nextPage = await channelsApi.list({
          ...filters,
          cursor: nextCursor,
        })
        if (requestId !== requestSequence.current) return
        allAccounts.push(...nextPage.accounts)
        nextCursor = nextPage.pagination.nextCursor
      }

      const portalCapabilities = response.capabilities.map(toPortalCapability)
      setAccounts(allAccounts.map(toPortalAccount))
      setCapabilities(portalCapabilities)
      setCanManage(response.canManage)
      setHasPermission(true)
    } catch (error) {
      if (requestId !== requestSequence.current) return
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setHasPermission(false)
        return
      }
      console.error("Channels request failed", error)
      toast.error(t("loadFailed"))
      setHasError(true)
    } finally {
      if (requestId === requestSequence.current) {
        hasLoadedChannels.current = true
        setIsLoading(false)
        setIsFiltering(false)
      }
    }
  }, [
    capabilityFilter,
    debouncedQuery,
    providerFilter,
    router,
    statusFilter,
    t,
  ])

  useEffect(() => {
    const timer = setTimeout(() => void loadChannels(), 0)
    return () => clearTimeout(timer)
  }, [loadChannels])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

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
      toast.error(outcome === "denied" ? t("metaCancelled") : t("metaFailed"))
      return
    }

    if (outcome !== "authorized") {
      window.sessionStorage.removeItem(META_OAUTH_SESSION_KEY)
      toast.error(t("metaFailed"))
      return
    }

    if (searchParams.get("provider") !== "meta") {
      window.sessionStorage.removeItem(META_OAUTH_SESSION_KEY)
      toast.success(t("channelConnected"))
      window.setTimeout(() => void loadChannels(), 0)
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
        toast.error(t("metaAccountsFailed"))
      }
    })()
  }, [capabilities, loadChannels, router, searchParams, t])

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
      toast.error(t("reconnectFailed"))
      setPendingAccountId(null)
    }
  }

  async function refreshProfile(account: PortalChannelAccount) {
    setPendingAccountId(account.id)
    try {
      await channelsApi.requestProfileSync(account.id)
      toast.success(t("profileSyncQueued"))
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "CHANNEL_PROFILE_SYNC_COOLDOWN"
      ) {
        toast.error(t("profileSyncCooldown"))
      } else {
        console.error("Channel profile sync request failed", error)
        toast.error(t("profileSyncFailed"))
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
      toast.success(t("nameUpdated"))
    } catch (error) {
      console.error("Channel update failed", error)
      toast.error(t("updateFailed"))
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
      toast.success(t("deleted"))
      await loadChannels()
    } catch (error) {
      console.error("Channel delete failed", error)
      toast.error(t("deleteFailed"))
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

  const cardActions: ChannelCardActions = {
    onDelete: setDeletingAccount,
    onEdit: setEditingAccount,
    onReconnect: (account) => void reconnect(account),
    onProfileSync: (account) => void refreshProfile(account),
    pendingAccountId,
  }
  const hasActiveFilters =
    query.length > 0 ||
    providerFilter !== "all" ||
    capabilityFilter !== "all" ||
    statusFilter !== "all"

  if (isLoading) return <ChannelsLoading />
  if (!hasPermission)
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={LockKeyhole}
            title={t("forbiddenTitle")}
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
            description={t("loadFailedDescription")}
            icon={TriangleAlert}
            title={t("loadFailedTitle")}
          />
        </CardContent>
      </Card>
    )

  return (
    <>
      <ChannelsUsers
        accounts={accounts}
        canManage={canManage}
        capabilityFilter={capabilityFilter}
        capabilityOptions={capabilityKeys.map((key) => [
          key,
          labels.capability(key),
        ])}
        emptyState={
          <EmptyState
            description={
              hasActiveFilters
                ? t("emptyFilteredDescription")
                : t("emptyDescription")
            }
            icon={Share2}
            title={hasActiveFilters ? t("noMatches") : t("emptyTitle")}
          />
        }
        isFiltering={isFiltering}
        onCapabilityFilterChange={(value) => {
          setCapabilityFilter(value)
        }}
        onConnect={() => setIsConnectOpen(true)}
        onProviderFilterChange={(value) => {
          setProviderFilter(value)
        }}
        onQueryChange={setQuery}
        onStatusFilterChange={(value) => {
          setStatusFilter(value)
        }}
        providerFilter={providerFilter}
        providerOptions={providerFilterOptions}
        query={query}
        statusFilter={statusFilter}
        cardActions={cardActions}
      />
      <EditChannelSheet
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
