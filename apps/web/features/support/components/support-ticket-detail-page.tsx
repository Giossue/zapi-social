"use client"

import Link from "next/link"
import { useMemo, useState, type FormEvent } from "react"
import { ArrowLeft, CheckCircle2, LifeBuoy, Send } from "lucide-react"

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
import { FieldError } from "@workspace/ui/components/field"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@workspace/ui/components/message"
import { Textarea } from "@workspace/ui/components/textarea"

import { supportTicketsFixture } from "@/features/support/fixtures/support"
import type {
  SupportComment,
  SupportTicketDetail,
  SupportTicketStatus,
} from "@/features/support/types/support"

const statusLabel: Record<SupportTicketStatus, string> = {
  open: "Abierto",
  resolved: "Resuelto",
  closed: "Cerrado",
}
const statusVariant: Record<
  SupportTicketStatus,
  "info" | "success" | "secondary"
> = { open: "info", resolved: "success", closed: "secondary" }

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function SupportTicketDetailPage({ ticketId }: { ticketId: string }) {
  const initialTicket = useMemo(
    () => supportTicketsFixture.find(({ id }) => id === ticketId) ?? null,
    [ticketId]
  )
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(
    initialTicket
  )
  const [reply, setReply] = useState("")
  const [replyError, setReplyError] = useState<string | null>(null)

  if (!ticket) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            action={
              <Button asChild variant="outline">
                <Link href="/portal/support">
                  <ArrowLeft data-icon="inline-start" /> Volver a soporte
                </Link>
              </Button>
            }
            description="El caso no existe o ya no está disponible en este espacio de trabajo."
            icon={LifeBuoy}
            title="No encontramos este caso"
          />
        </CardContent>
      </Card>
    )
  }

  const conversationMessages: SupportComment[] = [
    {
      id: `ticket-description-${ticket.id}`,
      authorName: "Zapi test chang",
      authorRole: "requester",
      body: ticket.description,
      createdAt: ticket.createdAt,
    },
    ...ticket.comments,
  ]

  function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reply.trim()) {
      setReplyError("Escribe un mensaje antes de enviarlo.")
      return
    }
    const comment: SupportComment = {
      id: `fixture-comment-${Date.now()}`,
      authorName: "Zapi test chang",
      authorRole: "requester",
      body: reply.trim(),
      createdAt: new Date().toISOString(),
    }
    setTicket((current) =>
      current
        ? {
            ...current,
            comments: [...current.comments, comment],
            commentCount: current.commentCount + 1,
            updatedAt: comment.createdAt,
          }
        : current
    )
    setReply("")
    setReplyError(null)
  }

  function resolveTicket() {
    const resolvedAt = new Date().toISOString()
    setTicket((current) =>
      current
        ? { ...current, status: "resolved", resolvedAt, updatedAt: resolvedAt }
        : current
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Button asChild className="w-fit" size="sm" variant="brand-secondary">
        <Link href="/portal/support">
          <ArrowLeft data-icon="inline-start" /> Todos los casos
        </Link>
      </Button>
      <Card>
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[ticket.status]}>
                  {statusLabel[ticket.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {ticket.category.name}
                </span>
              </div>
              <CardTitle className="text-xl leading-snug">
                {ticket.subject}
              </CardTitle>
              <CardDescription>
                Creado {formatDateTime(ticket.createdAt)} · actualizado{" "}
                {formatDateTime(ticket.updatedAt)}
              </CardDescription>
            </div>
            {ticket.status === "open" ? (
              <Button
                onClick={resolveTicket}
                size="sm"
                variant="brand-secondary"
              >
                <CheckCircle2 /> Marcar como resuelto
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
                        {isOutbound ? "ZT" : "ZS"}
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
                      {comment.authorName} · {formatDateTime(comment.createdAt)}
                    </MessageFooter>
                  </MessageContent>
                </Message>
              )
            })}
          </MessageGroup>
        </CardContent>
      </Card>
      {ticket.status === "open" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Añadir información</CardTitle>
            <CardDescription>
              Comparte un detalle adicional con el equipo que está revisando tu
              caso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={sendReply}>
              <Textarea
                aria-invalid={Boolean(replyError)}
                maxLength={5000}
                onChange={(event) => {
                  setReply(event.target.value)
                  setReplyError(null)
                }}
                placeholder="Escribe tu respuesta..."
                rows={4}
                value={reply}
              />
              <FieldError>{replyError}</FieldError>
              <div className="flex justify-end">
                <Button type="submit">
                  <Send data-icon="inline-start" /> Enviar respuesta
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
