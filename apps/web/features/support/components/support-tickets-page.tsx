"use client"

import Link from "next/link"
import { useMemo, useState, type FormEvent } from "react"
import {
  CircleCheck,
  CircleDot,
  CircleX,
  LifeBuoy,
  LockKeyhole,
  MessageSquare,
  Plus,
  Search,
  X,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  supportCategoriesFixture,
  supportTicketsFixture,
} from "@/features/support/fixtures/support"
import type {
  SupportTicket,
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
> = {
  open: "info",
  resolved: "success",
  closed: "secondary",
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

type NewTicketValues = {
  categoryId: string
  subject: string
  description: string
}

const emptyTicketValues: NewTicketValues = {
  categoryId: "",
  subject: "",
  description: "",
}

function SupportMetrics({ tickets }: { tickets: readonly SupportTicket[] }) {
  const items = [
    {
      icon: CircleDot,
      label: "Abiertos",
      value: tickets.filter((ticket) => ticket.status === "open").length,
    },
    {
      icon: CircleCheck,
      label: "Resueltos",
      value: tickets.filter((ticket) => ticket.status === "resolved").length,
    },
    {
      icon: CircleX,
      label: "Cerrados",
      value: tickets.filter((ticket) => ticket.status === "closed").length,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(({ icon: Icon, label, value }) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardAction>
              <Icon
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-3xl leading-none tracking-tight">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function NewSupportTicketDialog({
  onCreate,
  onOpenChange,
  open,
}: {
  onCreate: (values: NewTicketValues) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [values, setValues] = useState(emptyTicketValues)
  const [errors, setErrors] = useState<
    Partial<Record<keyof NewTicketValues, string>>
  >({})

  function close() {
    setValues(emptyTicketValues)
    setErrors({})
    onOpenChange(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof NewTicketValues, string>> = {}
    if (!values.categoryId)
      nextErrors.categoryId =
        "Selecciona la categoría que mejor describe el caso."
    if (!values.subject.trim())
      nextErrors.subject = "Escribe un asunto para identificar el caso."
    if (!values.description.trim())
      nextErrors.description =
        "Describe lo que ocurre para que podamos ayudarte."

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    onCreate({
      categoryId: values.categoryId,
      subject: values.subject.trim(),
      description: values.description.trim(),
    })
    close()
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
      open={open}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo caso de soporte</DialogTitle>
          <DialogDescription>
            Describe lo que necesitas. Podrás revisar las respuestas y añadir
            información desde este mismo caso.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="support-category">
                Categoría{" "}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
                <span className="sr-only"> obligatorio</span>
              </FieldLabel>
              <Select
                onValueChange={(categoryId) => {
                  setValues((current) => ({ ...current, categoryId }))
                  setErrors((current) => ({
                    ...current,
                    categoryId: undefined,
                  }))
                }}
                value={values.categoryId}
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.categoryId)}
                  className="w-full"
                  id="support-category"
                >
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {supportCategoriesFixture.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{errors.categoryId}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="support-subject">
                Asunto{" "}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
                <span className="sr-only"> obligatorio</span>
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.subject)}
                id="support-subject"
                maxLength={250}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                  setErrors((current) => ({ ...current, subject: undefined }))
                }}
                placeholder="Ej. No puedo publicar en Instagram"
                value={values.subject}
              />
              <FieldDescription>
                Usa una frase breve para reconocer el caso después.
              </FieldDescription>
              <FieldError>{errors.subject}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="support-description">
                Descripción{" "}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
                <span className="sr-only"> obligatorio</span>
              </FieldLabel>
              <Textarea
                aria-invalid={Boolean(errors.description)}
                id="support-description"
                maxLength={5000}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                  setErrors((current) => ({
                    ...current,
                    description: undefined,
                  }))
                }}
                placeholder="Qué estabas haciendo, qué esperabas que ocurriera y qué ocurrió en su lugar."
                rows={6}
                value={values.description}
              />
              <FieldError>{errors.description}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button onClick={close} type="button" variant="outline">
              Cancelar
            </Button>
            <Button type="submit">
              <LifeBuoy data-icon="inline-start" />
              Crear caso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>(supportTicketsFixture)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SupportTicketStatus | "all">("all")
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const canView = true
  const pageSize = 10

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return tickets.filter((ticket) => {
      const matchesStatus = status === "all" || ticket.status === status
      const matchesQuery =
        !normalizedQuery ||
        [ticket.subject, ticket.description, ticket.category.name].some(
          (value) => value.toLocaleLowerCase("es").includes(normalizedQuery)
        )
      return matchesStatus && matchesQuery
    })
  }, [query, status, tickets])
  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleTickets = filteredTickets.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )
  const rangeStart = filteredTickets.length ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = filteredTickets.length
    ? rangeStart + visibleTickets.length - 1
    : 0
  const hasFilters = Boolean(query || status !== "all")

  function clearFilters() {
    setQuery("")
    setStatus("all")
    setPage(1)
  }

  function createTicket(values: NewTicketValues) {
    const category = supportCategoriesFixture.find(
      ({ id }) => id === values.categoryId
    )
    if (!category) return
    const now = new Date().toISOString()
    setTickets((current) => [
      {
        id: `fixture-${Date.now()}`,
        category,
        subject: values.subject,
        description: values.description,
        status: "open",
        commentCount: 0,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      },
      ...current,
    ])
    setPage(1)
  }

  if (!canView) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            description="Tu acceso actual no permite consultar los casos de soporte de este espacio de trabajo."
            icon={LockKeyhole}
            title="Soporte no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <SupportMetrics tickets={tickets} />
        <Card>
          <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
            <CardTitle className="text-xl leading-none">Soporte</CardTitle>
            <CardDescription className="max-w-xl leading-snug">
              Revisa tus casos abiertos y habla con el equipo de Zapi desde un
              único lugar.
            </CardDescription>
            <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
              <InputGroup className="h-7 w-full md:w-64">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Buscar casos de soporte"
                  className="h-7"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Buscar casos..."
                  value={query}
                />
              </InputGroup>
              <Button
                onClick={() => setIsCreateOpen(true)}
                size="sm"
                type="button"
              >
                <Plus /> Nuevo caso
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0">
            <div className="flex flex-wrap items-center gap-3 px-4">
              <Select
                onValueChange={(value: SupportTicketStatus | "all") => {
                  setStatus(value)
                  setPage(1)
                }}
                value={status}
              >
                <SelectTrigger size="sm">
                  <span className="text-muted-foreground">Estado:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" position="popper">
                  <SelectGroup>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Abiertos</SelectItem>
                    <SelectItem value="resolved">Resueltos</SelectItem>
                    <SelectItem value="closed">Cerrados</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {hasFilters ? (
                <Button
                  onClick={clearFilters}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <X /> Limpiar
                </Button>
              ) : null}
            </div>
            <div>
              <Table className="**:data-[slot=table-cell]:px-4 **:data-[slot=table-head]:px-4">
                <TableHeader className="[&_tr]:border-t">
                  <TableRow>
                    <TableHead className="py-4 font-normal">Caso</TableHead>
                    <TableHead className="hidden py-4 font-normal md:table-cell">
                      Categoría
                    </TableHead>
                    <TableHead className="py-4 font-normal">Estado</TableHead>
                    <TableHead className="hidden py-4 font-normal lg:table-cell">
                      Actualizado
                    </TableHead>
                    <TableHead className="py-4 text-right font-normal">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTickets.length ? (
                    visibleTickets.map((ticket) => (
                      <TableRow
                        className="border-border/60 hover:bg-white/2.5"
                        key={ticket.id}
                      >
                        <TableCell className="py-4 align-middle">
                          <div className="min-w-48 space-y-1">
                            <span className="font-medium">
                              {ticket.subject}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MessageSquare className="size-3.5" />
                              {ticket.commentCount}{" "}
                              {ticket.commentCount === 1
                                ? "respuesta"
                                : "respuestas"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden py-4 align-middle text-muted-foreground md:table-cell">
                          {ticket.category.name}
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <Badge variant={statusVariant[ticket.status]}>
                            {statusLabel[ticket.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden py-4 align-middle text-muted-foreground lg:table-cell">
                          {formatDate(ticket.updatedAt)}
                        </TableCell>
                        <TableCell className="py-4 text-right align-middle">
                          <Button asChild size="sm" variant="brand-secondary">
                            <Link href={`/portal/support/${ticket.id}`}>
                              Ver caso
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <EmptyState
                          action={
                            hasFilters ? (
                              <Button onClick={clearFilters} variant="outline">
                                Restablecer filtros
                              </Button>
                            ) : (
                              <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus data-icon="inline-start" /> Crear caso
                              </Button>
                            )
                          }
                          description={
                            hasFilters
                              ? "Prueba con otro término o estado."
                              : "Cuando necesites ayuda, abre un caso y tendrás toda la conversación aquí."
                          }
                          icon={hasFilters ? Search : LifeBuoy}
                          title={
                            hasFilters
                              ? "No hay coincidencias"
                              : "Aún no tienes casos de soporte"
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel="casos"
              mode="compact"
              onNextPage={() =>
                setPage((current) => Math.min(current + 1, pageCount))
              }
              onPreviousPage={() =>
                setPage((current) => Math.max(current - 1, 1))
              }
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={filteredTickets.length}
            />
          </CardContent>
        </Card>
      </div>
      <NewSupportTicketDialog
        onCreate={createTicket}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
      />
    </>
  )
}
