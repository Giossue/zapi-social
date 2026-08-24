"use client"

import { useEffect, useState, type FormEvent } from "react"
import type {
  PortalTeamInvitation,
  PortalTeamMember,
  PortalTeamRole,
  PortalTeamsResponse,
  WorkspacePermission,
} from "@workspace/contracts"
import { workspacePermissionCatalog } from "@workspace/contracts"
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
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
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
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"
import { MailPlus, Save } from "lucide-react"

import { roleVariants } from "./team-utils"

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
  const t = useTranslations("teams")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InvitationRole>("member")
  const normalizedEmail = email.trim().toLowerCase()
  const validEmail = /^\S+@\S+\.\S+$/.test(normalizedEmail)

  useEffect(() => {
    if (open && error) toast.error(error)
  }, [error, open])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validEmail) {
      toast.error(t("invalidEmail"))
      return
    }
    if (pending) return
    onSubmit({ email: normalizedEmail, role })
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("inviteTitle")}</SheetTitle>
          <SheetDescription>{t("inviteDescription")}</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={submit}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="team-invite-email">
                  {t("email")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <MailPlus aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-required="true"
                    autoComplete="email"
                    disabled={pending}
                    id="team-invite-email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("emailPlaceholder")}
                    type="email"
                    value={email}
                  />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="team-invite-role">
                  {t("roleColumn")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Select
                  disabled={pending}
                  onValueChange={(value) => setRole(value as InvitationRole)}
                  value={role}
                >
                  <SelectTrigger aria-required="true" id="team-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="member">{t("role.member")}</SelectItem>
                      {canInviteAdmin ? (
                        <SelectItem value="admin">{t("role.admin")}</SelectItem>
                      ) : null}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {role === "admin" ? t("adminHint") : t("memberHint")}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>
          <SheetActions>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={pending || !normalizedEmail} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" size={16} />
              ) : (
                <MailPlus data-icon="inline-start" />
              )}
              {pending ? t("sending") : t("sendInvitation")}
            </Button>
          </SheetActions>
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
  onSubmit: (input: {
    accountIds: string[]
    permissions: WorkspacePermission[]
    role: InvitationRole
  }) => void
  pending: boolean
}) {
  const t = useTranslations("teams")
  const [accountIds, setAccountIds] = useState<string[]>(
    () => member?.accountIds ?? []
  )
  const [role, setRole] = useState<InvitationRole>(() =>
    member?.role === "admin" ? "admin" : "member"
  )
  const [permissions, setPermissions] = useState<WorkspacePermission[]>(() =>
    member?.role === "member" ? [...member.permissions] : []
  )

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  if (!member) return null

  function toggleAccount(accountId: string, checked: boolean) {
    setAccountIds((current) =>
      checked
        ? [...new Set([...current, accountId])]
        : current.filter((id) => id !== accountId)
    )
  }

  function togglePermission(permission: WorkspacePermission, checked: boolean) {
    setPermissions((current) =>
      checked
        ? [...new Set([...current, permission])]
        : current.filter((value) => value !== permission)
    )
  }

  return (
    <Sheet onOpenChange={onOpenChange} open>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>
            {t("memberAccessTitle", { name: member.name })}
          </SheetTitle>
          <SheetDescription>{t("memberAccessDescription")}</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit({ accountIds, permissions, role })
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="team-member-role">
                  {t("roleColumn")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                {actorRole === "owner" ? (
                  <Select
                    disabled={pending}
                    onValueChange={(value) => setRole(value as InvitationRole)}
                    value={role}
                  >
                    <SelectTrigger aria-required="true" id="team-member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="member">
                          {t("role.member")}
                        </SelectItem>
                        <SelectItem value="admin">{t("role.admin")}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={roleVariants[role]}>
                    {t(`role.${role}`)}
                  </Badge>
                )}
              </Field>
              <FieldSet data-disabled={role === "admin" || pending}>
                <FieldLegend variant="label">
                  {t("assignedAccounts")}
                </FieldLegend>
                {role === "admin" ? (
                  <FieldDescription>{t("adminAllAccounts")}</FieldDescription>
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
                  <FieldDescription>{t("noActiveAccounts")}</FieldDescription>
                )}
              </FieldSet>
              <FieldSet data-disabled={role === "admin" || pending}>
                <FieldLegend variant="label">{t("permissions")}</FieldLegend>
                {role === "admin" ? (
                  <FieldDescription>
                    {t("adminAllPermissions")}
                  </FieldDescription>
                ) : (
                  workspacePermissionCatalog.map((group) => (
                    <FieldGroup
                      key={group.module}
                      className="gap-3"
                      data-slot="checkbox-group"
                    >
                      <FieldDescription>
                        {t(`permissionModule.${group.module}`)}
                      </FieldDescription>
                      {group.permissions.map((permission) => {
                        const controlId = `team-permission-${permission}`
                        return (
                          <Field key={permission} orientation="horizontal">
                            <Checkbox
                              checked={permissions.includes(permission)}
                              disabled={pending}
                              id={controlId}
                              onCheckedChange={(value) =>
                                togglePermission(permission, value === true)
                              }
                            />
                            <FieldLabel htmlFor={controlId}>
                              <FieldContent>
                                <FieldTitle>
                                  {t(`permission.${permission}`)}
                                </FieldTitle>
                              </FieldContent>
                            </FieldLabel>
                          </Field>
                        )
                      })}
                    </FieldGroup>
                  ))
                )}
              </FieldSet>
            </FieldGroup>
          </div>
          <SheetActions>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" size={16} />
              ) : (
                <Save aria-hidden="true" data-icon="inline-start" />
              )}
              {pending ? t("saving") : t("saveAccess")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function InvitationDetailSheet({
  invitation,
  onOpenChange,
}: {
  invitation: PortalTeamInvitation | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("teams")
  const format = useFormatter()
  const teamDate = (value: string | null) =>
    value
      ? format.dateTime(new Date(value), {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : t("notSentYet")
  if (!invitation) return null
  const deliveryLabel = t(`delivery.${invitation.deliveryStatus}`)

  return (
    <Sheet onOpenChange={onOpenChange} open>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("invitationDetail")}</SheetTitle>
          <SheetDescription>
            {t("invitationOnlyEmail", { email: invitation.email })}
          </SheetDescription>
        </SheetHeader>
        <dl className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 text-sm">
          {[
            [t("email"), invitation.email],
            [t("roleColumn"), t(`role.${invitation.role}`)],
            [t("invitedBy"), invitation.invitedByName],
            [t("created"), teamDate(invitation.createdAt)],
            [t("lastSent"), teamDate(invitation.lastSentAt)],
            [t("expires"), teamDate(invitation.expiresAt)],
            [t("delivery.label"), deliveryLabel],
          ].map(([label, value]) => (
            <div className="flex items-start justify-between gap-4" key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <SheetActions>
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            {t("close")}
          </Button>
        </SheetActions>
      </SheetContent>
    </Sheet>
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
  const t = useTranslations("teams")
  useEffect(() => {
    if (open && error) toast.error(error)
  }, [error, open])

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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} variant="brand-secondary">
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            variant={destructive ? "destructive" : "default"}
          >
            {pending ? <Spinner data-icon="inline-start" size={16} /> : null}
            {pending ? t("processing") : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
