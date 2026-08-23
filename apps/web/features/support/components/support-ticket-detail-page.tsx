"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, CheckCircle2, LifeBuoy, Send } from "lucide-react"

import { ApiError, authApi, supportApi } from "@workspace/api-client"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
} from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@workspace/ui/components/message"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"
import { loginPath } from "@/features/identity/login-redirect"

import type {
  SupportComment,
  SupportTicketDetail,
  SupportTicketStatus,
} from "@/features/support/types/support"

const statusVariant: Record<
  SupportTicketStatus,
  "info" | "success" | "secondary"
> = { open: "info", resolved: "success", closed: "secondary" }

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function SupportTicketDetailPage({ ticketId }: { ticketId: string }) {
  const t = useTranslations("support")
  const format = useFormatter()
  const router = useRouter()
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null)
  const [requesterName, setRequesterName] = useState("")
  const [reply, setReply] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [pending, setPending] = useState(false)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
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
      setTicket(await supportApi.get(ticketId))
    } catch (error) {
      if (handleError(error)) return
      if (error instanceof ApiError && error.status === 404) {
        setTicket(null)
        return
      }
      console.error("Support ticket request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError, ticketId])

  useEffect(() => {
    // El temporizador saca el primer `setState` del cuerpo del efecto y cancela
    // la carga anterior cuando el efecto se repite.
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    let isCurrent = true
    void authApi
      .session()
      .then((session) => {
        if (isCurrent) setRequesterName(session.user.displayName)
      })
      .catch(() => {
        // El nombre solo se usa para etiquetar la conversación.
      })
    return () => {
      isCurrent = false
    }
  }, [])

  if (isLoading) {
    return <PageLoading aria-label={t("loadingTicket")} />
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
            description={t("ticketLoadFailed")}
            icon={LifeBuoy}
            title={t("ticketUnavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  if (!ticket) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <Button asChild variant="brand-secondary">
                <Link href="/portal/support">
                  <ArrowLeft data-icon="inline-start" /> {t("backToSupport")}
                </Link>
              </Button>
            }
            description={t("ticketNotFoundDescription")}
            icon={LifeBuoy}
            title={t("ticketNotFound")}
          />
        </CardContent>
      </Card>
    )
  }

  const conversationMessages: SupportComment[] = [
    {
      id: `ticket-description-${ticket.id}`,
      authorName: requesterName || t("you"),
      authorRole: "requester",
      body: ticket.description,
      createdAt: ticket.createdAt,
    },
    ...ticket.comments,
  ]

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reply.trim()) {
      toast.error(t("messageRequired"))
      return
    }
    setPending(true)
    try {
      setTicket(await supportApi.addComment(ticketId, { body: reply.trim() }))
      setReply("")
      toast.success(t("replySent"))
    } catch (error) {
      if (handleError(error)) return
      console.error("Support comment failed", error)
      toast.error(t("replyFailed"))
    } finally {
      setPending(false)
    }
  }

  async function resolveTicket() {
    setPending(true)
    try {
      await supportApi.resolve(ticketId)
      await load()
      toast.success(t("resolved"))
    } catch (error) {
      if (handleError(error)) return
      console.error("Support ticket resolve failed", error)
      toast.error(t("resolveFailed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Button asChild className="w-fit" size="sm" variant="brand-secondary">
        <Link href="/portal/support">
          <ArrowLeft data-icon="inline-start" /> {t("allCases")}
        </Link>
      </Button>
      <Card variant="subtle">
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[ticket.status]}>
                  {t(`status.${ticket.status}`)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {ticket.category.name}
                </span>
              </div>
              <CardTitle className="text-xl leading-snug">
                {ticket.subject}
              </CardTitle>
              <CardDescription>
                {t("createdUpdated", {
                  created: format.dateTime(new Date(ticket.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                  updated: format.dateTime(new Date(ticket.updatedAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </CardDescription>
            </div>
            {ticket.status === "open" ? (
              <Button
                disabled={pending}
                onClick={() => void resolveTicket()}
                size="sm"
                variant="brand-secondary"
              >
                {pending ? <Spinner /> : <CheckCircle2 />} Marcar como resuelto
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <MessageGroup className="gap-6">
            {conversationMessages.map((comment) => {
              const isOutbound = comment.authorRole === "requester"
              const align = isOutbound ? "end" : "start"

              return (
                <Message align={align} key={comment.id}>
                  <MessageAvatar>
                    <Avatar>
                      <AvatarFallback
                        className={
                          isOutbound
                            ? "bg-primary text-xs text-primary-foreground"
                            : "bg-muted text-xs text-foreground"
                        }
                      >
                        {initials(comment.authorName)}
                      </AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                  <MessageContent>
                    <BubbleGroup>
                      <Bubble
                        align={align}
                        variant={isOutbound ? "default" : "muted"}
                      >
                        <BubbleContent>{comment.body}</BubbleContent>
                      </Bubble>
                    </BubbleGroup>
                    <MessageFooter>
                      {comment.authorName} ·{" "}
                      {format.dateTime(new Date(comment.createdAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </MessageFooter>
                  </MessageContent>
                </Message>
              )
            })}
          </MessageGroup>
        </CardContent>
      </Card>
      {ticket.status === "open" ? (
        <Card variant="subtle">
          <CardHeader>
            <CardTitle className="text-base">{t("addInformation")}</CardTitle>
            <CardDescription>
              Comparte un detalle adicional con el equipo que está revisando tu
              caso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              aria-busy={pending}
              className="flex flex-col gap-3"
              noValidate
              onSubmit={(event) => void sendReply(event)}
            >
              <Field>
                <FieldLabel htmlFor="support-reply">
                  {t("answer")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="support-reply"
                  maxLength={5000}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder={t("replyPlaceholder")}
                  rows={4}
                  value={reply}
                />
              </Field>
              <div className="flex justify-end">
                <Button disabled={!reply.trim() || pending} type="submit">
                  {pending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Send data-icon="inline-start" />
                  )}
                  {t("sendReply")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card variant="subtle">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="size-5 text-success" />
            <div>
              <p className="text-sm font-medium">
                Este caso está{" "}
                {ticket.status === "resolved" ? "resuelto" : "cerrado"}
              </p>
              <p className="text-sm text-muted-foreground">
                Si el problema continúa, crea un caso nuevo para que podamos
                revisarlo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
