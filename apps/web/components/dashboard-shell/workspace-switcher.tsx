"use client"

import { ApiError, authApi } from "@workspace/api-client"
import type { ActiveWorkspace } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { Building2, ChevronsUpDown } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

type WorkspaceSwitcherProps = {
  activeWorkspace: ActiveWorkspace
  workspaces?: ActiveWorkspace[]
}

export function WorkspaceSwitcher({
  activeWorkspace,
  workspaces,
}: WorkspaceSwitcherProps) {
  const t = useTranslations("shell.workspaces")
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null
  )
  const availableWorkspaces = workspaces?.length
    ? workspaces
    : [activeWorkspace]

  if (availableWorkspaces.length < 2) return null

  async function activate(workspaceId: string) {
    if (workspaceId === activeWorkspace.id || pendingWorkspaceId) return
    setPendingWorkspaceId(workspaceId)
    try {
      await authApi.activateWorkspace({ workspaceId })
      window.location.assign("/portal/dashboard")
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Workspace activation failed", {
          code: error.code,
          requestId: error.requestId,
        })
      } else {
        console.error("Workspace activation failed", error)
      }
      toast.error(t("activationFailed"))
      setPendingWorkspaceId(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={Boolean(pendingWorkspaceId)}
          variant="brand-secondary"
        >
          {pendingWorkspaceId ? (
            <Spinner aria-label={t("switching")} data-icon="inline-start" />
          ) : (
            <Building2 aria-hidden="true" data-icon="inline-start" />
          )}
          <span className="hidden max-w-40 truncate sm:inline">
            {activeWorkspace.name}
          </span>
          <ChevronsUpDown aria-hidden="true" data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={activeWorkspace.id}
            onValueChange={(workspaceId) => void activate(workspaceId)}
          >
            {availableWorkspaces.map((workspace) => (
              <DropdownMenuRadioItem
                disabled={Boolean(pendingWorkspaceId)}
                key={workspace.id}
                value={workspace.id}
              >
                <div className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{workspace.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`kind.${workspace.kind ?? "team"}`)} ·{" "}
                    {t(`role.${workspace.role}`)}
                  </span>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
