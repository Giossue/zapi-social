"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  CircleAlert,
  ListChecks,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import {
  ApiError,
  bulkPostsApi,
  channelsApi,
  filesApi,
} from "@workspace/api-client"
import type {
  PortalBulkPostBatch,
  PortalBulkPostBatchDetail,
  PortalChannelAccount,
  PortalFileAsset,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
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
import { toast } from "@workspace/ui/components/toast"
import { loginPath } from "@/features/identity/login-redirect"

type BatchStatus = PortalBulkPostBatch["status"]
type RowStatus = PortalBulkPostBatchDetail["rows"][number]["status"]

const pageSize = 10
const rowsPageSize = 50

const statusLabel: Record<BatchStatus, string> = {
  queued: "En cola",
  processing: "Procesando",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
}

const statusVariant: Record<
  BatchStatus,
  "info" | "warning" | "success" | "destructive" | "neutral"
> = {
  queued: "info",
  processing: "warning",
  completed: "success",
  failed: "destructive",
  cancelled: "neutral",
}

const rowStatusLabel: Record<RowStatus, string> = {
  pending: "Pendiente",
  valid: "Válida",
  invalid: "Inválida",
  processed: "Procesada",
  failed: "Fallida",
}

const rowStatusVariant: Record<
  RowStatus,
  "info" | "success" | "warning" | "destructive" | "neutral"
> = {
  pending: "neutral",
  valid: "info",
  invalid: "warning",
  processed: "success",
  failed: "destructive",
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function isSourceCandidate(file: PortalFileAsset) {
  return /\.(csv|txt)$/i.test(file.name)
}

function NewBatchSheet({
  accounts,
  files,
  onCreate,
  onOpenChange,
  open,
  pending,
  timezone,
}: {
  accounts: readonly PortalChannelAccount[]
  files: readonly PortalFileAsset[]
  onCreate: (input: {
    sourceFileAssetId: string
    targetSocialAccountIds: string[]
    intervalMinutes: number
  }) => Promise<boolean>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
  timezone: string
}) {
  const [sourceFileAssetId, setSourceFileAssetId] = useState("")
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [interval, setInterval] = useState("60")

  useEffect(() => {
    if (!open) {
      setSourceFileAssetId("")
      setAccountIds([])
      setInterval("60")
    }
  }, [open])

  const intervalMinutes = Number(interval)
  const canSubmit = Boolean(
    sourceFileAssetId &&
    accountIds.length &&
    Number.isInteger(intervalMinutes) &&
    intervalMinutes >= 1 &&
    intervalMinutes <= 10080
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(
        "Elige un archivo, al menos una cuenta y un intervalo entre 1 y 10080 minutos."
      )
      return
    }
    const created = await onCreate({
      intervalMinutes,
      sourceFileAssetId,
      targetSocialAccountIds: accountIds,
    })
    if (created) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Nuevo lote</SheetTitle>
          <SheetDescription>
            Elige un CSV de tu biblioteca y define en qué cuentas se crearán sus
            publicaciones.
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
                <FieldLabel htmlFor="bulk-source">
                  Archivo CSV{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                {files.length ? (
                  <Select
                    disabled={pending}
                    onValueChange={setSourceFileAssetId}
                    value={sourceFileAssetId}
                  >
                    <SelectTrigger
                      aria-required="true"
                      className="w-full"
                      id="bulk-source"
                    >
                      <SelectValue placeholder="Selecciona un archivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {files.map((file) => (
                          <SelectItem key={file.id} value={file.id}>
                            {file.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <FieldDescription>
                    Sube un archivo .csv o .txt a la biblioteca para crear un
                    lote.
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-interval">
                  Intervalo entre publicaciones{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="bulk-interval"
                  max={10080}
                  min={1}
                  onChange={(event) => setInterval(event.target.value)}
                  type="number"
                  value={interval}
                />
                <FieldDescription>
                  Minutos entre cada publicación. Se programan en {timezone}.
                </FieldDescription>
              </Field>
              <FieldSet>
                <FieldLabel asChild>
                  <legend>
                    Cuentas destino{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </legend>
                </FieldLabel>
                {accounts.length ? (
                  <FieldGroup className="gap-3" data-slot="checkbox-group">
                    {accounts.map((account) => {
                      const controlId = `bulk-account-${account.id}`
                      return (
                        <Field key={account.id} orientation="horizontal">
                          <Checkbox
                            checked={accountIds.includes(account.id)}
                            disabled={pending}
                            id={controlId}
                            onCheckedChange={(value) =>
                              setAccountIds((current) =>
                                value === true
                                  ? [...current, account.id]
                                  : current.filter((id) => id !== account.id)
                              )
                            }
                          />
                          <FieldLabel htmlFor={controlId}>
                            <FieldContent>
                              <FieldTitle>{account.displayName}</FieldTitle>
                              <FieldDescription>
                                {account.handle ?? account.externalName ?? ""}
                              </FieldDescription>
                            </FieldContent>
                          </FieldLabel>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                ) : (
                  <FieldDescription>
                    Conecta una cuenta antes de crear un lote.
                  </FieldDescription>
                )}
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
              Cancelar
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              Crear lote
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function BatchRowsSheet({
  detail,
  loading,
  onOpenChange,
  open,
}: {
  detail: PortalBulkPostBatchDetail | null
  loading: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>
            {detail ? detail.batch.sourceFileName : "Filas del lote"}
          </SheetTitle>
          <SheetDescription>
            Estado por fila y errores de validación detectados al procesar el
            archivo.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {loading || !detail ? (
            <PageLoading aria-label="Cargando filas del lote" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.rows.length ? (
                  detail.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>
                        <Badge variant={rowStatusVariant[row.status]}>
                          {rowStatusLabel[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.validationErrors.length ? (
                          <ul className="flex flex-col gap-1 text-sm text-destructive">
                            {row.validationErrors.map((error) => (
                              <li key={error}>{error}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {row.publishingPostIds.length
                              ? `${row.publishingPostIds.length} publicación(es) creadas`
                              : "Sin observaciones"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    colSpan={3}
                    description="Este lote todavía no registra filas procesadas."
                    title="Sin filas"
                  />
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function BulkPostsPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<PortalBulkPostBatch[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<BatchStatus | "all">("all")
  const [accounts, setAccounts] = useState<PortalChannelAccount[]>([])
  const [files, setFiles] = useState<PortalFileAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [canView, setCanView] = useState(true)
  const [pending, setPending] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [detail, setDetail] = useState<PortalBulkPostBatchDetail | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [toCancel, setToCancel] = useState<PortalBulkPostBatch | null>(null)

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Guayaquil"

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
      const response = await bulkPostsApi.list({
        limit: pageSize,
        page,
        ...(status === "all" ? {} : { status }),
      })
      setBatches(response.batches)
      setTotal(response.total)
      setCanView(true)
    } catch (error) {
      if (handleError(error)) return
      console.error("Bulk post batches request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError, page, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let isCurrent = true
    void Promise.all([
      channelsApi.list({ limit: 50 }),
      filesApi.list({ limit: 100 }),
    ])
      .then(([channels, library]) => {
        if (!isCurrent) return
        setAccounts(
          channels.accounts.filter((account) => account.status === "connected")
        )
        setFiles(library.files.filter(isSourceCandidate))
      })
      .catch((error: unknown) => {
        if (handleError(error)) return
        console.error("Bulk post prerequisites request failed", error)
      })
    return () => {
      isCurrent = false
    }
  }, [handleError])

  async function createBatch(input: {
    sourceFileAssetId: string
    targetSocialAccountIds: string[]
    intervalMinutes: number
  }) {
    setPending(true)
    try {
      await bulkPostsApi.create({ ...input, timezone })
      setPage(1)
      await load()
      toast.success("Lote creado. Se procesará en segundo plano.")
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Bulk post batch creation failed", error)
      toast.error("No pudimos crear el lote. Revisa el archivo e inténtalo.")
      return false
    } finally {
      setPending(false)
    }
  }

  async function cancelBatch(batch: PortalBulkPostBatch) {
    setPending(true)
    try {
      await bulkPostsApi.cancel(batch.id)
      setToCancel(null)
      await load()
      toast.success("Lote cancelado.")
    } catch (error) {
      if (handleError(error)) return
      console.error("Bulk post batch cancellation failed", error)
      toast.error("No pudimos cancelar el lote. Inténtalo de nuevo.")
    } finally {
      setPending(false)
    }
  }

  async function openDetail(batch: PortalBulkPostBatch) {
    setDetail(null)
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    try {
      setDetail(await bulkPostsApi.get(batch.id, { limit: rowsPageSize }))
    } catch (error) {
      if (handleError(error)) return
      console.error("Bulk post rows request failed", error)
      toast.error("No pudimos cargar las filas de este lote.")
      setIsDetailOpen(false)
    } finally {
      setIsDetailLoading(false)
    }
  }

  if (!canView) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Tu acceso actual no permite consultar las publicaciones masivas de este espacio de trabajo."
            icon={LockKeyhole}
            title="Publicaciones masivas no disponibles"
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !batches.length && !loadError) {
    return <PageLoading aria-label="Cargando lotes" />
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
            description="No pudimos cargar los lotes de este espacio de trabajo."
            icon={CircleAlert}
            title="Publicaciones masivas no disponibles"
          />
        </CardContent>
      </Card>
    )
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = total ? rangeStart + batches.length - 1 : 0

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Importa un CSV, valida cada fila y crea publicaciones por cuenta."
          title="Publicaciones masivas"
        />
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button
                className="hidden sm:inline-flex"
                onClick={() => setIsCreateOpen(true)}
                size="sm"
                type="button"
              >
                <Plus data-icon="inline-start" /> Nuevo lote
              </Button>
            }
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar
              actions={
                status !== "all" ? (
                  <Button
                    onClick={() => {
                      setStatus("all")
                      setPage(1)
                    }}
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
                  setStatus(value as BatchStatus | "all")
                  setPage(1)
                }}
                options={[
                  { label: "Todos", value: "all" },
                  { label: "En cola", value: "queued" },
                  { label: "Procesando", value: "processing" },
                  { label: "Completados", value: "completed" },
                  { label: "Fallidos", value: "failed" },
                  { label: "Cancelados", value: "cancelled" },
                ]}
                value={status}
              />
            </DataTableToolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Destinos</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length ? (
                  batches.map((batch) => {
                    const cancellable =
                      batch.status === "queued" || batch.status === "processing"
                    return (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <div className="flex min-w-48 flex-col">
                            <span className="font-medium">
                              {batch.sourceFileName}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatDateTime(batch.createdAt)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {batch.targetAccountIds.length}{" "}
                          {batch.targetAccountIds.length === 1
                            ? "cuenta"
                            : "cuentas"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>
                              {batch.createdPosts} de {batch.validRows} creadas
                            </span>
                            {batch.invalidRows || batch.failedRows ? (
                              <span className="text-sm text-warning">
                                {batch.invalidRows} inválidas ·{" "}
                                {batch.failedRows} fallidas
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {batch.totalRows} filas
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[batch.status]}>
                            {statusLabel[batch.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={`Abrir acciones para ${batch.sourceFileName}`}
                                className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                size="icon-sm"
                                variant="brand-secondary"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" size="compact">
                              <DropdownMenuItem
                                onSelect={() => void openDetail(batch)}
                                size="compact"
                              >
                                <ListChecks />
                                Ver filas
                              </DropdownMenuItem>
                              {cancellable ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => setToCancel(batch)}
                                    size="compact"
                                    variant="destructive"
                                  >
                                    <Trash2 />
                                    Cancelar lote
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableEmptyRow
                    action={
                      status === "all" ? null : (
                        <Button
                          onClick={() => {
                            setStatus("all")
                            setPage(1)
                          }}
                          variant="outline"
                        >
                          Restablecer filtros
                        </Button>
                      )
                    }
                    colSpan={5}
                    description={
                      status === "all"
                        ? "Sube un CSV a la biblioteca y crea un lote para procesarlo."
                        : "No hay lotes con ese estado."
                    }
                    title={
                      status === "all"
                        ? "No hay lotes todavía"
                        : "No hay coincidencias"
                    }
                  />
                )}
              </TableBody>
            </Table>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel="lotes"
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
          label="Nuevo lote"
          onClick={() => setIsCreateOpen(true)}
        />
      </div>
      <NewBatchSheet
        accounts={accounts}
        files={files}
        onCreate={createBatch}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
        pending={pending}
        timezone={timezone}
      />
      <BatchRowsSheet
        detail={detail}
        loading={isDetailLoading}
        onOpenChange={setIsDetailOpen}
        open={isDetailOpen}
      />
      <AlertDialog
        onOpenChange={(open) => !open && setToCancel(null)}
        open={Boolean(toCancel)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Las publicaciones ya creadas se conservan; las filas pendientes
              dejan de procesarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                if (toCancel) void cancelBatch(toCancel)
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Cancelar lote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
