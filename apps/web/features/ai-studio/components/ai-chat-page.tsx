"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  Archive,
  ArrowLeft,
  CircleAlert,
  Copy,
  ImagePlus,
  LockKeyhole,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react"

import { ApiError, aiApi, filesApi } from "@workspace/api-client"
import type { PortalAiRequest, PortalAiSettings } from "@workspace/contracts"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@workspace/ui/components/attachment"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Toggle } from "@workspace/ui/components/toggle"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"

import { AiGenerationCanvas } from "./ai-generation-canvas"
import {
  chatToolKeys,
  chatTools,
  isChatTool,
  type ChatTool,
} from "./ai-chat-tools"
import { loginPath } from "@/features/identity/login-redirect"

const statusVariants: Record<
  PortalAiRequest["status"],
  "info" | "warning" | "success" | "destructive" | "neutral"
> = {
  queued: "info",
  processing: "warning",
  succeeded: "success",
  failed: "destructive",
  cancelled: "neutral",
}

const suggestionTools = ["content", "image", "video", "planner"] as const
const REFERENCE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
const MAX_REFERENCE_SIZE_BYTES = 30 * 1024 * 1024

function idempotencyKey() {
  return `chat-${crypto.randomUUID()}`
}

function isMediaTool(tool: ChatTool): tool is "image" | "video" {
  return tool === "image" || tool === "video"
}

async function filePartToFile(part: PromptInputMessage["files"][number]) {
  const response = await fetch(part.url)
  if (!response.ok) throw new Error("REFERENCE_FILE_UNAVAILABLE")

  const blob = await response.blob()
  const mediaType = part.mediaType || blob.type
  if (
    !REFERENCE_IMAGE_TYPES.includes(
      mediaType as (typeof REFERENCE_IMAGE_TYPES)[number]
    ) ||
    blob.size > MAX_REFERENCE_SIZE_BYTES
  ) {
    throw new Error("INVALID_REFERENCE_FILE")
  }

  return new File([blob], part.filename || "reference-image", {
    type: mediaType,
  })
}

function ReferenceAttachmentButton({
  disabled,
  label,
}: {
  disabled?: boolean
  label: string
}) {
  const attachments = usePromptInputAttachments()

  return (
    <PromptInputButton
      aria-label={label}
      disabled={disabled}
      onClick={attachments.openFileDialog}
      tooltip={label}
      type="button"
    >
      <ImagePlus />
    </PromptInputButton>
  )
}

