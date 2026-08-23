"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  CircleAlert,
  Copy,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { ApiError, automationApi } from "@workspace/api-client"
import type {
  AutomationPermission,
  AutomationWebhookEvent,
  PortalAutomationResponse,
} from "@workspace/contracts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"
import { loginPath } from "@/features/identity/login-redirect"

type PortalAutomationApiKey = PortalAutomationResponse["apiKeys"][number]
type PortalAutomationWebhook = PortalAutomationResponse["webhooks"][number]

const permissions: AutomationPermission[] = [
  "accounts:read",
  "posts:read",
  "posts:write",
]

const events: AutomationWebhookEvent[] = [
  "post.created",
  "post.published",
  "post.failed",
]

const pageSize = 10

function paginate<T>(items: readonly T[], page: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = items.slice((safePage - 1) * pageSize, safePage * pageSize)
  const rangeStart = items.length ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = items.length ? rangeStart + visible.length - 1 : 0
  return { pageCount, rangeEnd, rangeStart, safePage, visible }
}

/** El copiado recibe sus mensajes ya traducidos por quien lo invoca. */
async function copyValue(
  value: string,
  messages: { copied: string; failed: string; unsupported: string }
) {
  if (!navigator.clipboard) {
    toast.error(messages.unsupported)
    return
  }
  try {
    await navigator.clipboard.writeText(value)
    toast.success(messages.copied)
  } catch {
    toast.error(messages.failed)
  }
}

