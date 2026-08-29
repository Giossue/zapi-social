"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import {
  CircleAlert,
  EllipsisVertical,
  Settings2,
  ShieldX,
  UsersRound,
} from "lucide-react"

import { ApiError, adminReportsApi } from "@workspace/api-client"
import {
  portalModuleKeys,
  type AdminTeamsResponse,
  type PortalModuleKey,
} from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { DataTableHeader } from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@/components/table-pagination"
import { toast } from "@workspace/ui/components/toast"
import { PageLoading } from "@/components/page-loading"
import { useApiErrorMessage } from "@/lib/api-error-message"
import { loginPath } from "@/features/identity/login-redirect"
import { WorkspaceModuleAccessSheet } from "./workspace-module-access-sheet"

const pageSize = 25
type AdminTeam = AdminTeamsResponse["teams"][number]

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

export function AdminTeamsPage() {
  const t = useTranslations("adminTeams")
  const plansT = useTranslations("plans")
  const format = useFormatter()
  const router = useRouter()
  const apiErrorMessage = useApiErrorMessage()

  const [data, setData] = useState<AdminTeamsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null)
  const [draftModules, setDraftModules] = useState<PortalModuleKey[]>([])
  const [isSavingModules, setIsSavingModules] = useState(false)

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      setData(
        await adminReportsApi.teams({
          q: query.trim() || undefined,
          offset: (page - 1) * pageSize,
          limit: pageSize,
        })
      )
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
  }, [apiErrorMessage, page, query, router])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const openModules = (team: AdminTeam) => {
    setEditingTeam(team)
    setDraftModules([...team.enabledModules])
  }

  const saveModules = async () => {
    if (!editingTeam || isSavingModules) return
    setIsSavingModules(true)
    try {
      const updated = await adminReportsApi.updateTeamModules(editingTeam.id, {
        enabledModules: draftModules,
      })
      setData((current) =>
        current
          ? {
              ...current,
              teams: current.teams.map((team) =>
                team.id === updated.id
                  ? { ...team, enabledModules: updated.enabledModules }
                  : team
              ),
            }
          : current
      )
      setEditingTeam(null)
      toast.success(t("modulesUpdated"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setIsSavingModules(false)
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

  const teams = data?.teams ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = total ? Math.min(rangeStart + teams.length - 1, total) : 0

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description={t("pageDescription")}
        title={t("pageTitle")}
      />
      <Card variant="subtle">
        <DataTableHeader
          search={{
            ariaLabel: t("searchLabel"),
            onChange: (value) => {
              setQuery(value)
              setPage(1)
            },
            placeholder: t("searchPlaceholder"),
            value: query,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          {teams.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("teamColumn")}</TableHead>
                  <TableHead>{t("ownerColumn")}</TableHead>
                  <TableHead className="max-md:hidden">
                    {t("planColumn")}
                  </TableHead>
                  <TableHead className="max-lg:hidden">
                    {t("membersColumn")}
                  </TableHead>
                  <TableHead className="max-lg:hidden">
                    {t("accountsColumn")}
                  </TableHead>
                  <TableHead className="max-xl:hidden">
                    {t("createdColumn")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("actionsColumn")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <div className="grid gap-0.5">
                        <span className="flex items-center gap-2 font-medium">
                          {team.name}
                          {team.kind === "personal" ? (
                            <Badge variant="neutral">{t("personal")}</Badge>
                          ) : null}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {team.slug}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-0.5">
                        <span className="text-sm">{team.ownerName}</span>
                        <span className="text-xs text-muted-foreground">
                          {team.ownerEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-md:hidden">
                      {team.planName ?? t("noPlan")}
                    </TableCell>
                    <TableCell className="tabular-nums max-lg:hidden">
                      {format.number(team.memberCount)}
                    </TableCell>
                    <TableCell className="tabular-nums max-lg:hidden">
                      {format.number(team.accountCount)}
                    </TableCell>
                    <TableCell className="max-xl:hidden">
                      {format.dateTime(new Date(team.createdAt), "date")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={t("actionsFor", { name: team.name })}
                            size="icon-sm"
                            variant="brand-secondary"
                          >
                            <EllipsisVertical aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={() => openModules(team)}
                            >
                              <Settings2 aria-hidden="true" />
                              {t("manageModules")}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
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
                icon={UsersRound}
                title={t("emptyTitle")}
              />
            </div>
          )}
          <TablePagination
            canGoNext={safePage < pageCount}
            canGoPrevious={safePage > 1}
            itemLabel={t("itemLabel")}
            onNextPage={() => setPage((current) => current + 1)}
            onPreviousPage={() => setPage((current) => current - 1)}
            rangeEnd={rangeEnd}
            rangeStart={rangeStart}
            total={total}
          />
        </CardContent>
      </Card>
      <WorkspaceModuleAccessSheet
        cancelLabel={t("cancel")}
        description={t("modulesDescription", {
          name: editingTeam?.name ?? t("workspaceFallback"),
        })}
        disabledDescription={t("moduleNotInPlan")}
        groupDescription={t("modulesHint")}
        groupLabel={t("modulesLabel")}
        modules={portalModuleKeys.map((module) => ({
          available: editingTeam?.availableModules.includes(module) ?? false,
          enabled: draftModules.includes(module),
          key: module,
          label: plansT(`limits.module.${module}` as never),
        }))}
        onOpenChange={(open) => !open && setEditingTeam(null)}
        onSave={() => void saveModules()}
        onToggle={(key, enabled) => {
          const moduleKey = key as PortalModuleKey
          setDraftModules((current) =>
            enabled
              ? [...new Set([...current, moduleKey])]
              : current.filter((item) => item !== moduleKey)
          )
        }}
        open={editingTeam !== null}
        saveLabel={t("saveModules")}
        saving={isSavingModules}
        savingLabel={t("savingModules")}
        title={t("modulesTitle", {
          name: editingTeam?.name ?? t("workspaceFallback"),
        })}
      />
    </div>
  )
}
