import { z } from "zod"

/**
 * Permisos que un espacio de trabajo puede conceder a una membresía concreta.
 * `owner` y `admin` los tienen todos de forma implícita, así que la lista solo
 * se consulta para `member`: una membresía nueva no queda sin acceso y no hay
 * que migrar las filas existentes.
 *
 * La clave es estable y no lleva texto: el rótulo lo pone la interfaz.
 */
export const workspacePermissionSchema = z.enum([
  "boards.view",
  "boards.manage_tasks",
  "boards.manage_columns",
  "boards.delete_tasks",
])

export const workspacePermissionModuleSchema = z.enum(["boards"])

/**
 * Agrupación por módulo para pintar la pantalla de permisos. Vive en el
 * contrato porque la API también la usa para validar que un permiso recibido
 * pertenece al catálogo vigente.
 */
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
