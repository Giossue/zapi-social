"use client"

import { useMemo, useState } from "react"
import {
  MailPlus,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type {
  TeamMember,
  TeamRole,
  TeamsData,
} from "@/features/teams/types/teams"

const roleMeta: Record<
  TeamRole,
  { label: string; variant: "neutral" | "success" | "warning" }
> = {
  owner: { label: "Propietaria", variant: "success" },
  admin: { label: "Administración", variant: "warning" },
  member: { label: "Miembro", variant: "neutral" },
}

function canManageTarget(actor: TeamRole, target: TeamRole) {
  if (actor === "owner") return target !== "owner"
  return actor === "admin" && target === "member"
}

function InviteDialog({
  actorRole,
  onClose,
  onInvite,
  open,
}: {
  actorRole: TeamRole
  onClose: () => void
  onInvite: (input: { email: string; role: Exclude<TeamRole, "owner"> }) => void
  open: boolean
}) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Exclude<TeamRole, "owner">>("member")
  const canInviteAdmin = actorRole === "owner"
  const normalizedEmail = email.trim().toLowerCase()
  const validEmail = /^\S+@\S+\.\S+$/.test(normalizedEmail)

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar al espacio de trabajo</DialogTitle>
          <DialogDescription>
            La invitación es privada, se vincula a este correo y caduca en siete
            días.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="team-invite-email">
              Correo
            </label>
            <Input
              id="team-invite-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@empresa.com"
              type="email"
              value={email}
            />
            {email && !validEmail ? (
              <p className="text-sm text-destructive">
                Introduce un correo válido.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="team-invite-role">
              Rol
            </label>
            <Select
              onValueChange={(value) =>
                setRole(value as Exclude<TeamRole, "owner">)
              }
              value={role}
            >
              <SelectTrigger
                aria-label="Rol de la invitación"
                id="team-invite-role"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Miembro</SelectItem>
                {canInviteAdmin ? (
                  <SelectItem value="admin">Administración</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {role === "admin"
                ? "Puede publicar y administrar miembros, pero no otros administradores."
                : "Solo podrá trabajar con las cuentas que asignes."}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="brand-secondary">
            Cancelar
          </Button>
          <Button
            disabled={!validEmail}
            onClick={() => onInvite({ email: normalizedEmail, role })}
          >
            <MailPlus data-icon="inline-start" />
            Enviar invitación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MemberAccessDialog({
  accounts,
  actorRole,
  member,
  onClose,
  onSave,
}: {
  accounts: TeamsData["accounts"]
  actorRole: TeamRole
  member: TeamMember | null
  onClose: () => void
  onSave: (input: {
    memberId: string
    accountIds: string[]
    role: TeamRole
  }) => void
}) {
  const [accountIds, setAccountIds] = useState<string[]>(
    () => member?.accountIds ?? []
  )
  const [role, setRole] = useState<TeamRole>(() => member?.role ?? "member")
  const canChangeRole = actorRole === "owner" && member?.role !== "owner"

  if (!member) return null

  function toggleAccount(accountId: string, checked: boolean) {
    setAccountIds((current) =>
      checked
        ? [...current, accountId]
        : current.filter((id) => id !== accountId)
    )
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      open={Boolean(member)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acceso de {member.name}</DialogTitle>
          <DialogDescription>
            Los grants se verifican también al crear y entregar publicaciones;
            la pantalla no es la barrera de seguridad.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Rol</p>
            {canChangeRole ? (
              <Select
                onValueChange={(value) => setRole(value as TeamRole)}
                value={role}
              >
                <SelectTrigger aria-label="Rol del miembro">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administración</SelectItem>
                  <SelectItem value="member">Miembro</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={roleMeta[role].variant}>
                {roleMeta[role].label}
              </Badge>
            )}
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Cuentas asignadas</legend>
            {role === "admin" || role === "owner" ? (
              <p className="text-sm text-muted-foreground">
                Este rol puede acceder a todas las cuentas activas del espacio.
              </p>
            ) : (
              accounts.map((account) => (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
                  key={account.id}
                >
                  <Checkbox
                    checked={accountIds.includes(account.id)}
                    onCheckedChange={(value) =>
                      toggleAccount(account.id, value === true)
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {account.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {account.detail}
                    </span>
                  </span>
                </label>
              ))
            )}
          </fieldset>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="brand-secondary">
            Cancelar
          </Button>
          <Button
            onClick={() => onSave({ memberId: member.id, accountIds, role })}
          >
            Guardar acceso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsPage({ teams }: { teams: TeamsData }) {
  const [members, setMembers] = useState(teams.members)
  const [invitations, setInvitations] = useState(teams.invitations)
  const [query, setQuery] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const currentUser = members.find(
    (member) => member.id === teams.currentUserId
  )
  const actorRole = currentUser?.role ?? "member"
  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es")
    return members.filter(
      (member) =>
        !normalized ||
        `${member.name} ${member.email} ${roleMeta[member.role].label}`
          .toLocaleLowerCase("es")
          .includes(normalized)
    )
  }, [members, query])

  if (!teams.canManage) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="No tienes permiso para administrar miembros de este espacio de trabajo."
            icon={ShieldCheck}
            title="Acceso restringido"
          />
        </CardContent>
      </Card>
    )
  }

  function inviteMember(input: {
    email: string
    role: Exclude<TeamRole, "owner">
  }) {
    setInvitations((current) => [
      {
        id: `invite-${Date.now()}`,
        email: input.email,
        role: input.role,
        expiresAt: "5 ago 2026",
      },
      ...current,
    ])
    setInviteOpen(false)
    setNotice(
      `La invitación privada para ${input.email} está preparada en este mock.`
    )
  }

  function saveMemberAccess(input: {
    memberId: string
    accountIds: string[]
    role: TeamRole
  }) {
    setMembers((current) =>
      current.map((member) =>
        member.id === input.memberId
          ? {
              ...member,
              role: input.role,
              accountIds:
                input.role === "member"
                  ? input.accountIds
                  : teams.accounts.map((account) => account.id),
            }
          : member
      )
    )
    setSelectedMember(null)
    setNotice("El acceso del miembro se actualizó en este mock.")
  }

  function removeMember(member: TeamMember) {
    setMembers((current) => current.filter((item) => item.id !== member.id))
    setNotice(`${member.name} fue eliminado del espacio en este mock.`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-5" />
          {members.length} miembros activos · {invitations.length} invitación
          {invitations.length === 1 ? "" : "es"} pendiente
          {invitations.length === 1 ? "" : "s"}
        </div>
        <Button onClick={() => setInviteOpen(true)} size="lg">
          <MailPlus data-icon="inline-start" />
          Invitar miembro
        </Button>
      </div>
      {notice ? (
        <Card variant="inset">
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{notice}</p>
            <Button
              onClick={() => setNotice(null)}
              size="sm"
              variant="brand-secondary"
            >
              Cerrar
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Miembros" className="space-y-4">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Buscar miembros"
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o correo"
              value={query}
            />
          </div>
          {visibleMembers.length ? (
            <div className="space-y-3">
              {visibleMembers.map((member) => {
                const editable = canManageTarget(actorRole, member.role)
                return (
                  <Card key={member.id} variant="subtle">
                    <CardContent className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {member.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{member.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={roleMeta[member.role].variant}>
                          {roleMeta[member.role].label}
                        </Badge>
                        {editable ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={`Acciones para ${member.name}`}
                                size="icon"
                                variant="brand-secondary"
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => setSelectedMember(member)}
                              >
                                <UserCog />
                                Gestionar acceso
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => removeMember(member)}
                              >
                                <Trash2 />
                                Eliminar miembro
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card variant="subtle">
              <CardContent>
                <EmptyState
                  description="Prueba otra búsqueda para encontrar a un miembro del espacio."
                  icon={Search}
                  title="No encontramos miembros"
                />
              </CardContent>
            </Card>
          )}
        </section>
        <aside aria-label="Invitaciones pendientes">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Invitaciones pendientes</CardTitle>
              <CardDescription>
                Solo el correo invitado podrá aceptarlas antes de su
                vencimiento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {invitations.length ? (
                invitations.map((invite) => (
                  <div className="space-y-2" key={invite.id}>
                    <p className="truncate text-sm font-medium">
                      {invite.email}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={roleMeta[invite.role].variant}>
                        {roleMeta[invite.role].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Hasta {invite.expiresAt}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  description="Las nuevas invitaciones aparecerán aquí."
                  icon={MailPlus}
                  title="Sin invitaciones"
                />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
      {inviteOpen ? (
        <InviteDialog
          actorRole={actorRole}
          onClose={() => setInviteOpen(false)}
          onInvite={inviteMember}
          open={inviteOpen}
        />
      ) : null}
      {selectedMember ? (
        <MemberAccessDialog
          accounts={teams.accounts}
          actorRole={actorRole}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={saveMemberAccess}
        />
      ) : null}
    </div>
  )
}