function SecretRevealSheet({
  description,
  label,
  onOpenChange,
  value,
}: {
  description: string
  label: string
  onOpenChange: (open: boolean) => void
  value: string | null
}) {
  const t = useTranslations("automation")
  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(value)}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <Card variant="inset">
            <CardContent className="flex items-center gap-3 py-4">
              <code className="min-w-0 flex-1 font-mono text-sm break-all">
                {value}
              </code>
              <Button
                onClick={() =>
                  void copyValue(value ?? "", {
                    copied: t("copied", { label }),
                    failed: t("copyFailed"),
                    unsupported: t("clipboardUnsupported"),
                  })
                }
                size="icon-sm"
                variant="brand-secondary"
              >
                <Copy />
                <span className="sr-only">{t("copy", { label })}</span>
              </Button>
            </CardContent>
          </Card>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button onClick={() => onOpenChange(false)}>{t("saved")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ApiKeySheet({
  onCreate,
  onOpenChange,
  open,
  pending,
}: {
  onCreate: (input: {
    name: string
    permissions: AutomationPermission[]
  }) => Promise<boolean>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
}) {
  const t = useTranslations("automation")
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<AutomationPermission[]>([
    "posts:read",
  ])

  useEffect(() => {
    if (!open) {
      setName("")
      setSelected(["posts:read"])
    }
  }, [open])

  const canSubmit = Boolean(name.trim() && selected.length)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(t("keyRequired"))
      return
    }
    const created = await onCreate({
      name: name.trim(),
      permissions: selected,
    })
    if (created) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("newKeyTitle")}</SheetTitle>
          <SheetDescription>{t("newKeyDescription")}</SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="api-key-name">
                  Nombre{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="api-key-name"
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("keyNamePlaceholder")}
                  value={name}
                />
              </Field>
              <FieldSet>
                <FieldLabel asChild>
                  <legend>
                    Permisos{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </legend>
                </FieldLabel>
                <FieldGroup className="gap-3" data-slot="checkbox-group">
                  {permissions.map((permission) => {
                    const controlId = `api-key-${permission}`
                    return (
                      <Field key={permission} orientation="horizontal">
                        <Checkbox
                          checked={selected.includes(permission)}
                          disabled={pending}
                          id={controlId}
                          onCheckedChange={(value) =>
                            setSelected((current) =>
                              value === true
                                ? [...current, permission]
                                : current.filter((item) => item !== permission)
                            )
                          }
                        />
                        <FieldLabel htmlFor={controlId}>
                          <FieldContent>
                            <FieldTitle>
                              {t(`permission.${permission}`)}
                            </FieldTitle>
                            <FieldDescription>{permission}</FieldDescription>
                          </FieldContent>
                        </FieldLabel>
                      </Field>
                    )
                  })}
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              Crear clave
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function WebhookSheet({
  onOpenChange,
  onSubmit,
  open,
  pending,
  webhook,
}: {
  onOpenChange: (open: boolean) => void
  onSubmit: (input: {
    name: string
    url: string
    events: AutomationWebhookEvent[]
  }) => Promise<boolean>
  open: boolean
  pending: boolean
  webhook: PortalAutomationWebhook | null
}) {
  const t = useTranslations("automation")
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [selected, setSelected] = useState<AutomationWebhookEvent[]>([])

  useEffect(() => {
    if (!open) return
    setName(webhook?.name ?? "")
    setUrl(webhook?.url ?? "")
    setSelected(webhook ? [...webhook.events] : ["post.published"])
  }, [open, webhook])

  const canSubmit = Boolean(name.trim() && url.trim() && selected.length)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(t("webhookRequired"))
      return
    }
    const saved = await onSubmit({
      events: selected,
      name: name.trim(),
      url: url.trim(),
    })
    if (saved) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>
            {webhook ? t("editWebhookTitle") : t("newWebhookTitle")}
          </SheetTitle>
          <SheetDescription>{t("webhookDescription")}</SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="webhook-name">
                  Nombre{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="webhook-name"
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("webhookNamePlaceholder")}
                  value={name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="webhook-url">
                  URL{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="webhook-url"
                  maxLength={2048}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://ejemplo.com/zapi"
                  type="url"
                  value={url}
                />
              </Field>
              <FieldSet>
                <FieldLabel asChild>
                  <legend>
                    Eventos{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </legend>
                </FieldLabel>
                <FieldGroup className="gap-3" data-slot="checkbox-group">
                  {events.map((event) => {
                    const controlId = `webhook-${event}`
                    return (
                      <Field key={event} orientation="horizontal">
                        <Checkbox
                          checked={selected.includes(event)}
                          disabled={pending}
                          id={controlId}
                          onCheckedChange={(value) =>
                            setSelected((current) =>
                              value === true
                                ? [...current, event]
                                : current.filter((item) => item !== event)
                            )
                          }
                        />
                        <FieldLabel htmlFor={controlId}>
                          <FieldContent>
                            <FieldTitle>{t(`event.${event}`)}</FieldTitle>
                            <FieldDescription>{event}</FieldDescription>
                          </FieldContent>
                        </FieldLabel>
                      </Field>
                    )
                  })}
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              {webhook ? t("saveWebhook") : t("createWebhook")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AutomationPage() {
  const t = useTranslations("automation")
  const format = useFormatter()
  const router = useRouter()
  const [data, setData] = useState<PortalAutomationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [canView, setCanView] = useState(true)
  const [pending, setPending] = useState(false)
  const [keysQuery, setKeysQuery] = useState("")
  const [keysStatus, setKeysStatus] = useState<"all" | "active" | "revoked">(
    "all"
  )
  const [keysPage, setKeysPage] = useState(1)
  const [webhooksQuery, setWebhooksQuery] = useState("")
  const [webhooksStatus, setWebhooksStatus] = useState<
    "all" | "enabled" | "disabled"
  >("all")
  const [webhooksPage, setWebhooksPage] = useState(1)
  const [logsQuery, setLogsQuery] = useState("")
  const [logsStatus, setLogsStatus] = useState<
    "all" | "accepted" | "succeeded" | "failed"
  >("all")
  const [logsPage, setLogsPage] = useState(1)
  const [isKeyOpen, setIsKeyOpen] = useState(false)
  const [isWebhookOpen, setIsWebhookOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] =
    useState<PortalAutomationWebhook | null>(null)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [keyToRevoke, setKeyToRevoke] = useState<PortalAutomationApiKey | null>(
    null
  )
  const [webhookToDelete, setWebhookToDelete] =
    useState<PortalAutomationWebhook | null>(null)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setCanView(false)
        return true
      }
      return false
    },
    [router]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(await automationApi.get())
      setCanView(true)
    } catch (error) {
      if (handleError(error)) return
      console.error("Automation request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    void load()
  }, [load])

  async function createApiKey(input: {
    name: string
    permissions: AutomationPermission[]
  }) {
    setPending(true)
    try {
      const created = await automationApi.createApiKey(input)
      setRevealedToken(created.token)
      await load()
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Automation API key creation failed", error)
      toast.error(t("keyCreateFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  async function revokeApiKey(apiKey: PortalAutomationApiKey) {
    setPending(true)
    try {
      await automationApi.revokeApiKey(apiKey.id)
      setKeyToRevoke(null)
      await load()
      toast.success(t("keyRevoked"))
    } catch (error) {
      if (handleError(error)) return
      console.error("Automation API key revocation failed", error)
      toast.error(t("keyRevokeFailed"))
    } finally {
      setPending(false)
    }
  }

  async function saveWebhook(input: {
    name: string
    url: string
    events: AutomationWebhookEvent[]
  }) {
    setPending(true)
    try {
      const result = editingWebhook
        ? await automationApi.updateWebhook(editingWebhook.id, input)
        : await automationApi.createWebhook(input)
      if (result.signingSecret) setRevealedSecret(result.signingSecret)
      await load()
      toast.success(editingWebhook ? t("webhookUpdated") : t("webhookCreated"))
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Automation webhook save failed", error)
      toast.error(t("webhookSaveFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  async function toggleWebhook(
    webhook: PortalAutomationWebhook,
    enabled: boolean
  ) {
    setPending(true)
    try {
      await automationApi.updateWebhook(webhook.id, { enabled })
      await load()
    } catch (error) {
      if (handleError(error)) return
      console.error("Automation webhook toggle failed", error)
      toast.error(t("webhookToggleFailed"))
    } finally {
      setPending(false)
    }
  }

  async function removeWebhook(webhook: PortalAutomationWebhook) {
    setPending(true)
    try {
      await automationApi.removeWebhook(webhook.id)
      setWebhookToDelete(null)
      await load()
      toast.success(t("webhookDeleted"))
    } catch (error) {
      if (handleError(error)) return
      console.error("Automation webhook deletion failed", error)
      toast.error(t("webhookDeleteFailed"))
    } finally {
      setPending(false)
    }
  }

  if (!canView) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={LockKeyhole}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !data && !loadError) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError || !data) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void load()}
                variant="brand-secondary"
              />
            }
            description={t("loadFailedDescription")}
            icon={CircleAlert}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  const normalizedKeysQuery = keysQuery.trim().toLowerCase()
  const filteredKeys = data.apiKeys.filter(
    (apiKey) =>
      (!normalizedKeysQuery ||
        apiKey.name.toLowerCase().includes(normalizedKeysQuery)) &&
      (keysStatus === "all" || apiKey.status === keysStatus)
  )
  const hasKeysFilters = Boolean(normalizedKeysQuery || keysStatus !== "all")
  const keysPagination = paginate(filteredKeys, keysPage)

  const normalizedWebhooksQuery = webhooksQuery.trim().toLowerCase()
  const filteredWebhooks = data.webhooks.filter(
    (webhook) =>
      (!normalizedWebhooksQuery ||
        webhook.name.toLowerCase().includes(normalizedWebhooksQuery) ||
        webhook.url.toLowerCase().includes(normalizedWebhooksQuery)) &&
      (webhooksStatus === "all" ||
        webhook.enabled === (webhooksStatus === "enabled"))
  )
  const hasWebhooksFilters = Boolean(
    normalizedWebhooksQuery || webhooksStatus !== "all"
  )
  const webhooksPagination = paginate(filteredWebhooks, webhooksPage)

  const normalizedLogsQuery = logsQuery.trim().toLowerCase()
  const filteredLogs = data.logs.filter(
    (log) =>
      (!normalizedLogsQuery ||
        log.event.toLowerCase().includes(normalizedLogsQuery) ||
        (log.summary ?? "").toLowerCase().includes(normalizedLogsQuery)) &&
      (logsStatus === "all" || log.status === logsStatus)
  )
  const hasLogsFilters = Boolean(normalizedLogsQuery || logsStatus !== "all")
  const logsPagination = paginate(filteredLogs, logsPage)

  function clearKeysFilters() {
    setKeysQuery("")
    setKeysStatus("all")
    setKeysPage(1)
  }

  function clearWebhooksFilters() {
    setWebhooksQuery("")
    setWebhooksStatus("all")
    setWebhooksPage(1)
  }

  function clearLogsFilters() {
    setLogsQuery("")
    setLogsStatus("all")
    setLogsPage(1)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <Tabs defaultValue="keys">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="keys">{t("tab.keys")}</TabsTrigger>
            <TabsTrigger value="webhooks">{t("tab.webhooks")}</TabsTrigger>
            <TabsTrigger value="logs">{t("tab.logs")}</TabsTrigger>
          </TabsList>

          <TabsContent className="pt-3" value="keys">
            <Card variant="subtle">
              <DataTableHeader
                action={
                  data.canManage ? (
                    <Button
                      className="hidden sm:inline-flex"
                      onClick={() => setIsKeyOpen(true)}
                      size="sm"
                      type="button"
                    >
                      <Plus data-icon="inline-start" /> {t("newKey")}
                    </Button>
                  ) : undefined
                }
                search={{
                  ariaLabel: t("searchKeys"),
                  onChange: (value) => {
                    setKeysQuery(value)
                    setKeysPage(1)
                  },
                  placeholder: t("searchKeysPlaceholder"),
                  value: keysQuery,
                }}
              />
              <CardContent className="flex flex-col gap-4 px-0">
                <DataTableToolbar
                  actions={
                    hasKeysFilters ? (
                      <Button
                        onClick={clearKeysFilters}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X /> {t("clear")}
                      </Button>
                    ) : undefined
                  }
                >
                  <DataTableFilter
                    ariaLabel={t("filterStatus")}
                    label={t("status")}
                    onValueChange={(value) => {
                      setKeysStatus(value as "all" | "active" | "revoked")
                      setKeysPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("keyFilter.active"), value: "active" },
                      { label: t("keyFilter.revoked"), value: "revoked" },
                    ]}
                    value={keysStatus}
                  />
                </DataTableToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("key")}</TableHead>
                      <TableHead>{t("permissions")}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("lastUsedColumn")}
                      </TableHead>
                      <TableHead>{t("status")}</TableHead>
                      {data.canManage ? (
                        <TableHead className="text-right">
                          {t("actions")}
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keysPagination.visible.length ? (
                      keysPagination.visible.map((apiKey) => (
                        <TableRow key={apiKey.id}>
                          <TableCell>
                            <div className="flex min-w-40 flex-col">
                              <span className="font-medium">{apiKey.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {apiKey.tokenPrefix}…
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {apiKey.permissions.map((permission) => (
                                <Badge key={permission} variant="neutral">
                                  {t(`permission.${permission}`)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {apiKey.lastUsedAt
                              ? format.dateTime(new Date(apiKey.lastUsedAt), {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : t("never")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                apiKey.status === "active"
                                  ? "success"
                                  : "neutral"
                              }
                            >
                              {apiKey.status === "active"
                                ? t("keyStatus.active")
                                : t("keyStatus.revoked")}
                            </Badge>
                          </TableCell>
                          {data.canManage ? (
                            <TableCell className="text-right">
                              {apiKey.status === "active" ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      aria-label={`Abrir acciones para ${apiKey.name}`}
                                      className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                      size="icon-sm"
                                      variant="brand-secondary"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    size="compact"
                                  >
                                    <DropdownMenuItem
                                      onSelect={() => setKeyToRevoke(apiKey)}
                                      size="compact"
                                      variant="destructive"
                                    >
                                      <Trash2 />
                                      {t("revokeKey")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    ) : (
                      <TableEmptyRow
                        action={
                          hasKeysFilters ? (
                            <Button
                              onClick={clearKeysFilters}
                              variant="outline"
                            >
                              {t("resetFilters")}
                            </Button>
                          ) : null
                        }
                        colSpan={data.canManage ? 5 : 4}
                        description={
                          hasKeysFilters
                            ? t("emptyFilteredDescription")
                            : t("keysEmptyDescription")
                        }
                        title={
                          hasKeysFilters ? t("noMatches") : t("keysEmptyTitle")
                        }
                      />
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  canGoNext={keysPagination.safePage < keysPagination.pageCount}
                  canGoPrevious={keysPagination.safePage > 1}
                  itemLabel={t("keysItemLabel")}
                  onNextPage={() =>
                    setKeysPage((current) =>
                      Math.min(current + 1, keysPagination.pageCount)
                    )
                  }
                  onPreviousPage={() =>
                    setKeysPage((current) => Math.max(current - 1, 1))
                  }
                  rangeEnd={keysPagination.rangeEnd}
                  rangeStart={keysPagination.rangeStart}
                  total={filteredKeys.length}
                />
              </CardContent>
            </Card>
            {data.canManage ? (
              <FloatingActionButton
                label={t("newKey")}
                onClick={() => setIsKeyOpen(true)}
              />
            ) : null}
          </TabsContent>

          <TabsContent className="pt-3" value="webhooks">
            <Card variant="subtle">
              <DataTableHeader
                action={
                  data.canManage ? (
                    <Button
                      className="hidden sm:inline-flex"
                      onClick={() => {
                        setEditingWebhook(null)
                        setIsWebhookOpen(true)
                      }}
                      size="sm"
                      type="button"
                    >
                      <Plus data-icon="inline-start" /> {t("newWebhook")}
                    </Button>
                  ) : undefined
                }
                search={{
                  ariaLabel: t("searchWebhooks"),
                  onChange: (value) => {
                    setWebhooksQuery(value)
                    setWebhooksPage(1)
                  },
                  placeholder: t("searchWebhooksPlaceholder"),
                  value: webhooksQuery,
                }}
              />
              <CardContent className="flex flex-col gap-4 px-0">
                <DataTableToolbar
                  actions={
                    hasWebhooksFilters ? (
                      <Button
                        onClick={clearWebhooksFilters}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X /> {t("clear")}
                      </Button>
                    ) : undefined
                  }
                >
                  <DataTableFilter
                    ariaLabel={t("filterStatus")}
                    label={t("status")}
                    onValueChange={(value) => {
                      setWebhooksStatus(value as "all" | "enabled" | "disabled")
                      setWebhooksPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("webhookFilter.enabled"), value: "enabled" },
                      { label: t("webhookFilter.disabled"), value: "disabled" },
                    ]}
                    value={webhooksStatus}
                  />
                </DataTableToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("webhook")}</TableHead>
                      <TableHead>{t("events")}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("lastRunColumn")}
                      </TableHead>
                      <TableHead>{t("enabled")}</TableHead>
                      {data.canManage ? (
                        <TableHead className="text-right">
                          {t("actions")}
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooksPagination.visible.length ? (
                      webhooksPagination.visible.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell>
                            <div className="flex min-w-40 flex-col">
                              <span className="font-medium">
                                {webhook.name}
                              </span>
                              <span className="text-xs break-all text-muted-foreground">
                                {webhook.url}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {webhook.events.map((event) => (
                                <Badge key={event} variant="neutral">
                                  {t(`event.${event}`)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {webhook.lastSentAt
                              ? format.dateTime(new Date(webhook.lastSentAt), {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : t("never")}
                            {webhook.lastStatusCode
                              ? ` · ${webhook.lastStatusCode}`
                              : ""}
                          </TableCell>
                          <TableCell>
                            <Switch
                              aria-label={`Habilitar ${webhook.name}`}
                              checked={webhook.enabled}
                              disabled={!data.canManage || pending}
                              onCheckedChange={(checked) =>
                                void toggleWebhook(webhook, checked)
                              }
                            />
                          </TableCell>
                          {data.canManage ? (
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    aria-label={`Abrir acciones para ${webhook.name}`}
                                    className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                    size="icon-sm"
                                    variant="brand-secondary"
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" size="compact">
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setEditingWebhook(webhook)
                                      setIsWebhookOpen(true)
                                    }}
                                    size="compact"
                                  >
                                    <Pencil />
                                    {t("edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => setWebhookToDelete(webhook)}
                                    size="compact"
                                    variant="destructive"
                                  >
                                    <Trash2 />
                                    {t("delete")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    ) : (
                      <TableEmptyRow
                        action={
                          hasWebhooksFilters ? (
                            <Button
                              onClick={clearWebhooksFilters}
                              variant="outline"
                            >
                              {t("resetFilters")}
                            </Button>
                          ) : null
                        }
                        colSpan={data.canManage ? 5 : 4}
                        description={
                          hasWebhooksFilters
                            ? t("emptyFilteredDescription")
                            : t("webhooksEmptyDescription")
                        }
                        title={
                          hasWebhooksFilters
                            ? t("noMatches")
                            : t("webhooksEmptyTitle")
                        }
                      />
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  canGoNext={
                    webhooksPagination.safePage < webhooksPagination.pageCount
                  }
                  canGoPrevious={webhooksPagination.safePage > 1}
                  itemLabel={t("webhooksItemLabel")}
                  onNextPage={() =>
                    setWebhooksPage((current) =>
                      Math.min(current + 1, webhooksPagination.pageCount)
                    )
                  }
                  onPreviousPage={() =>
                    setWebhooksPage((current) => Math.max(current - 1, 1))
                  }
                  rangeEnd={webhooksPagination.rangeEnd}
                  rangeStart={webhooksPagination.rangeStart}
                  total={filteredWebhooks.length}
                />
              </CardContent>
            </Card>
            {data.canManage ? (
              <FloatingActionButton
                label={t("newWebhook")}
                onClick={() => {
                  setEditingWebhook(null)
                  setIsWebhookOpen(true)
                }}
              />
            ) : null}
          </TabsContent>

          <TabsContent className="pt-3" value="logs">
            <Card variant="subtle">
              <DataTableHeader
                search={{
                  ariaLabel: t("searchActivity"),
                  onChange: (value) => {
                    setLogsQuery(value)
                    setLogsPage(1)
                  },
                  placeholder: t("searchActivityPlaceholder"),
                  value: logsQuery,
                }}
              />
              <CardContent className="flex flex-col gap-4 px-0">
                <DataTableToolbar
                  actions={
                    hasLogsFilters ? (
                      <Button
                        onClick={clearLogsFilters}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X /> {t("clear")}
                      </Button>
                    ) : undefined
                  }
                >
                  <DataTableFilter
                    ariaLabel={t("filterResult")}
                    label={t("result")}
                    onValueChange={(value) => {
                      setLogsStatus(
                        value as "all" | "accepted" | "succeeded" | "failed"
                      )
                      setLogsPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("logFilter.accepted"), value: "accepted" },
                      { label: t("logFilter.succeeded"), value: "succeeded" },
                      { label: t("logFilter.failed"), value: "failed" },
                    ]}
                    value={logsStatus}
                  />
                </DataTableToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("eventColumn")}</TableHead>
                      <TableHead>{t("direction")}</TableHead>
                      <TableHead>{t("result")}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("date")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsPagination.visible.length ? (
                      logsPagination.visible.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex min-w-40 flex-col">
                              <span className="font-medium">{log.event}</span>
                              {log.summary ? (
                                <span className="text-sm text-muted-foreground">
                                  {log.summary}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {log.direction === "inbound"
                              ? t("directionLabel.inbound")
                              : t("directionLabel.outbound")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.status === "failed"
                                  ? "destructive"
                                  : log.status === "succeeded"
                                    ? "success"
                                    : "info"
                              }
                            >
                              {t(`logStatus.${log.status}`)}
                              {log.statusCode ? ` · ${log.statusCode}` : ""}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {log.createdAt
                              ? format.dateTime(new Date(log.createdAt), {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : t("never")}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmptyRow
                        action={
                          hasLogsFilters ? (
                            <Button
                              onClick={clearLogsFilters}
                              variant="outline"
                            >
                              {t("resetFilters")}
                            </Button>
                          ) : null
                        }
                        colSpan={4}
                        description={
                          hasLogsFilters
                            ? t("logsEmptyFilteredDescription")
                            : t("logsEmptyDescription")
                        }
                        title={
                          hasLogsFilters ? t("noMatches") : t("logsEmptyTitle")
                        }
                      />
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  canGoNext={logsPagination.safePage < logsPagination.pageCount}
                  canGoPrevious={logsPagination.safePage > 1}
                  itemLabel={t("records")}
                  onNextPage={() =>
                    setLogsPage((current) =>
                      Math.min(current + 1, logsPagination.pageCount)
                    )
                  }
                  onPreviousPage={() =>
                    setLogsPage((current) => Math.max(current - 1, 1))
                  }
                  rangeEnd={logsPagination.rangeEnd}
                  rangeStart={logsPagination.rangeStart}
                  total={filteredLogs.length}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ApiKeySheet
        onCreate={createApiKey}
        onOpenChange={setIsKeyOpen}
        open={isKeyOpen}
        pending={pending}
      />
      <WebhookSheet
        onOpenChange={setIsWebhookOpen}
        onSubmit={saveWebhook}
        open={isWebhookOpen}
        pending={pending}
        webhook={editingWebhook}
      />
      <SecretRevealSheet
        description={t("tokenDescription")}
        label={t("tokenLabel")}
        onOpenChange={(open) => !open && setRevealedToken(null)}
        value={revealedToken}
      />
      <SecretRevealSheet
        description={t("secretDescription")}
        label={t("secretLabel")}
        onOpenChange={(open) => !open && setRevealedSecret(null)}
        value={revealedSecret}
      />

      <AlertDialog
        onOpenChange={(open) => !open && setKeyToRevoke(null)}
        open={Boolean(keyToRevoke)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar “{keyToRevoke?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Las herramientas que usen este token dejarán de tener acceso de
              inmediato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                if (keyToRevoke) void revokeApiKey(keyToRevoke)
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Revocar clave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => !open && setWebhookToDelete(null)}
        open={Boolean(webhookToDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar “{webhookToDelete?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dejaremos de enviar eventos a esa URL. Puedes volver a crearlo más
              tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                if (webhookToDelete) void removeWebhook(webhookToDelete)
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Eliminar webhook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
