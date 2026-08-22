"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  CircleCheck,
  CircleDot,
  CircleX,
  LifeBuoy,
  LockKeyhole,
  MessageSquare,
  Plus,
  X,
} from "lucide-react"

import { ApiError, supportApi } from "@workspace/api-client"
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
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { MetricCard } from "@workspace/ui/components/metric-card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
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
import { loginPath } from "@/features/identity/login-redirect"

import type {
  SupportCategory,
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

type SupportCounts = Record<SupportTicketStatus, number>

const emptyCounts: SupportCounts = { open: 0, resolved: 0, closed: 0 }

function SupportMetrics({ counts }: { counts: SupportCounts }) {
  const items = [
    {
      description: "En espera de atención",
      icon: CircleDot,
      label: "Abiertos",
      value: counts.open,
    },
    {
      description: "Resueltos en el historial",
      icon: CircleCheck,
      label: "Resueltos",
      value: counts.resolved,
    },
    {
      description: "Sin acciones pendientes",
      icon: CircleX,
      label: "Cerrados",
      value: counts.closed,
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
  categories,
  onCreate,
  onOpenChange,
  open,
  pending,
}: {
  categories: readonly SupportCategory[]
  onCreate: (values: NewTicketValues) => Promise<boolean>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
}) {
  const [values, setValues] = useState(emptyTicketValues)
  const canSubmit = Boolean(
    values.categoryId && values.subject.trim() && values.description.trim()
  )

  function close() {
    setValues(emptyTicketValues)
    onOpenChange(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }

    const created = await onCreate({
      categoryId: values.categoryId,
      subject: values.subject.trim(),
      description: values.description.trim(),
    })
    if (created) close()
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
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
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
                      {categories.map((category) => (
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
            <Button
              disabled={pending}
              onClick={close}
              type="button"
              variant="brand-secondary"
            >
              <X data-icon="inline-start" /> Cancelar
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LifeBuoy data-icon="inline-start" />
              )}
              Crear caso
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

const pageSize = 10

export function SupportTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [counts, setCounts] = useState<SupportCounts>(emptyCounts)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SupportTicketStatus | "all">("all")
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [canView, setCanView] = useState(true)
  const [pending, setPending] = useState(false)

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

  const loadCounts = useCallback(async () => {
    const [open, resolved, closed] = await Promise.all([
      supportApi.list({ limit: 1, status: "open" }),
      supportApi.list({ limit: 1, status: "resolved" }),
      supportApi.list({ limit: 1, status: "closed" }),
    ])
    setCounts({
      open: open.total,
      resolved: resolved.total,
      closed: closed.total,
    })
  }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const [response] = await Promise.all([
        supportApi.list({
          limit: pageSize,
          page,
          ...(query.trim() ? { q: query.trim() } : {}),
          ...(status === "all" ? {} : { status }),
        }),
        loadCounts(),
      ])
      setTickets(response.tickets)
      setTotal(response.total)
      setCanView(true)
    } catch (error) {
      if (handleError(error)) return
      console.error("Support tickets request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError, loadCounts, page, query, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  useEffect(() => {
    let isCurrent = true
    void supportApi
      .categories()
      .then((response) => {
        if (isCurrent) setCategories(response)
      })
      .catch((error: unknown) => {
        if (handleError(error)) return
        console.error("Support categories request failed", error)
      })
    return () => {
      isCurrent = false
    }
  }, [handleError])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = total ? rangeStart + tickets.length - 1 : 0
  const hasFilters = Boolean(query || status !== "all")

  function clearFilters() {
    setQuery("")
    setStatus("all")
    setPage(1)
  }

  async function createTicket(values: NewTicketValues) {
    setPending(true)
    try {
      await supportApi.create(values)
      setPage(1)
      await load()
      toast.success("Caso de soporte creado.")
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Support ticket creation failed", error)
      toast.error("No pudimos crear el caso. Inténtalo de nuevo.")
      return false
    } finally {
      setPending(false)
    }
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

  if (isLoading && !tickets.length && !loadError) {
    return <PageLoading aria-label="Cargando casos de soporte" />
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
            description="No pudimos cargar tus casos de soporte."
            icon={LifeBuoy}
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
        <SupportMetrics counts={counts} />
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
                  {tickets.length ? (
                    tickets.map((ticket) => (
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
                        ) : null
                      }
                      description={
                        hasFilters
                          ? "Prueba con otro término o estado."
                          : "Cuando necesites ayuda, abre un caso y tendrás toda la conversación aquí."
                      }
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
              total={total}
            />
          </CardContent>
        </Card>

        <FloatingActionButton
          label="Nuevo caso"
          onClick={() => setIsCreateOpen(true)}
        />
      </div>
      <NewSupportTicketSheet
        categories={categories}
        onCreate={createTicket}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
        pending={pending}
      />
    </>
  )
}
