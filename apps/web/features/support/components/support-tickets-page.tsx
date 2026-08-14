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
import { CardGrid } from "@workspace/ui/components/card-grid"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { MetricCard } from "@workspace/ui/components/metric-card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

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
      description: "En espera de atención",
      icon: CircleDot,
      label: "Abiertos",
      value: tickets.filter((ticket) => ticket.status === "open").length,
    },
    {
      description: "Resueltos en el historial",
      icon: CircleCheck,
      label: "Resueltos",
      value: tickets.filter((ticket) => ticket.status === "resolved").length,
    },
    {
      description: "Sin acciones pendientes",
      icon: CircleX,
      label: "Cerrados",
      value: tickets.filter((ticket) => ticket.status === "closed").length,
    },
  ]

  return (
    <CardGrid layout="xl-3">
      {items.map((item) => (
        <MetricCard key={item.label} {...item} />
      ))}
    </CardGrid>
  )
}

function NewSupportTicketSheet({
  onCreate,
  onOpenChange,
  open,
}: {
  onCreate: (values: NewTicketValues) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [values, setValues] = useState(emptyTicketValues)
  const canSubmit = Boolean(
    values.categoryId && values.subject.trim() && values.description.trim()
  )

  function close() {
    setValues(emptyTicketValues)
    onOpenChange(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }

    onCreate({
      categoryId: values.categoryId,
      subject: values.subject.trim(),
      description: values.description.trim(),
    })
    close()
  }

  return (
    <Sheet
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
      open={open}
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Nuevo caso de soporte</SheetTitle>
          <SheetDescription>
            Describe lo que necesitas. Podrás revisar las respuestas y añadir
            información desde este mismo caso.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={submit}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
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
                  onValueChange={(categoryId) =>
                    setValues((current) => ({ ...current, categoryId }))
                  }
                  value={values.categoryId}
                >
                  <SelectTrigger
                    aria-required="true"
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
                  aria-required="true"
                  id="support-subject"
                  maxLength={250}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  placeholder="Ej. No puedo publicar en Instagram"
                  value={values.subject}
                />
                <FieldDescription>
                  Usa una frase breve para reconocer el caso después.
                </FieldDescription>
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
                  aria-required="true"
                  id="support-description"
                  maxLength={5000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Qué estabas haciendo, qué esperabas que ocurriera y qué ocurrió en su lugar."
                  rows={6}
                  value={values.description}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button onClick={close} type="button" variant="brand-secondary">
              <X data-icon="inline-start" /> Cancelar
            </Button>
            <Button disabled={!canSubmit} type="submit">
              <LifeBuoy data-icon="inline-start" />
              Crear caso
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
      <Card variant="subtle">
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
        <CollectionHeader
          description="Revisa tus casos abiertos y habla con el equipo de Zapi desde un único lugar."
          title="Soporte"
        />
        <SupportMetrics tickets={tickets} />
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button
                className="hidden sm:inline-flex"
                onClick={() => setIsCreateOpen(true)}
                size="sm"
                type="button"
              >
                <Plus data-icon="inline-start" /> Nuevo caso
              </Button>
            }
            search={{
              ariaLabel: "Buscar casos de soporte",
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: "Buscar casos...",
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar
              actions={
                hasFilters ? (
                  <Button
                    onClick={clearFilters}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <X /> Limpiar
                  </Button>
                ) : undefined
              }
            >
              <DataTableFilter
                ariaLabel="Filtrar por estado"
                label="Estado"
                onValueChange={(value) => {
                  const next = value as SupportTicketStatus | "all"
                  setStatus(next)
                  setPage(1)
                }}
                options={[
                  { label: "Todos", value: "all" },
                  { label: "Abiertos", value: "open" },
                  { label: "Resueltos", value: "resolved" },
                  { label: "Cerrados", value: "closed" },
                ]}
                value={status}
              />
            </DataTableToolbar>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caso</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Categoría
                    </TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Actualizado
                    </TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTickets.length ? (
                    visibleTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <div className="flex min-w-48 flex-col gap-1">
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
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {ticket.category.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[ticket.status]}>
                            {statusLabel[ticket.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {formatDate(ticket.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="brand-secondary">
                            <Link href={`/portal/support/${ticket.id}`}>
                              <MessageSquare data-icon="inline-start" /> Ver
                              caso
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyRow
                      colSpan={5}
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
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel="casos"
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

        <FloatingActionButton
          label="Nuevo caso"
          onClick={() => setIsCreateOpen(true)}
        />
      </div>
      <NewSupportTicketSheet
        onCreate={createTicket}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
      />
    </>
  )
}
