"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  LifeBuoy,
  Lock,
  RotateCcw,
  Send,
  ShieldX,
} from "lucide-react"

import { adminSupportApi, ApiError } from "@workspace/api-client"
import type {
  AdminSupportTicketComment,
  AdminSupportTicketDetail,
  AdminSupportTicketStatus,
} from "@workspace/contracts"
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
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@workspace/ui/components/message"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

const statusLabel: Record<AdminSupportTicketStatus, string> = {
  open: "Abierto",
  resolved: "Resuelto",
  closed: "Cerrado",
}
const statusVariant: Record<
  AdminSupportTicketStatus,
  "info" | "success" | "secondary"
> = { open: "info", resolved: "success", closed: "secondary" }

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function AdminSupportTicketPage({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [ticket, setTicket] = useState<AdminSupportTicketDetail | null>(null)
  const [reply, setReply] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [missing, setMissing] = useState(false)
  const [pending, setPending] = useState(false)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
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
      setTicket(await adminSupportApi.get(ticketId))
      setMissing(false)
    } catch (error) {
      if (handleError(error)) return
      if (error instanceof ApiError && error.status === 404) {
        setMissing(true)
        return
      }
      console.error("Admin support ticket request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError, ticketId])

  useEffect(() => {
    void load()
  }, [load])

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reply.trim()) {
      toast.error("Escribe una respuesta antes de enviarla.")
      return
    }
    setPending(true)
    try {
      setTicket(await adminSupportApi.reply(ticketId, { body: reply.trim() }))
      setReply("")
      toast.success("Respuesta enviada al cliente.")
    } catch (error) {
      if (handleError(error)) return
      console.error("Admin support reply failed", error)
      toast.error("No pudimos enviar la respuesta. Inténtalo de nuevo.")
    } finally {
      setPending(false)
    }
  }

  async function changeStatus(status: AdminSupportTicketStatus) {
    setPending(true)
    try {
      setTicket(await adminSupportApi.setStatus(ticketId, { status }))
      toast.success(`Caso marcado como ${statusLabel[status].toLowerCase()}.`)
    } catch (error) {
      if (handleError(error)) return
      console.error("Admin support status change failed", error)
      toast.error("No pudimos actualizar el estado del caso.")
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        description="Tu cuenta no tiene permisos para administrar el soporte de la plataforma."
        icon={ShieldX}
        title="Acceso restringido"
      />
    )
  }

  if (isLoading && !ticket) {
    return <PageLoading aria-label="Cargando caso de soporte" />
  }

  if (loadError) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description="No fue posible cargar este caso de soporte."
        icon={LifeBuoy}
        title="No pudimos cargar el caso"
      />
    )
  }

  if (missing || !ticket) {
    return (
      <EmptyState
        action={
          <Button asChild variant="brand-secondary">
            <Link href="/admin/support">
              <ArrowLeft data-icon="inline-start" /> Volver a la cola
            </Link>
          </Button>
        }
        description="El caso no existe o fue eliminado."
        icon={LifeBuoy}
        title="No encontramos este caso"
      />
    )
  }

  const conversation: AdminSupportTicketComment[] = [
    {
      id: `ticket-description-${ticket.id}`,
      authorName: ticket.requester.displayName,
      authorRole: "requester",
      body: ticket.description,
      createdAt: ticket.createdAt,
    },
    ...ticket.comments,
  ]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Button asChild className="w-fit" size="sm" variant="brand-secondary">
        <Link href="/admin/support">
          <ArrowLeft data-icon="inline-start" /> Todos los casos
        </Link>
      </Button>
      <Card variant="subtle">
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[ticket.status]}>
                  {statusLabel[ticket.status]}
                </Badge>
                {ticket.awaitingReply ? (
                  <Badge variant="warning">Sin responder</Badge>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  {ticket.category.name}
                </span>
              </div>
              <CardTitle className="text-xl leading-snug">
                {ticket.subject}
              </CardTitle>
              <CardDescription>
                {ticket.requester.displayName} · {ticket.requester.email} ·{" "}
                {ticket.workspace.name}
              </CardDescription>
              <CardDescription>
                Creado {formatDateTime(ticket.createdAt)} · última actividad{" "}
                {formatDateTime(ticket.lastActivityAt)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {ticket.status === "open" ? (
                <Button
                  disabled={pending}
                  onClick={() => void changeStatus("resolved")}
                  size="sm"
                  variant="brand-secondary"
                >
                  {pending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <CheckCircle2 data-icon="inline-start" />
                  )}
                  Marcar resuelto
                </Button>
              ) : (
                <Button
                  disabled={pending}
                  onClick={() => void changeStatus("open")}
                  size="sm"
                  variant="brand-secondary"
                >
                  {pending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <RotateCcw data-icon="inline-start" />
                  )}
                  Reabrir
                </Button>
              )}
              {ticket.status === "closed" ? null : (
                <Button
                  disabled={pending}
                  onClick={() => void changeStatus("closed")}
                  size="sm"
                  variant="brand-secondary"
                >
                  <Lock data-icon="inline-start" /> Cerrar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <MessageGroup className="gap-6">
            {conversation.map((comment) => {
              const isSupport = comment.authorRole === "support"
              const align = isSupport ? "end" : "start"

              return (
                <Message align={align} key={comment.id}>
                  <MessageAvatar>
                    <Avatar>
                      <AvatarFallback
                        className={
                          isSupport
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
                        variant={isSupport ? "default" : "muted"}
                      >
                        <BubbleContent>{comment.body}</BubbleContent>
                      </Bubble>
                    </BubbleGroup>
                    <MessageFooter>
                      {comment.authorName} · {formatDateTime(comment.createdAt)}
                    </MessageFooter>
                  </MessageContent>
                </Message>
              )
            })}
          </MessageGroup>
        </CardContent>
      </Card>
      {ticket.status === "closed" ? (
        <Card variant="subtle">
          <CardContent className="flex items-center gap-3 py-4">
            <Lock className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Este caso está cerrado</p>
              <p className="text-sm text-muted-foreground">
                Reábrelo para volver a escribir al cliente.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card variant="subtle">
          <CardHeader>
            <CardTitle className="text-base">Responder al cliente</CardTitle>
            <CardDescription>
              La respuesta aparece en el caso del Portal y marca el hilo como
              atendido.
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
                <FieldLabel htmlFor="admin-support-reply">
                  Respuesta{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="admin-support-reply"
                  maxLength={5000}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Escribe la respuesta del equipo..."
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
                  Enviar respuesta
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
