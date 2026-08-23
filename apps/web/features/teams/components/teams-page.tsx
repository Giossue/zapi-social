"use client"

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { ApiError, teamsApi } from "@workspace/api-client"
import type {
  PortalTeamActivityCategory,
  PortalTeamActivityEvent,
  PortalTeamActivityResponse,
  PortalTeamInvitation,
  PortalTeamMember,
  PortalTeamRole,
  PortalTeamsResponse,
  WorkspacePermission,
} from "@workspace/contracts"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { PageLoading } from "@/components/page-loading"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  TABLE_EMPTY_ICON,
  TableEmptyRow,
} from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@/components/table-pagination"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"

import { useApiErrorMessage } from "@/lib/api-error-message"
import {
  CircleAlert,
  DoorOpen,
  Eye,
  KeyRound,
  MailPlus,
  MoreVertical,
  RefreshCw,
  Send,
  Trash2,
  UserCog,
} from "lucide-react"

import {
  InvitationDetailSheet,
  InviteDialog,
  MemberAccessDialog,
  TeamConfirmationDialog,
} from "./team-dialogs"
import { TeamsLoading } from "./teams-loading"
import { initials, roleVariants } from "./team-utils"

type ManagerView = "members" | "invitations" | "activity"
const collectionPageSize = 10

type Confirmation =
  | { kind: "remove"; member: PortalTeamMember }
  | { kind: "revoke"; invitation: PortalTeamInvitation }
  | { kind: "transfer"; member: PortalTeamMember }
  | { kind: "leave" }

/** Orden del filtro de actividad; el rótulo sale de `activityCategory`. */
const activityCategories: readonly PortalTeamActivityCategory[] = [
  "all",
  "invitations",
  "members",
  "access",
  "ownership",
]

