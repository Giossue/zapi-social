"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CircleAlert,
  Copy,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
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
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { TableResetFiltersButton } from "@/components/table-reset-filters-button"
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
import { PageLoading } from "@/components/page-loading"
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
import { TablePagination } from "@/components/table-pagination"
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
        <SheetActions>
          <Button onClick={() => onOpenChange(false)}>{t("saved")}</Button>
        </SheetActions>
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

  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setName("")
      setSelected(["posts:read"])
    }
  }

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
          <SheetActions>
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
              {t("createKey")}
            </Button>
          </SheetActions>
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

  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(webhook?.name ?? "")
      setUrl(webhook?.url ?? "")
      setSelected(webhook ? [...webhook.events] : ["post.published"])
    }
  }

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
          <SheetActions>
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
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export type AutomationView = "keys" | "webhooks" | "logs"

const automationViews = new Set<AutomationView>(["keys", "webhooks", "logs"])

const automationViewLinks: Array<{ href: string; value: AutomationView }> = [
  { href: "/portal/settings/automation", value: "keys" },
  { href: "/portal/settings/automation?tab=webhooks", value: "webhooks" },
  { href: "/portal/settings/automation?tab=logs", value: "logs" },
]

export function AutomationPage() {
  const t = useTranslations("automation")
  const format = useFormatter()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab")
  const view =
    tab && automationViews.has(tab as AutomationView)
      ? (tab as AutomationView)
      : "keys"
  const tabLabels: Record<AutomationView, string> = {
    keys: t("tab.keys"),
    logs: t("tab.logs"),
    webhooks: t("tab.webhooks"),
  }
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
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
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
        <Tabs
          onValueChange={(value) => {
            const nextView = value as AutomationView
            const nextLink = automationViewLinks.find(
              (item) => item.value === nextView
            )
            if (nextLink) router.push(nextLink.href)
          }}
          value={view}
        >
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
            {automationViewLinks.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {tabLabels[item.value]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent className="pt-3" value="keys">
            <Card variant="subtle">
              <DataTableHeader
                loading={isLoading && Boolean(data)}
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
                filters={
                  <DataTableToolbar className="px-0">
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
                                      aria-label={t("openActions", {
                                        name: apiKey.name,
                                      })}
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
                            <TableResetFiltersButton
                              onClick={clearKeysFilters}
                            />
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
                loading={isLoading && Boolean(data)}
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
                filters={
                  <DataTableToolbar className="px-0">
                    <DataTableFilter
                      ariaLabel={t("filterStatus")}
                      label={t("status")}
                      onValueChange={(value) => {
                        setWebhooksStatus(
                          value as "all" | "enabled" | "disabled"
                        )
                        setWebhooksPage(1)
                      }}
                      options={[
                        { label: t("all"), value: "all" },
                        { label: t("webhookFilter.enabled"), value: "enabled" },
                        {
                          label: t("webhookFilter.disabled"),
                          value: "disabled",
                        },
                      ]}
                      value={webhooksStatus}
                    />
                  </DataTableToolbar>
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
                              aria-label={t("enableWebhook", {
                                name: webhook.name,
                              })}
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
                                    aria-label={t("openActions", {
                                      name: webhook.name,
                                    })}
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
                            <TableResetFiltersButton
                              onClick={clearWebhooksFilters}
                            />
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
                loading={isLoading && Boolean(data)}
                filters={
                  <DataTableToolbar className="px-0">
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
                }
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
                            <TableResetFiltersButton
                              onClick={clearLogsFilters}
                            />
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
            <AlertDialogTitle>
              {t("revokeKeyTitle", { name: keyToRevoke?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeKeyDescription")}
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
              {t("revokeKey")}
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
              {t("deleteWebhookTitle", {
                name: webhookToDelete?.name ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteWebhookDescription")}
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
              {t("deleteWebhook")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
