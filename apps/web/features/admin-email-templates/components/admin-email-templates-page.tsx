"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  CircleAlert,
  Mail,
  Pencil,
  RotateCcw,
  Save,
  ShieldX,
  } from "lucide-react"

import { adminEmailTemplatesApi, ApiError } from "@workspace/api-client"
import type { AdminEmailTemplate } from "@workspace/contracts"
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
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

type FormValues = {
  subject: string
  title: string
  body: string
  actionLabel: string
  notice: string
}

function toForm(template: AdminEmailTemplate): FormValues {
  return {
    subject: template.subject,
    title: template.title,
    body: template.body,
    actionLabel: template.actionLabel ?? "",
    notice: template.notice ?? "",
  }
}

function TemplateSheet({
  onOpenChange,
  onSubmit,
  open,
  pending,
  template,
}: {
  onOpenChange: (open: boolean) => void
  onSubmit: (values: FormValues) => Promise<boolean>
  open: boolean
  pending: boolean
  template: AdminEmailTemplate | null
}) {
  const [values, setValues] = useState<FormValues>({
    subject: "",
    title: "",
    body: "",
    actionLabel: "",
    notice: "",
  })

  useEffect(() => {
    if (open && template) setValues(toForm(template))
  }, [open, template])

  const canSubmit = Boolean(
    values.subject.trim() && values.title.trim() && values.body.trim()
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }
    const saved = await onSubmit(values)
    if (saved) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{template?.name ?? "Plantilla"}</SheetTitle>
          <SheetDescription>
            {template?.description}. La maquetación, el botón y los datos
            calculados del correo no cambian.
          </SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            {template?.variables.length ? (
              <Card variant="inset">
                <CardContent className="flex flex-col gap-2 py-3">
                  <p className="text-sm font-medium">Variables disponibles</p>
                  <ul className="flex flex-col gap-1">
                    {template.variables.map((variable) => (
                      <li
                        className="text-sm text-muted-foreground"
                        key={variable.token}
                      >
                        <code className="font-mono text-xs">
                          {variable.token}
                        </code>{" "}
                        · {variable.description}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="template-subject">
                  Asunto{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="template-subject"
                  maxLength={250}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  value={values.subject}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="template-title">
                  Título{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="template-title"
                  maxLength={250}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  value={values.title}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="template-body">
                  Mensaje{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="template-body"
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  rows={4}
                  value={values.body}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="template-action">
                  Texto del botón
                </FieldLabel>
                <Input
                  id="template-action"
                  maxLength={120}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      actionLabel: event.target.value,
                    }))
                  }
                  value={values.actionLabel}
                />
                <FieldDescription>
                  El destino del botón lo calcula el sistema.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="template-notice">Aviso final</FieldLabel>
                <Textarea
                  id="template-notice"
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      notice: event.target.value,
                    }))
                  }
                  rows={3}
                  value={values.notice}
                />
              </Field>
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
                <Save data-icon="inline-start" />
              )}
              Guardar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<AdminEmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [editing, setEditing] = useState<AdminEmailTemplate | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [resetting, setResetting] = useState<AdminEmailTemplate | null>(null)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await adminEmailTemplatesApi.list()
      setTemplates(response.templates)
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("Email templates request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (forbidden) {
    return (
      <EmptyState
        description="Tu cuenta no tiene permisos para editar las plantillas de correo."
        icon={ShieldX}
        title="Acceso restringido"
      />
    )
  }

  if (isLoading && !templates.length && !loadError) {
    return <PageLoading aria-label="Cargando plantillas de correo" />
  }

  if (loadError) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description="No fue posible cargar las plantillas de correo."
        icon={CircleAlert}
        title="No pudimos cargar esta sección"
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Asunto y textos de los correos transaccionales que envía Zapi."
          title="Plantillas de correo"
        />
        <Card variant="subtle">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Correo</TableHead>
                  <TableHead className="hidden lg:table-cell">Asunto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.key}>
                    <TableCell>
                      <div className="flex min-w-48 flex-col">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {template.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {template.subject}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={template.customized ? "info" : "secondary"}
                      >
                        {template.customized
                          ? "Personalizada"
                          : "Texto por defecto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => {
                            setEditing(template)
                            setSheetOpen(true)
                          }}
                          size="sm"
                          variant="brand-secondary"
                        >
                          <Pencil data-icon="inline-start" /> Editar
                        </Button>
                        {template.customized ? (
                          <Button
                            aria-label={`Restablecer ${template.name}`}
                            onClick={() => setResetting(template)}
                            size="icon-sm"
                            variant="brand-secondary"
                          >
                            <RotateCcw />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">
          <Mail aria-hidden="true" className="mr-1.5 inline size-4" />
          El envío usa la configuración SMTP de Integraciones.
        </p>
      </div>
      <TemplateSheet
        onOpenChange={setSheetOpen}
        onSubmit={async (values) => {
          if (!editing) return false
          setPending(true)
          try {
            const response = await adminEmailTemplatesApi.update(editing.key, {
              subject: values.subject.trim(),
              title: values.title.trim(),
              body: values.body.trim(),
              actionLabel: values.actionLabel.trim() || undefined,
              notice: values.notice.trim() || undefined,
            })
            setTemplates(response.templates)
            toast.success("Plantilla actualizada.")
            return true
          } catch (error) {
            console.error("Email template save failed", error)
            toast.error("No pudimos guardar la plantilla.")
            return false
          } finally {
            setPending(false)
          }
        }}
        open={sheetOpen}
        pending={pending}
        template={editing}
      />
      <AlertDialog
        onOpenChange={(open) => (open ? null : setResetting(null))}
        open={Boolean(resetting)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer plantilla</AlertDialogTitle>
            <AlertDialogDescription>
              «{resetting?.name}» vuelve al texto por defecto del sistema y se
              pierde la personalización guardada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                const target = resetting
                if (!target) return
                setPending(true)
                void adminEmailTemplatesApi
                  .reset(target.key)
                  .then((response) => {
                    setTemplates(response.templates)
                    setResetting(null)
                    toast.success("Plantilla restablecida.")
                  })
                  .catch((error: unknown) => {
                    console.error("Email template reset failed", error)
                    toast.error("No pudimos restablecer la plantilla.")
                  })
                  .finally(() => setPending(false))
              }}
            >
              <RotateCcw data-icon="inline-start" /> Restablecer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