function MemberIdentity({
  current,
  member,
}: {
  current?: boolean
  member: PortalTeamMember
}) {
  const t = useTranslations("teams")

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback>{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{member.name}</p>
          {current ? <Badge variant="neutral">{t("you")}</Badge> : null}
        </div>
        {member.email ? (
          <p className="truncate text-xs text-muted-foreground">
            {member.email}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function accountScope(
  member: PortalTeamMember,
  t: ReturnType<typeof useTranslations<"teams">>
) {
  if (member.role !== "member") return t("allAccounts")
  return t("accountCount", { count: member.accountIds.length })
}

function filterMembers(members: PortalTeamMember[], query: string) {
  const normalized = query.trim().toLocaleLowerCase("es")
  return members.filter(
    (member) =>
      !normalized ||
      `${member.name} ${member.email ?? ""} ${member.role}`
        .toLocaleLowerCase("es")
        .includes(normalized)
  )
}

function filterInvitations(invitations: PortalTeamInvitation[], query: string) {
  const normalized = query.trim().toLocaleLowerCase("es")
  return invitations.filter(
    (invitation) =>
      !normalized ||
      `${invitation.email} ${invitation.role} ${invitation.invitedByName}`
        .toLocaleLowerCase("es")
        .includes(normalized)
  )
}

function MemberActions({
  actorRole,
  currentUserId,
  member,
  onManage,
  onRemove,
  onTransfer,
  pending,
}: {
  actorRole: PortalTeamRole
  currentUserId: string
  member: PortalTeamMember
  onManage: (member: PortalTeamMember) => void
  onRemove: (member: PortalTeamMember) => void
  onTransfer: (member: PortalTeamMember) => void
  pending: boolean
}) {
  const t = useTranslations("teams")
  const manageable =
    member.id !== currentUserId &&
    ((actorRole === "owner" && member.role !== "owner") ||
      (actorRole === "admin" && member.role === "member"))
  const transferable = actorRole === "owner" && member.role === "admin"
  if (!manageable && !transferable) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("memberActions", { name: member.name })}
          disabled={pending}
          size="icon-sm"
          variant="brand-secondary"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {manageable ? (
            <DropdownMenuItem onSelect={() => onManage(member)}>
              <UserCog />
              {t("manageAccess")}
            </DropdownMenuItem>
          ) : null}
          {transferable ? (
            <DropdownMenuItem onSelect={() => onTransfer(member)}>
              <KeyRound />
              {t("transferOwnership")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        {manageable ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => onRemove(member)}
                variant="destructive"
              >
                <Trash2 />
                {t("removeMember")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InvitationActions({
  invitation,
  onResend,
  onRevoke,
  onView,
  pending,
}: {
  invitation: PortalTeamInvitation
  onResend: (invitation: PortalTeamInvitation) => void
  onRevoke: (invitation: PortalTeamInvitation) => void
  onView: (invitation: PortalTeamInvitation) => void
  pending: boolean
}) {
  const t = useTranslations("teams")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("invitationActions", { email: invitation.email })}
          disabled={pending}
          size="icon-sm"
          variant="brand-secondary"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onView(invitation)}>
            <Eye />
            {t("viewDetails")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => onResend(invitation)}
          >
            <Send />
            {t("resendInvitation")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => onRevoke(invitation)}
            variant="destructive"
          >
            <Trash2 />
            {t("revokeInvitation")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DeliveryBadge({
  status,
}: {
  status: PortalTeamInvitation["deliveryStatus"]
}) {
  const t = useTranslations("teams")

  if (status === "sent")
    return <Badge variant="success">{t("delivery.sent")}</Badge>
  if (status === "failed")
    return <Badge variant="destructive">{t("delivery.failed")}</Badge>
  return <Badge variant="warning">{t("delivery.pending")}</Badge>
}

function confirmationCopy(
  confirmation: Confirmation | null,
  t: ReturnType<typeof useTranslations<"teams">>
) {
  if (!confirmation) return null
  if (confirmation.kind === "remove") {
    return {
      title: t("confirm.removeTitle"),
      description: t("confirm.removeDescription", {
        name: confirmation.member.name,
      }),
      confirmLabel: t("confirm.removeAction"),
      destructive: true,
    }
  }
  if (confirmation.kind === "revoke") {
    return {
      title: t("confirm.revokeTitle"),
      description: t("confirm.revokeDescription", {
        email: confirmation.invitation.email,
      }),
      confirmLabel: t("confirm.revokeAction"),
      destructive: true,
    }
  }
  if (confirmation.kind === "transfer") {
    return {
      title: t("confirm.transferTitle"),
      description: t("confirm.transferDescription", {
        name: confirmation.member.name,
      }),
      confirmLabel: t("confirm.transferAction"),
      destructive: false,
    }
  }
  return {
    title: t("confirm.leaveTitle"),
    description: t("confirm.leaveDescription"),
    confirmLabel: t("confirm.leaveAction"),
    destructive: true,
  }
}

function TeamsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("teams")
  return (
    <Card variant="subtle">
      <EmptyState
        action={
          <Button onClick={onRetry} variant="brand-secondary">
            <RefreshCw data-icon="inline-start" />
            {t("retry")}
          </Button>
        }
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    </Card>
  )
}

/** El código de la API alimenta el diccionario único de errores. */
function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

export function TeamsPage() {
  const t = useTranslations("teams")
  const apiErrorMessage = useApiErrorMessage()
  const [teams, setTeams] = useState<PortalTeamsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ManagerView>("members")
  const [memberQuery, setMemberQuery] = useState("")
  const [invitationQuery, setInvitationQuery] = useState("")
  const [memberPage, setMemberPage] = useState(1)
  const [invitationPage, setInvitationPage] = useState(1)
  const [activityQuery, setActivityQuery] = useState("")
  const deferredActivityQuery = useDeferredValue(activityQuery)
  const [activityCategory, setActivityCategory] =
    useState<PortalTeamActivityCategory>("all")
  const [activityPage, setActivityPage] = useState(1)
  const activityPageSize = 10
  const [activityData, setActivityData] =
    useState<PortalTeamActivityResponse | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<PortalTeamMember | null>(
    null
  )
  const [selectedInvitation, setSelectedInvitation] =
    useState<PortalTeamInvitation | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadTeams = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    setLoadError(false)
    try {
      const response = await teamsApi.list()
      setTeams(response)
      return response
    } catch {
      setLoadError(true)
      return null
    } finally {
      if (initial) setLoading(false)
    }
  }, [])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    setActivityError(false)
    try {
      setActivityData(
        await teamsApi.listActivity({
          category: activityCategory,
          q: deferredActivityQuery || undefined,
          page: activityPage,
          limit: activityPageSize,
        })
      )
    } catch {
      setActivityData(null)
      setActivityError(true)
    } finally {
      setActivityLoading(false)
    }
  }, [activityCategory, activityPage, activityPageSize, deferredActivityQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTeams(true), 0)
    return () => window.clearTimeout(timer)
  }, [loadTeams])

  useEffect(() => {
    if (activeView === "activity" && teams?.canViewActivity) {
      const timer = window.setTimeout(() => void loadActivity(), 0)
      return () => window.clearTimeout(timer)
    }
  }, [activeView, loadActivity, teams?.canViewActivity])

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  const visibleMembers = useMemo(() => {
    return filterMembers(teams?.members ?? [], memberQuery)
  }, [memberQuery, teams])
  const visibleInvitations = useMemo(() => {
    return filterInvitations(teams?.invitations ?? [], invitationQuery)
  }, [invitationQuery, teams])
  const memberPageCount = Math.max(
    Math.ceil(visibleMembers.length / collectionPageSize),
    1
  )
  const invitationPageCount = Math.max(
    Math.ceil(visibleInvitations.length / collectionPageSize),
    1
  )
  const currentMemberPage = Math.min(memberPage, memberPageCount)
  const currentInvitationPage = Math.min(invitationPage, invitationPageCount)
  const paginatedMembers = visibleMembers.slice(
    (currentMemberPage - 1) * collectionPageSize,
    currentMemberPage * collectionPageSize
  )
  const paginatedInvitations = visibleInvitations.slice(
    (currentInvitationPage - 1) * collectionPageSize,
    currentInvitationPage * collectionPageSize
  )

  if (loading) return <TeamsLoading />
  if (!teams || loadError) {
    return <TeamsError onRetry={() => void loadTeams(true)} />
  }

  const seatsExhausted =
    teams.seatUsage.limit !== null &&
    teams.seatUsage.used >= teams.seatUsage.limit
  const currentMember = teams.members.find(
    (member) => member.id === teams.currentUserId
  )
  const currentSearch = teams.canManage
    ? activeView === "members"
      ? memberQuery
      : activeView === "invitations"
        ? invitationQuery
        : activityQuery
    : memberQuery
  const searchPlaceholder = teams.canManage
    ? activeView === "members"
      ? t("searchMembers")
      : activeView === "invitations"
        ? t("searchInvitations")
        : t("searchActivity")
    : t("searchMembers")

  function updateCurrentSearch(value: string) {
    if (!teams?.canManage || activeView === "members") {
      setMemberPage(1)
      setMemberQuery(value)
      return
    }
    if (activeView === "invitations") {
      setInvitationPage(1)
      setInvitationQuery(value)
      return
    }
    setActivityPage(1)
    setActivityQuery(value)
  }

  function changeView(value: string) {
    const nextView = value as ManagerView
    setActiveView(nextView)
    if (nextView === "members") setMemberPage(1)
    if (nextView === "invitations") setInvitationPage(1)
    if (nextView === "activity") setActivityPage(1)
  }

  async function refreshAfterAction() {
    const refreshedTeams = await loadTeams()
    if (refreshedTeams) {
      const nextMemberPageCount = Math.max(
        Math.ceil(
          filterMembers(refreshedTeams.members, memberQuery).length /
            collectionPageSize
        ),
        1
      )
      const nextInvitationPageCount = Math.max(
        Math.ceil(
          filterInvitations(refreshedTeams.invitations, invitationQuery)
            .length / collectionPageSize
        ),
        1
      )
      setMemberPage((page) => Math.min(page, nextMemberPageCount))
      setInvitationPage((page) => Math.min(page, nextInvitationPageCount))
    }
    if (activeView === "activity") await loadActivity()
  }

  async function submitInvitation(input: {
    email: string
    role: "admin" | "member"
  }) {
    setPendingAction("invite")
    setDialogError(null)
    try {
      await teamsApi.createInvitation(input)
      await refreshAfterAction()
      setInviteOpen(false)
      toast.success(t("invitationSent", { email: input.email }))
    } catch (error) {
      await loadTeams()
      setDialogError(apiErrorMessage(errorCode(error)))
    } finally {
      setPendingAction(null)
    }
  }

  async function saveMemberAccess(input: {
    accountIds: string[]
    permissions: WorkspacePermission[]
    role: "admin" | "member"
  }) {
    if (!selectedMember) return
    setPendingAction(`access:${selectedMember.id}`)
    setDialogError(null)
    try {
      await teamsApi.updateMemberAccess(selectedMember.id, input)
      await refreshAfterAction()
      setSelectedMember(null)
      toast.success(t("accessUpdated"))
    } catch (error) {
      setDialogError(apiErrorMessage(errorCode(error)))
    } finally {
      setPendingAction(null)
    }
  }

  async function resendInvitation(invitation: PortalTeamInvitation) {
    setPendingAction(`resend:${invitation.id}`)
    setActionError(null)
    try {
      await teamsApi.resendInvitation(invitation.id)
      await refreshAfterAction()
      toast.success(t("invitationResent", { email: invitation.email }))
    } catch (error) {
      await loadTeams()
      setActionError(apiErrorMessage(errorCode(error)))
    } finally {
      setPendingAction(null)
    }
  }

  async function confirmCurrentAction() {
    if (!confirmation) return
    setPendingAction(`confirm:${confirmation.kind}`)
    setActionError(null)
    try {
      if (confirmation.kind === "remove") {
        await teamsApi.removeMember(confirmation.member.id)
        toast.success(t("memberRemoved", { name: confirmation.member.name }))
      } else if (confirmation.kind === "revoke") {
        await teamsApi.revokeInvitation(confirmation.invitation.id)
        toast.success(t("invitationRevoked"))
      } else if (confirmation.kind === "transfer") {
        await teamsApi.transferOwnership({
          targetUserId: confirmation.member.id,
        })
        toast.success(t("ownershipTransferred"))
      } else {
        await teamsApi.leaveWorkspace()
        window.location.assign("/login")
        return
      }
      setConfirmation(null)
      await refreshAfterAction()
    } catch (error) {
      setActionError(apiErrorMessage(errorCode(error)))
      setConfirmation(null)
    } finally {
      setPendingAction(null)
    }
  }

  const visibleMembersEmptyProps = {
    action: memberQuery ? (
      <Button
        onClick={() => {
          setMemberPage(1)
          setMemberQuery("")
        }}
        variant="brand-secondary"
      >
        {t("clearSearch")}
      </Button>
    ) : undefined,
    description: t("membersEmptyFilteredDescription"),
    icon: TABLE_EMPTY_ICON,
    title: t("membersNoMatches"),
  }
  const visibleInvitationsEmptyProps = {
    action: invitationQuery ? (
      <Button
        onClick={() => {
          setInvitationPage(1)
          setInvitationQuery("")
        }}
        variant="brand-secondary"
      >
        {t("clearSearch")}
      </Button>
    ) : undefined,
    description: invitationQuery
      ? t("invitationsEmptyFilteredDescription")
      : t("invitationsEmptyDescription"),
    icon: TABLE_EMPTY_ICON,
    title: invitationQuery
      ? t("invitationsNoMatches")
      : t("invitationsEmptyTitle"),
  }

  const copy = confirmationCopy(confirmation, t)

  // Shared by both branches below: the tabbed view nests the card inside
  // <Tabs>, the read-only view renders it on its own.
  const tableHeader = (
    <DataTableHeader
      action={
        teams.canManage ? (
          <Button
            className="hidden sm:inline-flex"
            disabled={seatsExhausted || pendingAction !== null}
            onClick={() => {
              setDialogError(null)
              setInviteOpen(true)
            }}
            size="sm"
            title={seatsExhausted ? t("noSeats") : undefined}
          >
            <MailPlus />
            {t("inviteMember")}
          </Button>
        ) : (
          <Button
            disabled={pendingAction !== null}
            onClick={() => setConfirmation({ kind: "leave" })}
            size="sm"
            variant="brand-secondary"
          >
            <DoorOpen />
            {t("leaveWorkspace")}
          </Button>
        )
      }
      search={{
        ariaLabel: searchPlaceholder.replace("...", ""),
        inputRef: searchRef,
        onChange: updateCurrentSearch,
        placeholder: searchPlaceholder,
        value: currentSearch,
      }}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {actionError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{t("actionFailed")}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
          <AlertAction>
            <Button
              aria-label={t("dismissError")}
              onClick={() => setActionError(null)}
              size="sm"
              variant="brand-secondary"
            >
              {t("close")}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <CollectionHeader
        description={
          teams.canManage ? t("manageDescription") : t("viewDescription")
        }
        title={teams.canManage ? t("pageTitle") : t("myAccessTitle")}
      />

      {teams.canManage ? (
        <Tabs className="gap-4" onValueChange={changeView} value={activeView}>
          <TabsList aria-label={t("viewsLabel")}>
            <TabsTrigger value="members">{t("tab.members")}</TabsTrigger>
            <TabsTrigger value="invitations">
              {t("pendingInvitations")}
            </TabsTrigger>
            <TabsTrigger value="activity">{t("tab.activity")}</TabsTrigger>
          </TabsList>

          <Card variant="subtle">
            {tableHeader}
            <CardContent className="flex flex-col gap-4 px-0">
              {activeView === "activity" ? (
                <DataTableToolbar>
                  <DataTableFilter
                    ariaLabel={t("filterActivity")}
                    onValueChange={(value) => {
                      setActivityCategory(value as PortalTeamActivityCategory)
                      setActivityPage(1)
                    }}
                    options={activityCategories.map((value) => ({
                      label: t(`activityCategory.${value}`),
                      value,
                    }))}
                    value={activityCategory}
                  />
                </DataTableToolbar>
              ) : null}

              <TabsContent className="mt-0" value="members">
                <MembersTable
                  emptyProps={visibleMembersEmptyProps}
                  actorRole={teams.currentUserRole}
                  currentUserId={teams.currentUserId}
                  members={paginatedMembers}
                  onManage={(member) => {
                    setDialogError(null)
                    setSelectedMember(member)
                  }}
                  onRemove={(member) =>
                    setConfirmation({ kind: "remove", member })
                  }
                  onTransfer={(member) =>
                    setConfirmation({ kind: "transfer", member })
                  }
                  pending={pendingAction !== null}
                  onPageChange={setMemberPage}
                  page={currentMemberPage}
                  pageSize={collectionPageSize}
                  total={visibleMembers.length}
                />
              </TabsContent>

              <TabsContent className="mt-0" value="invitations">
                <InvitationsTable
                  emptyProps={visibleInvitationsEmptyProps}
                  invitations={paginatedInvitations}
                  onResend={(invitation) => void resendInvitation(invitation)}
                  onRevoke={(invitation) =>
                    setConfirmation({ kind: "revoke", invitation })
                  }
                  onView={setSelectedInvitation}
                  onPageChange={setInvitationPage}
                  page={currentInvitationPage}
                  pageSize={collectionPageSize}
                  pendingAction={pendingAction}
                  total={visibleInvitations.length}
                />
              </TabsContent>

              <TabsContent className="mt-0" value="activity">
                <ActivityTable
                  data={activityData}
                  error={activityError}
                  loading={activityLoading}
                  hasFilters={Boolean(
                    activityQuery || activityCategory !== "all"
                  )}
                  onClearFilters={() => {
                    setActivityQuery("")
                    setActivityCategory("all")
                    setActivityPage(1)
                  }}
                  onPageChange={setActivityPage}
                  onRetry={() => void loadActivity()}
                />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      ) : (
        <Card variant="subtle">
          {tableHeader}
          <MemberAccessView
            accounts={teams.accounts}
            currentMember={currentMember}
            currentUserId={teams.currentUserId}
            members={paginatedMembers}
            onClearSearch={() => {
              setMemberPage(1)
              setMemberQuery("")
            }}
            onPageChange={setMemberPage}
            page={currentMemberPage}
            pageSize={collectionPageSize}
            query={memberQuery}
            total={visibleMembers.length}
          />
        </Card>
      )}

      {teams.canManage ? (
        <FloatingActionButton
          disabled={seatsExhausted || pendingAction !== null}
          icon={<MailPlus aria-hidden="true" className="size-6" />}
          label={t("inviteMember")}
          onClick={() => {
            setDialogError(null)
            setInviteOpen(true)
          }}
          title={seatsExhausted ? t("noSeats") : undefined}
        />
      ) : null}

      <InviteDialog
        canInviteAdmin={teams.canInviteAdmin}
        error={dialogError}
        key={inviteOpen ? "invite-open" : "invite-closed"}
        onOpenChange={(open) => {
          if (!open && pendingAction !== "invite") {
            setInviteOpen(false)
            setDialogError(null)
          }
        }}
        onSubmit={(input) => void submitInvitation(input)}
        open={inviteOpen}
        pending={pendingAction === "invite"}
      />
      <MemberAccessDialog
        accounts={teams.accounts}
        actorRole={teams.currentUserRole}
        error={dialogError}
        key={selectedMember?.id ?? "no-member"}
        member={selectedMember}
        onOpenChange={(open) => {
          if (!open && !pendingAction?.startsWith("access:")) {
            setSelectedMember(null)
            setDialogError(null)
          }
        }}
        onSubmit={(input) => void saveMemberAccess(input)}
        pending={pendingAction?.startsWith("access:") ?? false}
      />
      <InvitationDetailSheet
        invitation={selectedInvitation}
        onOpenChange={(open) => !open && setSelectedInvitation(null)}
      />
      {copy ? (
        <TeamConfirmationDialog
          confirmLabel={copy.confirmLabel}
          description={copy.description}
          destructive={copy.destructive}
          error={actionError}
          onConfirm={() => void confirmCurrentAction()}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmation(null)
              setActionError(null)
            }
          }}
          open={confirmation !== null}
          pending={pendingAction?.startsWith("confirm:") ?? false}
          title={copy.title}
        />
      ) : null}
    </div>
  )
}

