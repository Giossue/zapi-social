"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  CircleAlert,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  ShieldX,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"

import { ApiError, adminRolesApi } from "@workspace/api-client"
import {
  adminPermissionModuleSchema,
  type AdminRole,
  type AdminRoleMember,
  type AdminRolesResponse,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { DataTableHeader } from "@workspace/ui/components/data-table-controls"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
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
import { PageLoading } from "@/components/page-loading"
import { useApiErrorMessage } from "@/lib/api-error-message"
import { loginPath } from "@/features/identity/login-redirect"

const permissionModules = adminPermissionModuleSchema.options

type RoleDraft = {
  name: string
  description: string
  permissions: Set<string>
}

function emptyDraft(): RoleDraft {
  return { name: "", description: "", permissions: new Set() }
}

function draftFor(role: AdminRole): RoleDraft {
  return {
    name: role.name,
    description: role.description,
    permissions: new Set(role.permissions),
  }
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

export function AdminRolesPage() {
  const t = useTranslations("adminRoles")
  const tModules = useTranslations("adminRoles.modules")
  const router = useRouter()
  const apiErrorMessage = useApiErrorMessage()

  const [data, setData] = useState<AdminRolesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [query, setQuery] = useState("")

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<AdminRole | null>(null)
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft)
  const [deleting, setDeleting] = useState<AdminRole | null>(null)

  const [membersRole, setMembersRole] = useState<AdminRole | null>(null)
  const [members, setMembers] = useState<AdminRoleMember[]>([])
  const [candidates, setCandidates] = useState<AdminRoleMember[]>([])
  const [candidateQuery, setCandidateQuery] = useState("")

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      setData(await adminRolesApi.list())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      setLoadFailed(true)
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setIsLoading(false)
    }
  }, [apiErrorMessage, router])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!membersRole) return
    const timer = setTimeout(() => {
      void adminRolesApi
        .candidates(candidateQuery.trim())
        .then((response) => setCandidates(response.candidates))
        .catch(() => setCandidates([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [candidateQuery, membersRole])

  function openCreate() {
    setEditing(null)
    setDraft(emptyDraft())
    setSheetOpen(true)
  }

  function openEdit(role: AdminRole) {
    setEditing(role)
    setDraft(draftFor(role))
    setSheetOpen(true)
  }

  async function openMembers(role: AdminRole) {
    setMembersRole(role)
    setCandidateQuery("")
    try {
      setMembers((await adminRolesApi.members(role.id)).members)
    } catch (error) {
      setMembersRole(null)
      toast.error(apiErrorMessage(errorCode(error)))
    }
  }

  function togglePermission(key: string, checked: boolean) {
    setDraft((current) => {
      const permissions = new Set(current.permissions)
      if (checked) permissions.add(key)
      else permissions.delete(key)
      return { ...current, permissions }
    })
  }

  async function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim()) {
      toast.error(t("nameRequired"))
      return
    }
    setPending(true)
    try {
      const input = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        permissions: [...draft.permissions].sort(),
      }
      const response = editing
        ? await adminRolesApi.update(editing.id, input)
        : await adminRolesApi.create(input)
      setData(response)
      setSheetOpen(false)
      toast.success(t("saved"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setPending(true)
    try {
      setData(await adminRolesApi.remove(deleting.id))
      setDeleting(null)
      toast.success(t("deleted"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function assignMember(userId: string) {
    if (!membersRole) return
    setPending(true)
    try {
      setMembers(
        (await adminRolesApi.assign(membersRole.id, { userId })).members
      )
      setCandidateQuery("")
      await load()
      toast.success(t("memberAssigned"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function unassignMember(userId: string) {
    if (!membersRole) return
    setPending(true)
    try {
      setMembers((await adminRolesApi.unassign(membersRole.id, userId)).members)
      await load()
      toast.success(t("memberUnassigned"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        description={t("forbiddenDescription")}
        icon={ShieldX}
        title={t("forbiddenTitle")}
      />
    )
  }

  if (isLoading && !data) return <PageLoading aria-label={t("loading")} />

  if (loadFailed && !data) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    )
  }

  const needle = query.trim().toLowerCase()
  const roles = (data?.roles ?? []).filter(
    (role) =>
      !needle ||
      role.name.toLowerCase().includes(needle) ||
      role.description.toLowerCase().includes(needle)
  )

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button onClick={openCreate} size="sm" type="button">
                <Plus data-icon="inline-start" />
                {t("createRole")}
              </Button>
            }
            search={{
              ariaLabel: t("searchLabel"),
              onChange: setQuery,
              placeholder: t("searchPlaceholder"),
              value: query,
            }}
          />
          <CardContent className="px-0">
            {roles.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("roleColumn")}</TableHead>
                    <TableHead className="max-md:hidden">
                      {t("permissionsColumn")}
                    </TableHead>
                    <TableHead>{t("membersColumn")}</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">{t("actionsColumn")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <span className="font-medium">{role.name}</span>
                          {role.description ? (
                            <span className="line-clamp-1 text-sm text-muted-foreground">
                              {role.description}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-md:hidden">
                        {role.permissions.includes("*") ? (
                          <Badge variant="info">{t("allPermissions")}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {t("permissionCount", {
                              count: role.permissions.length,
                            })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">
                          {t("memberCount", { count: role.memberCount })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={t("rowActions", { name: role.name })}
                              disabled={pending}
                              size="icon-sm"
                              variant="brand-secondary"
                            >
                              <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => openEdit(role)}>
                              <Pencil />
                              {t("editRole")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void openMembers(role)}
                            >
                              <UserPlus />
                              {t("manageMembers")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleting(role)}
                              variant="destructive"
                            >
                              <Trash2 />
                              {t("deleteRole")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6">
                <EmptyState
                  description={t("emptyDescription")}
                  icon={CircleAlert}
                  title={t("emptyTitle")}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet onOpenChange={setSheetOpen} open={sheetOpen}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
          <SheetHeader className="border-b">
            <SheetTitle>{editing ? t("editRole") : t("createRole")}</SheetTitle>
            <SheetDescription>{t("sheetDescription")}</SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => void submitRole(event)}
          >
            <div className="flex flex-col gap-5 overflow-y-auto p-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="role-name">{t("name")}</FieldLabel>
                  <Input
                    id="role-name"
                    maxLength={120}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    value={draft.name}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="role-description">
                    {t("description")}
                  </FieldLabel>
                  <Textarea
                    id="role-description"
                    maxLength={500}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={2}
                    value={draft.description}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("permissions")}</FieldLabel>
                  <FieldDescription>{t("permissionsHint")}</FieldDescription>
                  <div className="grid gap-1.5 rounded-lg border p-3">
                    {permissionModules.map((module) => (
                      <div
                        className="flex items-center justify-between gap-3"
                        key={module}
                      >
                        <span className="text-sm">{tModules(module)}</span>
                        <span className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Checkbox
                              checked={
                                draft.permissions.has(`${module}.view`) ||
                                draft.permissions.has(`${module}.*`)
                              }
                              onCheckedChange={(checked) =>
                                togglePermission(
                                  `${module}.view`,
                                  checked === true
                                )
                              }
                            />
                            {t("view")}
                          </label>
                          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Checkbox
                              checked={
                                draft.permissions.has(`${module}.manage`) ||
                                draft.permissions.has(`${module}.*`)
                              }
                              onCheckedChange={(checked) =>
                                togglePermission(
                                  `${module}.manage`,
                                  checked === true
                                )
                              }
                            />
                            {t("manage")}
                          </label>
                        </span>
                      </div>
                    ))}
                  </div>
                </Field>
              </FieldGroup>
            </div>
            <SheetActions>
              <Button
                disabled={pending}
                onClick={() => setSheetOpen(false)}
                type="button"
                variant="brand-secondary"
              >
                {t("cancel")}
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {t("save")}
              </Button>
            </SheetActions>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setMembersRole(null)
        }}
        open={Boolean(membersRole)}
      >
        <DialogContent className="p-0 sm:max-w-md">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>
              {t("membersTitle", { name: membersRole?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("membersHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 p-4">
            {members.length ? (
              <ul className="grid gap-2">
                {members.map((member) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    key={member.id}
                  >
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {member.displayName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    </span>
                    <Button
                      aria-label={t("removeMember", {
                        name: member.displayName,
                      })}
                      disabled={pending}
                      onClick={() => void unassignMember(member.id)}
                      size="icon-sm"
                      variant="brand-secondary"
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
            )}
            <Command
              className="rounded-lg border bg-transparent"
              shouldFilter={false}
            >
              <CommandInput
                onValueChange={setCandidateQuery}
                placeholder={t("candidateSearchPlaceholder")}
                value={candidateQuery}
              />
              <CommandList className="max-h-48">
                <CommandEmpty>{t("noCandidates")}</CommandEmpty>
                <CommandGroup>
                  {candidates.map((candidate) => (
                    <CommandItem
                      key={candidate.id}
                      onSelect={() => void assignMember(candidate.id)}
                      value={candidate.id}
                    >
                      <span className="flex-1 truncate">
                        {candidate.displayName}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {candidate.email}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        open={Boolean(deleting)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { name: deleting?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              variant="destructive"
            >
              {t("deleteRole")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