function ReferenceAttachments({ enabled }: { enabled: boolean }) {
  const t = useTranslations("aiStudio.chat")
  const { files, remove } = usePromptInputAttachments()

  if (!enabled || !files.length) return null

  return (
    <AttachmentGroup className="px-3 pt-3">
      {files.map((file) => (
        <Attachment key={file.id} size="sm">
          <AttachmentMedia variant="image">
            <Image
              alt={file.filename || t("referenceImage")}
              className="object-cover"
              fill
              sizes="32px"
              src={file.url}
              unoptimized
            />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>
              {file.filename || t("referenceImage")}
            </AttachmentTitle>
            <AttachmentDescription>{t("referenceImage")}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction
              aria-label={t("removeReference", {
                name: file.filename || t("referenceImage"),
              })}
              onClick={() => remove(file.id)}
              type="button"
              variant="brand-secondary"
            >
              <X />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}

function traceSummary(
  request: PortalAiRequest,
  t: (key: "received" | "reserving" | "generating") => string
): string {
  const queued = request.status === "queued"
  const steps = [
    t("received"),
    t("reserving"),
    `${t("generating")}${request.model ? ` · ${request.model}` : ""}`,
  ]
  return steps
    .map((step, index) => `${index === 2 && queued ? "○" : "✓"} ${step}`)
    .join("\n\n")
}

function ResultBody({ request }: { request: PortalAiRequest }) {
  const t = useTranslations("aiStudio.chat")

  if (request.status === "failed") {
    return (
      <p className="text-sm text-destructive">
        {request.errorCode
          ? t("generationFailedWithCode", { code: request.errorCode })
          : t("generationFailed")}
      </p>
    )
  }

  if (request.status === "queued" || request.status === "processing") {
    const media = request.kind === "image" || request.kind === "video"
    return (
      <div className="flex flex-col gap-3">
        <Reasoning className="mb-0" isStreaming>
          <ReasoningTrigger
            getThinkingMessage={() => (
              <Shimmer duration={1}>
                {media ? t("generatingMedia") : t("thinking")}
              </Shimmer>
            )}
          />
          <ReasoningContent>
            {traceSummary(request, (key) => t(`trace.${key}`))}
          </ReasoningContent>
        </Reasoning>
        {media ? (
          <AiGenerationCanvas
            aspectRatio={String(
              (request.input as Record<string, unknown>).aspectRatio ?? "1:1"
            ).replace(":", " / ")}
            label={
              request.kind === "image"
                ? t("generatingImage")
                : t("generatingVideo")
            }
            prompt={request.prompt}
          />
        ) : null}
      </div>
    )
  }

  if (request.status === "cancelled") {
    return <p className="text-sm text-muted-foreground">{t("cancelled")}</p>
  }

  const result = request.result as Record<string, unknown>
  const summary = typeof result.summary === "string" ? result.summary : null
  const strategy = typeof result.strategy === "string" ? result.strategy : null
  const variants = Array.isArray(result.variants) ? result.variants : []

  return (
    <div className="flex flex-col gap-4">
      {summary ? <MessageResponse>{summary}</MessageResponse> : null}
      {strategy ? <MessageResponse>{strategy}</MessageResponse> : null}
      {variants.map((variant, index) => {
        const item = variant as Record<string, unknown>
        const platform =
          typeof item.platform === "string"
            ? item.platform
            : t("variantFallback", { index: index + 1 })
        const body =
          typeof item.caption === "string"
            ? item.caption
            : typeof item.content === "string"
              ? item.content
              : ""
        const hashtags = Array.isArray(item.hashtags) ? item.hashtags : []
        return (
          <div
            className="flex flex-col gap-1.5 border-l border-border pl-3"
            key={`${platform}-${index}`}
          >
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {platform}
            </span>
            {typeof item.hook === "string" && item.hook ? (
              <span className="text-sm font-medium">{item.hook}</span>
            ) : null}
            {body ? <MessageResponse>{body}</MessageResponse> : null}
            {hashtags.length ? (
              <span className="text-sm text-muted-foreground">
                {hashtags.map((tag) => `#${String(tag)}`).join(" ")}
              </span>
            ) : null}
          </div>
        )
      })}
      {!summary && !strategy && !variants.length ? (
        <MessageResponse>{`\`\`\`json\n${JSON.stringify(request.result, null, 2)}\n\`\`\``}</MessageResponse>
      ) : null}
    </div>
  )
}

function useToolText() {
  const t = useTranslations("aiStudio.tools")
  return (key: string) => t(key as Parameters<typeof t>[0])
}

function toolDateValue(value: unknown) {
  if (typeof value !== "string" || !value) return undefined
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function toolDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function InlineToolOptions({
  disabled,
  onChange,
  tool,
  values,
}: {
  disabled: boolean
  onChange: (name: string, value: unknown) => void
  tool: ChatTool
  values: Record<string, unknown>
}) {
  const t = useTranslations("aiStudio.chat")
  const tt = useToolText()
  const format = useFormatter()

  return (
    <>
      {chatTools[tool].fields.map((field) => {
        const controlId = `tool-${tool}-${field.name}`
        const value = values[field.name]

        if (field.kind === "switch") {
          return (
            <Toggle
              className="shrink-0"
              disabled={disabled}
              key={field.name}
              onPressedChange={(pressed) => onChange(field.name, pressed)}
              pressed={Boolean(value)}
              size="sm"
              variant="outline"
            >
              {tt(field.labelKey)}
            </Toggle>
          )
        }

        if (field.kind === "toggles") {
          const selected = Array.isArray(value) ? (value as string[]) : []
          return (
            <DropdownMenu key={field.name}>
              <DropdownMenuTrigger asChild>
                <PromptInputButton className="shrink-0" disabled={disabled}>
                  {selected.length
                    ? t("optionCount", {
                        count: selected.length,
                        label: tt(field.labelKey),
                      })
                    : tt(field.labelKey)}
                </PromptInputButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {field.options.map((option) => (
                  <DropdownMenuCheckboxItem
                    checked={selected.includes(option.value)}
                    key={option.value}
                    onCheckedChange={(checked) =>
                      onChange(
                        field.name,
                        checked
                          ? [...selected, option.value]
                          : selected.filter((item) => item !== option.value)
                      )
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {tt(option.labelKey)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }

        if (field.kind === "select") {
          const selectedOption = field.options.find(
            (option) => option.value === String(value ?? "")
          )
          return (
            <PromptInputSelect
              disabled={disabled}
              key={field.name}
              onValueChange={(next) => onChange(field.name, next)}
              value={String(value ?? "")}
            >
              <PromptInputSelectTrigger
                aria-label={tt(field.labelKey)}
                className="shrink-0"
              >
                {selectedOption
                  ? t("optionValue", {
                      label: tt(field.labelKey),
                      value: tt(selectedOption.labelKey),
                    })
                  : tt(field.labelKey)}
              </PromptInputSelectTrigger>
              <PromptInputSelectContent>
                {field.options.map((option) => (
                  <PromptInputSelectItem
                    key={option.value}
                    value={option.value}
                  >
                    {tt(option.labelKey)}
                  </PromptInputSelectItem>
                ))}
              </PromptInputSelectContent>
            </PromptInputSelect>
          )
        }

        if (field.kind === "date") {
          const selectedDate = toolDateValue(value)
          return (
            <Popover key={field.name}>
              <PopoverTrigger asChild>
                <PromptInputButton className="shrink-0" disabled={disabled}>
                  {selectedDate
                    ? t("optionValue", {
                        label: tt(field.labelKey),
                        value: format.dateTime(selectedDate, {
                          dateStyle: "medium",
                        }),
                      })
                    : tt(field.labelKey)}
                </PromptInputButton>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  onSelect={(next) =>
                    onChange(field.name, next ? toolDateString(next) : "")
                  }
                  selected={selectedDate}
                />
              </PopoverContent>
            </Popover>
          )
        }

        const filled =
          field.kind === "number"
            ? typeof value === "number"
            : typeof value === "string" && value.trim() !== ""

        return (
          <Popover key={field.name}>
            <PopoverTrigger asChild>
              <PromptInputButton
                className="max-w-48 shrink-0"
                disabled={disabled}
              >
                <span className="truncate">
                  {filled
                    ? t("optionValue", {
                        label: tt(field.labelKey),
                        value:
                          field.kind === "number"
                            ? format.number(value as number)
                            : String(value),
                      })
                    : tt(field.labelKey)}
                </span>
              </PromptInputButton>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <Field>
                <FieldLabel htmlFor={controlId}>
                  {tt(field.labelKey)}
                </FieldLabel>
                <Input
                  id={controlId}
                  max={field.kind === "number" ? field.max : undefined}
                  min={field.kind === "number" ? field.min : undefined}
                  onChange={(event) =>
                    onChange(
                      field.name,
                      field.kind === "number"
                        ? Number(event.target.value) || field.min
                        : event.target.value
                    )
                  }
                  placeholder={
                    field.kind === "text" && field.placeholderKey
                      ? tt(field.placeholderKey)
                      : undefined
                  }
                  type={field.kind === "number" ? "number" : "text"}
                  value={String(value ?? "")}
                />
              </Field>
            </PopoverContent>
          </Popover>
        )
      })}
    </>
  )
}

export function AiChatPage() {
  const t = useTranslations("aiStudio.chat")
  const tt = useToolText()
  const format = useFormatter()
  const router = useRouter()
  const params = useSearchParams()
  const requestedTool = params.get("tool")

  const [tool, setTool] = useState<ChatTool>(
    isChatTool(requestedTool) ? requestedTool : "content"
  )
  const [options, setOptions] = useState<
    Record<ChatTool, Record<string, unknown>>
  >(
    () =>
      Object.fromEntries(
        chatToolKeys.map((key) => [key, { ...chatTools[key].values }])
      ) as Record<ChatTool, Record<string, unknown>>
  )
  const [requests, setRequests] = useState<PortalAiRequest[]>([])
  const [settings, setSettings] = useState<PortalAiSettings | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [settingsError, setSettingsError] = useState(false)
  const [pending, setPending] = useState(false)
  const [showThread, setShowThread] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await aiApi.listRequests({
        limit: 50,
        ...(query.trim() ? { search: query.trim() } : {}),
      })
      setRequests(response.requests)
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      console.error("AI requests request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [query, router])

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    setSettingsError(false)
    try {
      setSettings(await aiApi.getSettings())
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      console.error("AI settings request failed", error)
      setSettingsError(true)
    } finally {
      setSettingsLoading(false)
    }
  }, [router])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  useEffect(() => {
    const timer = setTimeout(() => void loadSettings(), 0)
    return () => clearTimeout(timer)
  }, [loadSettings])

  const brandConfigured = settings?.brandConfigured === true

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId]
  )

  useEffect(() => {
    if (!selected) return
    if (selected.status !== "queued" && selected.status !== "processing") return
    const timer = setTimeout(async () => {
      try {
        const fresh = await aiApi.getRequest(selected.id)
        setRequests((current) =>
          current.map((item) => (item.id === fresh.id ? fresh : item))
        )
      } catch (error) {
        console.error("AI request refresh failed", error)
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [selected])

  function updateOption(name: string, value: unknown) {
    setOptions((current) => ({
      ...current,
      [tool]: { ...current[tool], [name]: value },
    }))
  }

  async function submit(message: PromptInputMessage) {
    if (!brandConfigured) {
      toast.error(t("configurationRequiredTitle"))
      throw new Error("AI_BRAND_CONFIGURATION_REQUIRED")
    }
    const nextPrompt = message.text.trim()
    if (!nextPrompt) {
      toast.error(t("emptyPrompt"))
      throw new Error("EMPTY_PROMPT")
    }
    const maximumReferences = tool === "video" ? 9 : 10
    if (isMediaTool(tool) && message.files.length > maximumReferences) {
      toast.error(t("referenceLimit", { max: maximumReferences }))
      throw new Error("REFERENCE_LIMIT_EXCEEDED")
    }
    setPending(true)
    let uploadingReferences = false
    try {
      const input: Record<string, unknown> = Object.fromEntries(
        Object.entries(options[tool]).filter(
          ([, value]) => value !== "" && value !== undefined
        )
      )
      if (isMediaTool(tool) && message.files.length) {
        uploadingReferences = true
        const referenceAssetIds: string[] = []
        for (const part of message.files) {
          const file = await filePartToFile(part)
          const upload = await filesApi.startUpload({
            folderId: null,
            mimeType: file.type,
            name: file.name,
            sizeBytes: file.size,
          })
          await filesApi.upload(upload.id, file)
          referenceAssetIds.push(upload.id)
        }
        input.referenceAssetIds = referenceAssetIds
        uploadingReferences = false
      }
      const created = await aiApi.createRequest({
        idempotencyKey: idempotencyKey(),
        input,
        kind: tool,
        prompt: nextPrompt,
      })
      setRequests((current) => [created, ...current])
      setSelectedId(created.id)
      setPrompt("")
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
      } else if (
        error instanceof ApiError &&
        error.code === "AI_BRAND_CONFIGURATION_REQUIRED"
      ) {
        setSettings((current) =>
          current ? { ...current, brandConfigured: false } : current
        )
        toast.error(t("configurationRequiredTitle"))
      } else {
        console.error("AI request creation failed", error)
        toast.error(
          uploadingReferences ? t("referenceUploadFailed") : t("sendFailed")
        )
      }
      throw error
    } finally {
      setPending(false)
    }
  }

  async function retry(request: PortalAiRequest) {
    if (!brandConfigured) {
      toast.error(t("configurationRequiredTitle"))
      return
    }
    try {
      const fresh = await aiApi.retryRequest(request.id, {
        idempotencyKey: idempotencyKey(),
      })
      setRequests((current) =>
        current.map((item) => (item.id === fresh.id ? fresh : item))
      )
      toast.success(t("retrySuccess"))
    } catch (error) {
      console.error("AI retry failed", error)
      toast.error(t("retryFailed"))
    }
  }

  async function archive(request: PortalAiRequest) {
    try {
      await aiApi.archiveRequest(request.id, { archived: true })
      setRequests((current) => current.filter((item) => item.id !== request.id))
      if (selectedId === request.id) setSelectedId(null)
      toast.success(t("archived"))
    } catch (error) {
      console.error("AI archive failed", error)
      toast.error(t("archiveFailed"))
    }
  }

  async function copyResult(request: PortalAiRequest) {
    if (!navigator.clipboard) {
      toast.error(t("clipboardUnsupported"))
      return
    }
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(request.result, null, 2)
      )
      toast.success(t("copied"))
    } catch {
      toast.error(t("copyFailed"))
    }
  }

  if (
    (isLoading && !requests.length && !loadError) ||
    (settingsLoading && !settingsError)
  ) {
    return (
      <div
        className="flex h-[calc(100svh-var(--dashboard-header-height))] items-center justify-center"
        data-content-padding="false"
      >
        <PageLoading aria-label={t("loading")} />
      </div>
    )
  }

  if (loadError || settingsError) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void Promise.all([load(), loadSettings()])}
                variant="brand-secondary"
              />
            }
            description={t("loadFailedDescription")}
            icon={CircleAlert}
            title={t("loadFailedTitle")}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      className="grid h-[calc(100svh-var(--dashboard-header-height))] grid-cols-1 overflow-hidden bg-background *:min-h-0 *:min-w-0 md:grid-cols-[18rem_minmax(0,1fr)] md:*:first:border-r md:*:first:border-border"
      data-content-padding="false"
    >
      <div
        className={cn(
          "flex h-full flex-col gap-3 bg-muted/20 p-3 transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread && "max-md:pointer-events-none max-md:-translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-1">
          <span className="text-sm font-medium">{t("conversations")}</span>
          <Button
            aria-label={t("newConversation")}
            onClick={() => {
              setSelectedId(null)
              setPrompt("")
              setShowThread(true)
            }}
            size="icon-sm"
            variant="brand-secondary"
          >
            <MessageSquarePlus />
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("searchLabel")}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              value={query}
            />
          </InputGroup>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {requests.length ? (
            requests.map((request) => (
              <button
                className={cn(
                  "flex flex-col gap-1 rounded-lg border border-transparent p-2 text-left transition-colors hover:bg-muted/60",
                  request.id === selectedId && "border-border bg-muted"
                )}
                key={request.id}
                onClick={() => {
                  setSelectedId(request.id)
                  if (isChatTool(request.kind)) setTool(request.kind)
                  setShowThread(true)
                }}
                type="button"
              >
                <span className="truncate text-sm font-medium">
                  {request.title}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={statusVariants[request.status]}>
                    {t(`status.${request.status}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(request.createdAt), {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              {t("emptyHistory")}
            </p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex h-full flex-col transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread
            ? "max-md:translate-x-0"
            : "max-md:pointer-events-none max-md:translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              aria-label={t("backToConversations")}
              className="md:hidden"
              onClick={() => setShowThread(false)}
              size="icon-sm"
              variant="brand-secondary"
            >
              <ArrowLeft />
            </Button>
            <span className="truncate font-medium">
              {selected ? selected.title : t("newConversation")}
            </span>
            <Badge variant="neutral">{tt(chatTools[tool].labelKey)}</Badge>
          </div>
        </div>

        <Conversation className="min-h-0">
          <ConversationContent
            className={cn(
              "mx-auto w-full max-w-4xl gap-8 px-4 py-6",
              !selected && "min-h-full justify-center"
            )}
          >
            {selected ? (
              <>
                <Message from="user">
                  <MessageContent>{selected.prompt}</MessageContent>
                </Message>
                <Message from="assistant">
                  <MessageContent className="w-full">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {chatTools[selected.kind as ChatTool]
                          ? tt(chatTools[selected.kind as ChatTool].labelKey)
                          : selected.kind}
                      </span>
                      <span>·</span>
                      <span>
                        {format.dateTime(new Date(selected.createdAt), {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      {selected.model ? (
                        <>
                          <span>·</span>
                          <span className="font-mono">{selected.model}</span>
                        </>
                      ) : null}
                    </div>
                    <ResultBody request={selected} />
                    <MessageActions>
                      <MessageAction
                        label={t("copy")}
                        onClick={() => void copyResult(selected)}
                        tooltip={t("copy")}
                      >
                        <Copy />
                      </MessageAction>
                      {selected.status === "failed" ? (
                        <MessageAction
                          disabled={!brandConfigured}
                          label={t("retry")}
                          onClick={() => void retry(selected)}
                          tooltip={t("retry")}
                        >
                          <RefreshCw />
                        </MessageAction>
                      ) : null}
                      <MessageAction
                        label={t("archive")}
                        onClick={() => void archive(selected)}
                        tooltip={t("archive")}
                      >
                        <Archive />
                      </MessageAction>
                    </MessageActions>
                  </MessageContent>
                </Message>
              </>
            ) : !brandConfigured ? (
              <EmptyState
                action={
                  <Button asChild>
                    <Link href="/portal/settings/ai-studio">
                      <Settings2 data-icon="inline-start" />
                      {t("configurationRequiredAction")}
                    </Link>
                  </Button>
                }
                className="min-h-full py-0"
                description={t("configurationRequiredDescription")}
                icon={LockKeyhole}
                title={t("configurationRequiredTitle")}
              />
            ) : (
              <ConversationEmptyState className="mx-auto max-w-3xl gap-6 p-0">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-lg font-medium">{t("emptyTitle")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("emptyDescription")}
                  </p>
                </div>
                <Suggestions wrap>
                  {suggestionTools.map((key) => (
                    <Suggestion
                      key={key}
                      onClick={(suggestion) => {
                        setTool(key)
                        setPrompt(suggestion)
                      }}
                      suggestion={t(`suggestions.${key}`)}
                    />
                  ))}
                </Suggestions>
              </ConversationEmptyState>
            )}
          </ConversationContent>
          <ConversationScrollButton
            aria-label={t("scrollToBottom")}
            size="icon-sm"
          />
        </Conversation>

        <div aria-busy={pending} className="shrink-0 px-4 pt-2 pb-4">
          <PromptInput
            accept={
              isMediaTool(tool) ? REFERENCE_IMAGE_TYPES.join(",") : undefined
            }
            className="mx-auto max-w-4xl"
            maxFiles={tool === "video" ? 9 : 10}
            maxFileSize={MAX_REFERENCE_SIZE_BYTES}
            multiple
            noValidate
            onError={() => toast.error(t("invalidReference"))}
            onSubmit={(message) => submit(message)}
            uploadLabel={t("uploadFiles")}
          >
            <ReferenceAttachments enabled={isMediaTool(tool)} />
            <PromptInputHeader>
              <InlineToolOptions
                disabled={pending || !brandConfigured}
                onChange={updateOption}
                tool={tool}
                values={options[tool]}
              />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                aria-label={tt(chatTools[tool].promptLabelKey)}
                disabled={pending || !brandConfigured}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={tt(chatTools[tool].placeholderKey)}
                value={prompt}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                {isMediaTool(tool) ? (
                  <ReferenceAttachmentButton
                    disabled={pending || !brandConfigured}
                    label={t("addReferences")}
                  />
                ) : null}
                <PromptInputSelect
                  disabled={pending || !brandConfigured}
                  onValueChange={(value) => setTool(value as ChatTool)}
                  value={tool}
                >
                  <PromptInputSelectTrigger aria-label={t("toolSelector")}>
                    <Sparkles />
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {chatToolKeys.map((key) => (
                      <PromptInputSelectItem key={key} value={key}>
                        {tt(chatTools[key].labelKey)}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
              <PromptInputSubmit
                aria-label={t("send")}
                disabled={!prompt.trim() || pending || !brandConfigured}
                status={pending ? "submitted" : "ready"}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>

    </div>
  )
}
