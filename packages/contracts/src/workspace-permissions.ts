import { z } from "zod"

export const workspacePermissionSchema = z.enum([
  "boards.view",
  "boards.manage_tasks",
  "boards.manage_columns",
  "boards.delete_tasks",
])

export const workspacePermissionModuleSchema = z.enum(["boards"])

export const workspacePermissionCatalog = [
  {
    module: "boards",
    permissions: [
      "boards.view",
      "boards.manage_tasks",
      "boards.manage_columns",
      "boards.delete_tasks",
    ],
  },
] as const satisfies readonly {
  module: z.infer<typeof workspacePermissionModuleSchema>
  permissions: readonly z.infer<typeof workspacePermissionSchema>[]
}[]

export type WorkspacePermission = z.infer<typeof workspacePermissionSchema>
export type WorkspacePermissionModule = z.infer<
  typeof workspacePermissionModuleSchema
>
