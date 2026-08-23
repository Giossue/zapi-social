"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CircleAlert,
  Copy,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react"

import { ApiError, aiApi } from "@workspace/api-client"
import type { PortalAiRequest } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"
import { useIsLg } from "@workspace/ui/hooks/use-lg"
import { cn } from "@workspace/ui/lib/utils"

import { AiGenerationCanvas } from "./ai-generation-canvas"
import { AiThinkingTrace, type TraceStep } from "./ai-thinking-trace"
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

function idempotencyKey() {
  return `chat-${crypto.randomUUID()}`
}

/** Pasos que se muestran mientras la generación no ha terminado. */
function traceSteps(
  request: PortalAiRequest,
  t: (key: "received" | "reserving" | "generating") => string
): TraceStep[] {
  const queued = request.status === "queued"
  return [
    { label: t("received"), state: "done" },
    { label: t("reserving"), state: queued ? "active" : "done" },
    {
      detail: request.model ?? undefined,
      label: t("generating"),
      state: queued ? "pending" : "active",
    },
  ]
}

/** Renderiza el resultado tipado que devuelve cada herramienta. */
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
        <AiThinkingTrace
          activeLabel={media ? t("generatingMedia") : t("thinking")}
          doneLabel={t("workDone")}
          steps={traceSteps(request, (key) => t(`trace.${key}`))}
          working
        />
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
      {summary ? <p className="text-sm leading-relaxed">{summary}</p> : null}
      {strategy ? <p className="text-sm leading-relaxed">{strategy}</p> : null}
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
            {body ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {body}
              </p>
            ) : null}
            {hashtags.length ? (
              <span className="text-sm text-muted-foreground">
                {hashtags.map((tag) => `#${String(tag)}`).join(" ")}
              </span>
            ) : null}
          </div>
        )
      })}
      {!summary && !strategy && !variants.length ? (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(request.result, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

/** Traduce las claves declaradas por el catálogo de herramientas. */
function useToolText() {
  const t = useTranslations("aiStudio.tools")
  return (key: string) => t(key as Parameters<typeof t>[0])
}

function ToolOptions({
  onChange,
  tool,
  values,
}: {
  onChange: (name: string, value: unknown) => void
  tool: ChatTool
  values: Record<string, unknown>
}) {
  const tt = useToolText()

  return (
    <FieldGroup>
      {chatTools[tool].fields.map((field) => {
        const controlId = `tool-${tool}-${field.name}`
        const value = values[field.name]

        if (field.kind === "switch") {
          return (
            <Field key={field.name} orientation="horizontal">
              <Switch
                checked={Boolean(value)}
                id={controlId}
                onCheckedChange={(checked) => onChange(field.name, checked)}
              />
              <FieldLabel htmlFor={controlId}>{tt(field.labelKey)}</FieldLabel>
            </Field>
          )
        }

        if (field.kind === "toggles") {
          const selected = Array.isArray(value) ? (value as string[]) : []
          return (
            <Field key={field.name}>
              <FieldLabel>{tt(field.labelKey)}</FieldLabel>
              <FieldGroup className="gap-2" data-slot="checkbox-group">
                {field.options.map((option) => {
                  const optionId = `${controlId}-${option.value}`
                  return (
                    <Field key={option.value} orientation="horizontal">
                      <Checkbox
                        checked={selected.includes(option.value)}
                        id={optionId}
                        onCheckedChange={(checked) =>
                          onChange(
                            field.name,
                            checked === true
                              ? [...selected, option.value]
                              : selected.filter((item) => item !== option.value)
                          )
                        }
                      />
                      <FieldLabel htmlFor={optionId}>
                        {tt(option.labelKey)}
                      </FieldLabel>
                    </Field>
                  )
                })}
              </FieldGroup>
            </Field>
          )
        }

        if (field.kind === "select") {
          return (
            <Field key={field.name}>
              <FieldLabel htmlFor={controlId}>{tt(field.labelKey)}</FieldLabel>
              <Select
                onValueChange={(next) => onChange(field.name, next)}
                value={String(value ?? "")}
              >
                <SelectTrigger className="w-full" id={controlId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {tt(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )
        }

        return (
          <Field key={field.name}>
            <FieldLabel htmlFor={controlId}>{tt(field.labelKey)}</FieldLabel>
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
        )
      })}
    </FieldGroup>
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [pending, setPending] = useState(false)
  const [showOptions, setShowOptions] = useState(true)
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false)
  const [showThread, setShowThread] = useState(false)
  const isLg = useIsLg()

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

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId]
  )

  /** Una generación en curso se refresca hasta terminar. */
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!prompt.trim()) {
      toast.error(t("emptyPrompt"))
      return
    }
    setPending(true)
    try {
      const input = Object.fromEntries(
        Object.entries(options[tool]).filter(
          ([, value]) => value !== "" && value !== undefined
        )
      )
      const created = await aiApi.createRequest({
        idempotencyKey: idempotencyKey(),
        input,
        kind: tool,
        prompt: prompt.trim(),
      })
      setRequests((current) => [created, ...current])
      setSelectedId(created.id)
      setPrompt("")
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      console.error("AI request creation failed", error)
      toast.error(t("sendFailed"))
    } finally {
      setPending(false)
    }
  }

  async function retry(request: PortalAiRequest) {
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

  if (isLoading && !requests.length && !loadError) {
    return (
      <div
        className="flex h-[calc(100svh-var(--dashboard-header-height))] items-center justify-center"
        data-content-padding="false"
      >
        <PageLoading aria-label={t("loading")} />
      </div>
    )
  }

  if (loadError) {
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
            title={t("loadFailedTitle")}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      /* El shell no fija altura, así que la pantalla se ancla al viewport menos
         el encabezado y va a sangre para no quedar dentro de una card. */
      className="grid h-[calc(100svh-var(--dashboard-header-height))] grid-cols-1 overflow-hidden bg-background transition-[grid-template-columns] duration-300 ease-out *:min-h-0 *:min-w-0 md:grid-cols-[20rem_minmax(0,1fr)] md:*:first:border-r md:*:first:border-border lg:grid-cols-[20rem_minmax(0,1fr)_var(--options-width)]"
      data-content-padding="false"
      style={
        { "--options-width": showOptions ? "22rem" : "0rem" } as CSSProperties
      }
    >
      {/* Bajo `md` la lista y el hilo comparten celda y se alternan con un
         translate animado, como en la fuente de diseño. */}
      <div
        className={cn(
          "flex h-full flex-col gap-3 p-3 transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread && "max-md:pointer-events-none max-md:-translate-x-full"
        )}
      >
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
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
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
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">
                {selected ? selected.title : t("newConversation")}
              </span>
              <span className="text-sm text-muted-foreground">
                {tt(chatTools[tool].descriptionKey)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild size="sm" variant="brand-secondary">
              <Link href="/portal/ai-studio/automation">
                <Zap data-icon="inline-start" /> {t("automations")}
              </Link>
            </Button>
            <Button asChild size="icon-sm" variant="brand-secondary">
              <Link
                aria-label={t("settings")}
                href="/portal/ai-studio/settings"
              >
                <Settings2 />
              </Link>
            </Button>
            <Button
              aria-label={
                isLg && showOptions ? t("hideOptions") : t("showOptions")
              }
              onClick={() =>
                isLg
                  ? setShowOptions((current) => !current)
                  : setOptionsSheetOpen(true)
              }
              size="icon-sm"
              variant="brand-secondary"
            >
              {isLg && showOptions ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {selected ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              <div className="flex justify-end pl-14">
                <div className="rounded-xl bg-muted px-3 py-2 text-sm leading-relaxed">
                  {selected.prompt}
                </div>
              </div>
              <div className="flex flex-col gap-2">
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
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={() => void copyResult(selected)}
                    size="sm"
                    variant="brand-secondary"
                  >
                    <Copy data-icon="inline-start" /> {t("copy")}
                  </Button>
                  {selected.status === "failed" ? (
                    <Button
                      onClick={() => void retry(selected)}
                      size="sm"
                      variant="brand-secondary"
                    >
                      <RefreshCw data-icon="inline-start" /> {t("retry")}
                    </Button>
                  ) : null}
                  <Button
                    onClick={() => void archive(selected)}
                    size="sm"
                    variant="brand-secondary"
                  >
                    <Trash2 data-icon="inline-start" /> {t("archive")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="m-auto flex max-w-md flex-col items-center gap-4 text-center">
              <EmptyState
                description={t("emptyDescription")}
                icon={Sparkles}
                title={t("emptyTitle")}
              />
            </div>
          )}
        </div>

        <form
          aria-busy={pending}
          className="shrink-0 p-3"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl border border-border bg-background p-2.5 transition-colors focus-within:border-ring">
            <Textarea
              aria-label={tt(chatTools[tool].promptLabelKey)}
              className="min-h-16 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              disabled={pending}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={tt(chatTools[tool].placeholderKey)}
              value={prompt}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {chatToolKeys.map((key) => (
                  <button
                    aria-pressed={tool === key}
                    className={cn(
                      "rounded-md px-2 py-1 text-sm transition-colors",
                      tool === key
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    key={key}
                    onClick={() => setTool(key)}
                    type="button"
                  >
                    {tt(chatTools[key].labelKey)}
                  </button>
                ))}
              </div>
              <Button
                aria-label={t("send")}
                disabled={!prompt.trim() || pending}
                size="icon-sm"
                type="submit"
              >
                {pending ? <Spinner /> : <Send />}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <div
        className={cn(
          "hidden h-full flex-col overflow-y-auto border-l border-border p-4 lg:flex",
          !showOptions && "lg:hidden"
        )}
      >
        <div className="flex flex-col gap-1 pb-3">
          <span className="font-medium">
            {t("toolOptions", { tool: tt(chatTools[tool].labelKey) })}
          </span>
          <FieldDescription>{t("toolOptionsHint")}</FieldDescription>
        </div>
        <Separator className="mb-4" />
        <ToolOptions
          onChange={updateOption}
          tool={tool}
          values={options[tool]}
        />
      </div>

      {/* Tablet/móvil: las opciones se abren en un Sheet lateral. */}
      {!isLg && (
        <Sheet onOpenChange={setOptionsSheetOpen} open={optionsSheetOpen}>
          <SheetContent side="right">
            <SheetHeader className="pb-0">
              <SheetTitle>
                {t("toolOptions", { tool: tt(chatTools[tool].labelKey) })}
              </SheetTitle>
              <SheetDescription>{t("toolOptionsHint")}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <ToolOptions
                onChange={updateOption}
                tool={tool}
                values={options[tool]}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
