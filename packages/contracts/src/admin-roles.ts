import { z } from "zod"

export const adminPermissionModuleSchema = z.enum([
  "dashboard",
  "users",
  "credits",
  "affiliate",
  "coupons",
  "payments",
  "subscriptions",
  "manual-payments",
  "payment-report",
  "plans",
  "content",
  "languages",
  "email-templates",
  "notifications",
  "support",
  "integrations",
  "settings",
  "ai",
  "audit-events",
  "system-information",
  "user-roles",
  "user-report",
  "teams",
])

export const adminPermissionActionSchema = z.enum(["view", "manage"])

export const adminPermissionKeySchema = z
  .string()
  .max(64)
  .regex(/^(\*|[a-z-]+\.(\*|view|manage))$/)

export const adminRoleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  permissions: z.array(adminPermissionKeySchema),
  memberCount: z.number().int(),
  createdAt: z.string().datetime(),
})

export const adminRoleMemberSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  email: z.string(),
})

export const adminRolesResponseSchema = z.object({
  roles: z.array(adminRoleSchema),
})

export const adminRoleMembersResponseSchema = z.object({
  members: z.array(adminRoleMemberSchema),
})

export const adminRoleCandidatesResponseSchema = z.object({
  candidates: z.array(adminRoleMemberSchema),
})

export const upsertAdminRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).default(""),
    permissions: z.array(adminPermissionKeySchema).max(64),
  })
  .strict()

export const assignAdminRoleSchema = z.object({ userId: z.uuid() }).strict()

export type AdminPermissionModule = z.infer<typeof adminPermissionModuleSchema>
export type AdminPermissionAction = z.infer<typeof adminPermissionActionSchema>
export type AdminRole = z.infer<typeof adminRoleSchema>
export type AdminRoleMember = z.infer<typeof adminRoleMemberSchema>
export type AdminRolesResponse = z.infer<typeof adminRolesResponseSchema>
export type AdminRoleMembersResponse = z.infer<
  typeof adminRoleMembersResponseSchema
>
export type AdminRoleCandidatesResponse = z.infer<
  typeof adminRoleCandidatesResponseSchema
>
export type UpsertAdminRoleInput = z.infer<typeof upsertAdminRoleSchema>
export type AssignAdminRoleInput = z.infer<typeof assignAdminRoleSchema>

export function adminPermissionMatches(
  granted: readonly string[],
  required: string
): boolean {
  if (granted.includes("*") || granted.includes(required)) return true
  const [module] = required.split(".")
  return granted.includes(`${module}.*`)
}

export function adminPermissionFor(
  path: string,
  method: string
): string | null {
  const match = /^\/v1\/admin\/([a-z-]+)(?:\/([a-z-]+))?/.exec(
    path.split("?")[0] ?? ""
  )
  if (!match) return null
  const module =
    match[1] === "operations" ? (match[2] ?? "operations") : match[1]
  const action = method === "GET" || method === "HEAD" ? "view" : "manage"
  return `${module}.${action}`
}
