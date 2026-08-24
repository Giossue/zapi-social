import { z } from "zod"

import { portalModuleKeySchema } from "./plan-limits.js"

export const adminUserReportResponseSchema = z.object({
  totals: z.object({
    users: z.number().int(),
    newLast30Days: z.number().int(),
    growthPct: z.number(),
    verifiedPct: z.number(),
  }),
  signupsByMonth: z.array(
    z.object({ month: z.string(), count: z.number().int() })
  ),
  byLocale: z.array(z.object({ locale: z.string(), count: z.number().int() })),
  workspacesByPlan: z.array(
    z.object({ plan: z.string(), count: z.number().int() })
  ),
  recent: z.array(
    z.object({
      id: z.uuid(),
      displayName: z.string(),
      email: z.string(),
      locale: z.string().nullable(),
      planName: z.string().nullable(),
      verified: z.boolean(),
      createdAt: z.string().datetime(),
    })
  ),
})

export const listAdminTeamsQuerySchema = z
  .object({
    q: z.string().trim().max(160).optional(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()

export const adminTeamsResponseSchema = z.object({
  totals: z.object({
    workspaces: z.number().int(),
    teamWorkspaces: z.number().int(),
    averageMembers: z.number(),
    connectedAccounts: z.number().int(),
  }),
  teams: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      kind: z.string(),
      ownerName: z.string(),
      ownerEmail: z.string(),
      planName: z.string().nullable(),
      enabledModules: z.array(portalModuleKeySchema),
      availableModules: z.array(portalModuleKeySchema),
      memberCount: z.number().int(),
      accountCount: z.number().int(),
      createdAt: z.string().datetime(),
    })
  ),
  total: z.number().int(),
})

export const updateAdminTeamModulesSchema = z
  .object({
    enabledModules: z
      .array(portalModuleKeySchema)
      .refine((modules) => new Set(modules).size === modules.length),
  })
  .strict()

export type AdminUserReportResponse = z.infer<
  typeof adminUserReportResponseSchema
>
export type ListAdminTeamsQuery = z.infer<typeof listAdminTeamsQuerySchema>
export type AdminTeamsResponse = z.infer<typeof adminTeamsResponseSchema>
export type UpdateAdminTeamModulesInput = z.infer<
  typeof updateAdminTeamModulesSchema
>
