"use client"

import { useState, type FormEvent } from "react"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import type { SupportCatalogItem } from "./support-catalog-panel"

/**
 * Formulario mock del hijo Laravel `AdminSupport → New Ticket`. La creación
 * real del caso llega con la vertical de soporte; aquí solo se valida y se
 * entrega el resultado al estado local de la página.
 */

export type AdminSupportUserFixture = {
  id: string
  name: string
  email: string
  workspaceName: string
}

export type NewCaseValues = {
  userId: string
  categoryId: string
  typeId: string
  labelIds: string[]
  subject: string
  message: string
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

export function AdminSupportNewCaseSheet({
  categories,
  labels,
  onCreate,
  onOpenChange,
  open,
  types,
  users,
}: {
  categories: readonly SupportCatalogItem[]
  labels: readonly SupportCatalogItem[]
  onCreate: (values: NewCaseValues) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  types: readonly SupportCatalogItem[]
  users: readonly AdminSupportUserFixture[]
}) {
  const [userId, setUserId] = useState("")
  const [categoryId, setCategoryId] = useState("none")
  const [typeId, setTypeId] = useState("none")
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const complete = Boolean(userId && subject.trim() && message.trim())
  const activeLabels = labels.filter((label) => label.isActive)

  function close() {
    setUserId("")
    setCategoryId("none")
    setTypeId("none")
    setLabelIds([])
    setSubject("")
    setMessage("")
    onOpenChange(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!complete) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }
    onCreate({
      userId,
      categoryId,
      typeId,
      labelIds,
      subject: subject.trim(),
      message: message.trim(),
    })
    toast.success("Caso creado.")
    close()
  }

  return (
    <Sheet onOpenChange={(next) => (next ? onOpenChange(true) : close())} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Nuevo caso</SheetTitle>
          <SheetDescription>
            Abre un caso en nombre de un cliente y clasifícalo para el equipo.
          </SheetDescription>
        </SheetHeader>
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-case-user">
                  Usuario destino <RequiredMark />
                </FieldLabel>
                <Select onValueChange={setUserId} value={userId}>
                  <SelectTrigger
                    aria-required="true"
                    className="w-full"
                    id="admin-case-user"
                  >
                    <SelectValue placeholder="Selecciona una persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} · {user.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  El caso queda visible para esa persona en su Portal.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-case-category">Categoría</FieldLabel>
                <Select onValueChange={setCategoryId} value={categoryId}>
                  <SelectTrigger className="w-full" id="admin-case-category">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">Sin categoría</SelectItem>
                      {categories
                        .filter((category) => category.isActive)
                        .map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-case-type">Tipo</FieldLabel>
                <Select onValueChange={setTypeId} value={typeId}>
                  <SelectTrigger className="w-full" id="admin-case-type">
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">Sin tipo</SelectItem>
                      {types
                        .filter((type) => type.isActive)
                        .map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <FieldSet>
                <FieldLabel asChild>
                  <legend>Etiquetas</legend>
                </FieldLabel>
                {activeLabels.length ? (
                  <FieldGroup className="gap-3" data-slot="checkbox-group">
                    {activeLabels.map((label) => (
                      <Field key={label.id} orientation="horizontal">
                        <Checkbox
                          checked={labelIds.includes(label.id)}
                          id={`admin-case-label-${label.id}`}
                          onCheckedChange={(checked) =>
                            setLabelIds((current) =>
                              checked === true
                                ? [...current, label.id]
                                : current.filter((id) => id !== label.id)
                            )
                          }
                        />
                        <FieldLabel htmlFor={`admin-case-label-${label.id}`}>
                          <FieldContent>
                            <FieldTitle>{label.name}</FieldTitle>
                          </FieldContent>
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                ) : (
                  <FieldDescription>
                    No hay etiquetas activas todavía.
                  </FieldDescription>
                )}
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="admin-case-subject">
                  Asunto <RequiredMark />
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="admin-case-subject"
                  onChange={(event) => setSubject(event.target.value)}
                  value={subject}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-case-message">
                  Mensaje <RequiredMark />
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="admin-case-message"
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  value={message}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button onClick={close} type="button" variant="brand-secondary">
              Cancelar
            </Button>
            <Button disabled={!complete} type="submit">
              <Plus data-icon="inline-start" /> Crear caso
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