function MembersTable({
  actorRole,
  currentUserId,
  members,
  onManage,
  onPageChange,
  onRemove,
  onTransfer,
  page,
  pageSize,
  pending,
  total,
  emptyProps,
}: {
  emptyProps: React.ComponentProps<typeof EmptyState>
  actorRole: PortalTeamRole
  currentUserId: string
  members: PortalTeamMember[]
  onManage: (member: PortalTeamMember) => void
  onPageChange: (page: number) => void
  onRemove: (member: PortalTeamMember) => void
  onTransfer: (member: PortalTeamMember) => void
  page: number
  pageSize: number
  pending: boolean
  total: number
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
  const actions = (member: PortalTeamMember) => (
    <MemberActions
      actorRole={actorRole}
      currentUserId={currentUserId}
      member={member}
      onManage={onManage}
      onRemove={onRemove}
      onTransfer={onTransfer}
      pending={pending}
    />
  )
  const pageCount = Math.max(Math.ceil(total / pageSize), 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("member")}</TableHead>
              <TableHead>{t("roleColumn")}</TableHead>
              <TableHead>{t("scope")}</TableHead>
              <TableHead>{t("joined")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <MemberIdentity
                    current={member.id === currentUserId}
                    member={member}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={roleVariants[member.role]}>
                    {t(`role.${member.role}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {accountScope(member, t)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {teamDate(member.joinedAt)}
                </TableCell>
                <TableCell className="text-right">{actions(member)}</TableCell>
              </TableRow>
            ))}
            {members.length === 0 ? (
              <TableEmptyRow colSpan={5} {...emptyProps} />
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y md:hidden">
        {members.length === 0 ? <EmptyState {...emptyProps} /> : null}
        {members.map((member) => (
          <div className="grid gap-3 px-4 py-4" key={member.id}>
            <div className="flex items-start justify-between gap-3">
              <MemberIdentity
                current={member.id === currentUserId}
                member={member}
              />
              {actions(member)}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={roleVariants[member.role]}>
                {t(`role.${member.role}`)}
              </Badge>
              <span>{accountScope(member, t)}</span>
              <span>Se unió {teamDate(member.joinedAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <TablePagination
        canGoNext={page < pageCount}
        canGoPrevious={page > 1}
        itemLabel={t("membersItemLabel")}
        onNextPage={() => onPageChange(page + 1)}
        onPreviousPage={() => onPageChange(page - 1)}
        rangeEnd={Math.min(page * pageSize, total)}
        rangeStart={(page - 1) * pageSize + 1}
        total={total}
      />
    </div>
  )
}

function InvitationsTable({
  invitations,
  onPageChange,
  onResend,
  onRevoke,
  onView,
  page,
  pageSize,
  pendingAction,
  total,
  emptyProps,
}: {
  emptyProps: React.ComponentProps<typeof EmptyState>
  invitations: PortalTeamInvitation[]
  onPageChange: (page: number) => void
  onResend: (invitation: PortalTeamInvitation) => void
  onRevoke: (invitation: PortalTeamInvitation) => void
  onView: (invitation: PortalTeamInvitation) => void
  page: number
  pageSize: number
  pendingAction: string | null
  total: number
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
  const actions = (invitation: PortalTeamInvitation) => (
    <InvitationActions
      invitation={invitation}
      onResend={onResend}
      onRevoke={onRevoke}
      onView={onView}
      pending={pendingAction !== null}
    />
  )
  const pageCount = Math.max(Math.ceil(total / pageSize), 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("roleColumn")}</TableHead>
              <TableHead>{t("invitedBy")}</TableHead>
              <TableHead>{t("lastSent")}</TableHead>
              <TableHead>{t("expires")}</TableHead>
              <TableHead>{t("delivery.label")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">
                  {invitation.email}
                </TableCell>
                <TableCell>
                  <Badge variant={roleVariants[invitation.role]}>
                    {t(`role.${invitation.role}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {invitation.invitedByName}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {teamDate(invitation.lastSentAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {teamDate(invitation.expiresAt)}
                </TableCell>
                <TableCell>
                  <DeliveryBadge status={invitation.deliveryStatus} />
                </TableCell>
                <TableCell className="text-right">
                  {pendingAction === `resend:${invitation.id}` ? (
                    <Spinner aria-label={t("resending")} size={16} />
                  ) : (
                    actions(invitation)
                  )}
                </TableCell>
              </TableRow>
            ))}
            {invitations.length === 0 ? (
              <TableEmptyRow colSpan={7} {...emptyProps} />
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y md:hidden">
        {invitations.length === 0 ? <EmptyState {...emptyProps} /> : null}
        {invitations.map((invitation) => (
          <div className="grid gap-3 px-4 py-4" key={invitation.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {invitation.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Invitado por {invitation.invitedByName}
                </p>
              </div>
              {actions(invitation)}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={roleVariants[invitation.role]}>
                {t(`role.${invitation.role}`)}
              </Badge>
              <DeliveryBadge status={invitation.deliveryStatus} />
              <span>Vence {teamDate(invitation.expiresAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <TablePagination
        canGoNext={page < pageCount}
        canGoPrevious={page > 1}
        itemLabel={t("invitationsItemLabel")}
        onNextPage={() => onPageChange(page + 1)}
        onPreviousPage={() => onPageChange(page - 1)}
        rangeEnd={Math.min(page * pageSize, total)}
        rangeStart={(page - 1) * pageSize + 1}
        total={total}
      />
    </div>
  )
}

function ActivityTable({
  data,
  error,
  hasFilters,
  loading,
  onClearFilters,
  onPageChange,
  onRetry,
}: {
  data: PortalTeamActivityResponse | null
  error: boolean
  hasFilters: boolean
  loading: boolean
  onClearFilters: () => void
  onPageChange: (page: number) => void
  onRetry: () => void
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
  if (loading && !data) {
    return <PageLoading />
  }
  if (error) {
    return (
      <EmptyState
        action={
          <Button onClick={onRetry} variant="brand-secondary">
            {t("retry")}
          </Button>
        }
        description={t("activityFailedDescription")}
        icon={CircleAlert}
        title={t("activityUnavailable")}
      />
    )
  }
  if (!data) return null
  const pageCount = Math.max(Math.ceil(data.total / data.limit), 1)
  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("activity")}</TableHead>
              <TableHead>{t("performedBy")}</TableHead>
              <TableHead>{t("person")}</TableHead>
              <TableHead>{t("date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.events.map((event) => (
              <ActivityRow event={event} key={event.id} />
            ))}
            {data.events.length === 0 ? (
              <TableEmptyRow
                colSpan={4}
                action={
                  hasFilters ? (
                    <Button onClick={onClearFilters} variant="brand-secondary">
                      {t("clearFilters")}
                    </Button>
                  ) : undefined
                }
                description={
                  hasFilters
                    ? t("activityEmptyFilteredDescription")
                    : t("activityEmptyDescription")
                }
                title={
                  hasFilters ? t("activityNoMatches") : t("activityEmptyTitle")
                }
              />
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y md:hidden">
        {data.events.map((event) => (
          <div className="flex flex-col gap-2 px-4 py-4" key={event.id}>
            <p className="text-sm font-medium">
              {t(`activityLabel.${event.type}`)}
            </p>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>
                {t("performedByName", {
                  name: event.actorName ?? t("system"),
                })}
              </span>
              <span>Persona: {event.subjectName ?? "—"}</span>
              <span>{teamDate(event.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <TablePagination
        canGoNext={data.page < pageCount}
        canGoPrevious={data.page > 1}
        itemLabel={t("events")}
        onNextPage={() => onPageChange(data.page + 1)}
        onPreviousPage={() => onPageChange(data.page - 1)}
        rangeEnd={Math.min(data.page * data.limit, data.total)}
        rangeStart={(data.page - 1) * data.limit + 1}
        total={data.total}
      />
    </div>
  )
}

function ActivityRow({ event }: { event: PortalTeamActivityEvent }) {
  const t = useTranslations("teams")
  const format = useFormatter()
  const teamDate = (value: string | null) =>
    value
      ? format.dateTime(new Date(value), {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : t("notSentYet")
  return (
    <TableRow>
      <TableCell className="font-medium">
        {t(`activityLabel.${event.type}`)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {event.actorName ?? t("system")}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {event.subjectName ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {teamDate(event.createdAt)}
      </TableCell>
    </TableRow>
  )
}

function MemberAccessView({
  accounts,
  currentMember,
  currentUserId,
  members,
  onClearSearch,
  onPageChange,
  page,
  pageSize,
  query,
  total,
}: {
  accounts: PortalTeamsResponse["accounts"]
  currentMember: PortalTeamMember | undefined
  currentUserId: string
  members: PortalTeamMember[]
  onClearSearch: () => void
  onPageChange: (page: number) => void
  page: number
  pageSize: number
  query: string
  total: number
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
  const pageCount = Math.max(Math.ceil(total / pageSize), 1)

  return (
    <CardContent className="flex flex-col gap-4 px-0">
      <div className="grid gap-4 px-4 md:grid-cols-2">
        <Card variant="inset">
          <CardHeader>
            <CardTitle className="text-base">{t("yourRole")}</CardTitle>
            <CardDescription>{t("yourRoleDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={roleVariants[currentMember?.role ?? "member"]}>
              {t(`role.${currentMember?.role ?? "member"}`)}
            </Badge>
          </CardContent>
        </Card>
        <Card variant="inset">
          <CardHeader>
            <CardTitle className="text-base">
              {t("availableAccounts")}
            </CardTitle>
            <CardDescription>
              {t("availableAccountsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {accounts.length ? (
              accounts.map((account) => (
                <Badge
                  className="max-w-full truncate"
                  key={account.id}
                  variant="neutral"
                >
                  {account.name} · {account.detail}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("noAssignedAccounts")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <div>
        <div className="px-4 pb-3">
          <h3 className="font-medium">{t("workspaceMembers")}</h3>
          <p className="text-sm text-muted-foreground">
            Directorio de solo lectura. Los correos y accesos ajenos son
            privados.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("member")}</TableHead>
                  <TableHead>{t("roleColumn")}</TableHead>
                  <TableHead>{t("joined")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <MemberIdentity
                        current={member.id === currentUserId}
                        member={member}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariants[member.role]}>
                        {t(`role.${member.role}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {teamDate(member.joinedAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {total === 0 ? (
                  <TableEmptyRow
                    colSpan={3}
                    action={
                      query ? (
                        <Button
                          onClick={onClearSearch}
                          variant="brand-secondary"
                        >
                          {t("clearSearch")}
                        </Button>
                      ) : undefined
                    }
                    description={t("membersEmptyFilteredDescription")}
                    title={t("membersNoMatches")}
                  />
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y md:hidden">
            {members.map((member) => (
              <div
                className="flex items-start justify-between gap-3 px-4 py-4"
                key={member.id}
              >
                <MemberIdentity
                  current={member.id === currentUserId}
                  member={member}
                />
                <Badge variant={roleVariants[member.role]}>
                  {t(`role.${member.role}`)}
                </Badge>
              </div>
            ))}
          </div>
          <TablePagination
            canGoNext={page < pageCount}
            canGoPrevious={page > 1}
            itemLabel={t("membersItemLabel")}
            onNextPage={() => onPageChange(page + 1)}
            onPreviousPage={() => onPageChange(page - 1)}
            rangeEnd={Math.min(page * pageSize, total)}
            rangeStart={(page - 1) * pageSize + 1}
            total={total}
          />
        </div>
      </div>
    </CardContent>
  )
}
