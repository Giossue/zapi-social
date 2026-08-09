"use client"

import { useState, type FormEvent } from "react"
import type {
  PortalTeamInvitation,
  PortalTeamMember,
  PortalTeamRole,
  PortalTeamsResponse,
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
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { CircleAlert, LoaderCircle, MailPlus, Save } from "lucide-react"

import { formatTeamDate, roleMeta } from "./team-utils"

type InvitationRole = Exclude<PortalTeamRole, "owner">

export function InviteDialog({
  canInviteAdmin,
  error,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  canInviteAdmin: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { email: string; role: InvitationRole }) => void
  open: boolean
  pending: boolean
}) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InvitationRole>("member")
  const [submitted, setSubmitted] = useState(false)
  const normalizedEmail = email.trim().toLowerCase()
  const validEmail = /^\S+@\S+\.\S+$/.test(normalizedEmail)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (!validEmail || pending) return
    onSubmit({ email: normalizedEmail, role })
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Invitar al workspace</SheetTitle>
          <SheetDescription>
            La invitación es privada, se vincula a este correo y caduca en siete
            días.
          </SheetDescription>
        </SheetHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            {error ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field data-invalid={submitted && !validEmail}>
                <FieldLabel htmlFor="team-invite-email">Correo</FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <MailPlus aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-invalid={submitted && !validEmail}
                    autoComplete="email"
                    disabled={pending}
                    id="team-invite-email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@empresa.com"
                    type="email"
                    value={email}
                  />
                </InputGroup>
                {submitted && !validEmail ? (
                  <FieldError>Introduce un correo válido.</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="team-invite-role">Rol</FieldLabel>
                <Select
                  disabled={pending}
                  onValueChange={(value) => setRole(value as InvitationRole)}
                  value={role}
                >
                  <SelectTrigger id="team-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="member">Miembro</SelectItem>
                      {canInviteAdmin ? (
                        <SelectItem value="admin">Administración</SelectItem>
                      ) : null}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {role === "admin"
                    ? "Accede a todas las cuentas y puede administrar miembros, excepto otros administradores."
                    : "Solo trabaja con las cuentas que le asignes."}
                </FieldDescription>
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
            <Button disabled={pending} type="submit">
              {pending ? (
                <LoaderCircle data-icon="inline-start" />
              ) : (
                <MailPlus data-icon="inline-start" />
              )}
              {pending ? "Enviando..." : "Enviar invitación"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function MemberAccessDialog({
  accounts,
  actorRole,
  error,
  member,
  onOpenChange,
  onSubmit,
  pending,
}: {
  accounts: PortalTeamsResponse["accounts"]
  actorRole: PortalTeamRole
  error: string | null
  member: PortalTeamMember | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { accountIds: string[]; role: InvitationRole }) => void
  pending: boolean
}) {
  const [accountIds, setAccountIds] = useState<string[]>(
    () => member?.accountIds ?? []
  )
  const [role, setRole] = useState<InvitationRole>(() =>
    member?.role === "admin" ? "admin" : "member"
  )
  if (!member) return null

  function toggleAccount(accountId: string, checked: boolean) {
    setAccountIds((current) =>
      checked
        ? [...new Set([...current, accountId])]
        : current.filter((id) => id !== accountId)
    )
  }

  return (
    <Sheet onOpenChange={onOpenChange} open>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Acceso de {member.name}</SheetTitle>
          <SheetDescription>
            El rol y las cuentas se validan nuevamente en API y Worker en cada
            operación.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit({ accountIds, role })
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            {error ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="team-member-role">Rol</FieldLabel>
                {actorRole === "owner" ? (
                  <Select
                    disabled={pending}
                    onValueChange={(value) => setRole(value as InvitationRole)}
                    value={role}
                  >
                    <SelectTrigger id="team-member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="member">Miembro</SelectItem>
                        <SelectItem value="admin">Administración</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={roleMeta[role].variant}>
                    {roleMeta[role].label}
                  </Badge>
                )}
              </Field>
              <FieldSet data-disabled={role === "admin" || pending}>
                <FieldLegend variant="label">Cuentas asignadas</FieldLegend>
                {role === "admin" ? (
                  <FieldDescription>
                    Administración accede a todas las cuentas activas del
                    workspace.
                  </FieldDescription>
                ) : accounts.length ? (
                  <FieldGroup data-slot="checkbox-group" className="gap-3">
                    {accounts.map((account) => {
                      const controlId = `team-account-${account.id}`
                      return (
                        <Field key={account.id} orientation="horizontal">
                          <Checkbox
                            checked={accountIds.includes(account.id)}
                            disabled={pending}
                            id={controlId}
                            onCheckedChange={(value) =>
                              toggleAccount(account.id, value === true)
                            }
                          />
                          <FieldLabel htmlFor={controlId}>
                            <FieldContent>
                              <FieldTitle>{account.name}</FieldTitle>
                              <FieldDescription>
                                {account.detail}
                              </FieldDescription>
                            </FieldContent>
                          </FieldLabel>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                ) : (
                  <FieldDescription>
                    No hay cuentas activas para asignar.
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
            <Button disabled={pending} type="submit">
              {pending ? (
                <LoaderCircle data-icon="inline-start" />
              ) : (
                <Save aria-hidden="true" data-icon="inline-start" />
              )}
              {pending ? "Guardando..." : "Guardar acceso"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function InvitationDetailDialog({
  invitation,
  onOpenChange,
}: {
  invitation: PortalTeamInvitation | null
  onOpenChange: (open: boolean) => void
}) {
  if (!invitation) return null
  const deliveryLabel = {
    pending: "Enviando",
    sent: "Enviada",
    failed: "Falló el envío",
  }[invitation.deliveryStatus]

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle de invitación</DialogTitle>
          <DialogDescription>
            Solo {invitation.email} puede aceptarla antes de su vencimiento.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 text-sm">
          {[
            ["Correo", invitation.email],
            ["Rol", roleMeta[invitation.role].label],
            ["Invitado por", invitation.invitedByName],
            ["Creada", formatTeamDate(invitation.createdAt)],
            ["Último envío", formatTeamDate(invitation.lastSentAt)],
            ["Vence", formatTeamDate(invitation.expiresAt)],
            ["Entrega", deliveryLabel],
          ].map(([label, value]) => (
            <div className="flex items-start justify-between gap-4" key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TeamConfirmationDialog({
  confirmLabel,
  description,
  destructive = true,
  error,
  onConfirm,
  onOpenChange,
  open,
  pending,
  title,
}: {
  confirmLabel: string
  description: string
  destructive?: boolean
  error?: string | null
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
  title: string
}) {
  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen)
      }}
      open={open}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} variant="brand-secondary">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            variant={destructive ? "destructive" : "default"}
          >
            {pending ? <LoaderCircle data-icon="inline-start" /> : null}
            {pending ? "Procesando..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
