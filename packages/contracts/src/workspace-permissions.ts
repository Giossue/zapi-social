import { z } from "zod"

import {
  portalModuleForHref,
  portalModuleForPath,
  type PortalModuleKey,
} from "./plan-limits.js"

export const workspacePermissionSchema = z.enum([
  "channels.view",
  "publishing.view",
  "publishing.manage",
  "bulk-posts.view",
  "bulk-posts.manage",
  "rss-schedules.view",
  "rss-schedules.manage",
  "automation.view",
  "ai-studio.view",
  "ai-studio.manage",
  "ai-publishing.view",
  "ai-publishing.manage",
  "captions.view",
  "captions.manage",
  "watermarks.view",
  "watermarks.manage",
  "files.view",
  "files.manage",
  "link-bio.view",
  "link-bio.manage",
  "boards.view",
  "boards.manage_tasks",
  "boards.manage_columns",
  "boards.delete_tasks",
  "groups.view",
  "groups.manage",
])

export const workspacePermissionModuleSchema = z.enum([
  "channels",
  "publishing",
  "bulk-posts",
  "rss-schedules",
  "automation",
  "ai-studio",
  "ai-publishing",
  "captions",
  "watermarks",
  "files",
  "link-bio",
  "boards",
  "groups",
])

export const workspacePermissionCatalog = [
  {
    module: "channels",
    permissions: ["channels.view"],
  },
  {
    module: "publishing",
    permissions: ["publishing.view", "publishing.manage"],
  },
  {
    module: "bulk-posts",
    permissions: ["bulk-posts.view", "bulk-posts.manage"],
  },
  {
    module: "rss-schedules",
    permissions: ["rss-schedules.view", "rss-schedules.manage"],
  },
  {
    module: "automation",
    permissions: ["automation.view"],
  },
  {
    module: "ai-studio",
    permissions: ["ai-studio.view", "ai-studio.manage"],
  },
  {
    module: "ai-publishing",
    permissions: ["ai-publishing.view", "ai-publishing.manage"],
  },
  {
    module: "captions",
    permissions: ["captions.view", "captions.manage"],
  },
  {
    module: "watermarks",
    permissions: ["watermarks.view", "watermarks.manage"],
  },
  {
    module: "files",
    permissions: ["files.view", "files.manage"],
  },
  {
    module: "link-bio",
    permissions: ["link-bio.view", "link-bio.manage"],
  },
  {
    module: "boards",
    permissions: [
      "boards.view",
      "boards.manage_tasks",
      "boards.manage_columns",
      "boards.delete_tasks",
    ],
  },
  {
    module: "groups",
    permissions: ["groups.view", "groups.manage"],
  },
] as const satisfies readonly {
  module: z.infer<typeof workspacePermissionModuleSchema>
  permissions: readonly z.infer<typeof workspacePermissionSchema>[]
}[]

export type WorkspacePermission = z.infer<typeof workspacePermissionSchema>
export type WorkspacePermissionModule = z.infer<
  typeof workspacePermissionModuleSchema
>

export const allWorkspacePermissions: readonly WorkspacePermission[] =
  workspacePermissionCatalog.flatMap((group) => [...group.permissions])

export const defaultWorkspaceMemberPermissions: readonly WorkspacePermission[] =
  [
    "channels.view",
    "publishing.view",
    "publishing.manage",
    "bulk-posts.view",
    "bulk-posts.manage",
    "rss-schedules.view",
    "ai-studio.view",
    "ai-studio.manage",
    "ai-publishing.view",
    "captions.view",
    "captions.manage",
    "watermarks.view",
    "files.view",
    "files.manage",
    "link-bio.view",
    "groups.view",
  ]

export function sanitizeWorkspacePermissions(
  values: readonly unknown[]
): WorkspacePermission[] {
  const valid = values.flatMap((value) => {
    const parsed = workspacePermissionSchema.safeParse(value)
    return parsed.success ? [parsed.data] : []
  })
  return [
    ...new Set(
      valid.flatMap((permission) => {
        if (permission.endsWith(".view")) return [permission]
        const module = workspacePermissionModuleFor(permission)
        const view = workspacePermissionSchema.safeParse(`${module}.view`)
        return view.success ? [view.data, permission] : [permission]
      })
    ),
  ]
}

export function effectiveWorkspacePermissions(
  role: string,
  granted: readonly unknown[]
): readonly WorkspacePermission[] {
  return role === "owner" || role === "admin"
    ? allWorkspacePermissions
    : sanitizeWorkspacePermissions(granted)
}

export function workspacePermissionMatches(
  granted: readonly string[] | undefined,
  required: WorkspacePermission
): boolean {
  return sanitizeWorkspacePermissions(granted ?? []).includes(required)
}

export function workspacePermissionModuleFor(
  permission: WorkspacePermission
): WorkspacePermissionModule {
  return permission.split(".")[0] as WorkspacePermissionModule
}

function permissionForModule(
  module: PortalModuleKey | "channels",
  action: "view" | "manage"
): WorkspacePermission | null {
  if (module === "boards") return "boards.view"
  const parsed = workspacePermissionSchema.safeParse(`${module}.${action}`)
  return parsed.success ? parsed.data : null
}

export function workspacePermissionForPortalRequest(
  path: string,
  method: string
): WorkspacePermission | null {
  const pathname = path.split("?")[0] ?? ""
  const module =
    pathname.startsWith("/v1/portal/channels") ||
    pathname.startsWith("/v1/portal/channel-connections")
      ? "channels"
      : portalModuleForPath(path)
  if (!module) return null
  return permissionForModule(
    module,
    method === "GET" || method === "HEAD" ? "view" : "manage"
  )
}

export function workspacePermissionForPortalHref(
  href: string
): WorkspacePermission | null {
  const module = href.startsWith("/portal/channels")
    ? "channels"
    : portalModuleForHref(href)
  return module ? permissionForModule(module, "view") : null
}
