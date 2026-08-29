import { z } from "zod"

import type { AiRequestKind } from "./ai-v2.js"

export const portalModuleKeySchema = z.enum([
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
])

export const portalModuleKeys = portalModuleKeySchema.options

const limitValue = z.number().int().min(-1).max(1_000_000)
const actionCostValue = z.number().int().min(0).max(10_000)

export const defaultAiActionCosts = {
  content: 2,
  image: 4,
  video: 12,
  repurpose: 2,
  planner: 3,
  review: 1,
  timing: 1,
  search: 1,
  ai_publishing: 2,
} satisfies Record<AiRequestKind, number>

export const aiActionCostsSchema = z
  .object({
    content: actionCostValue,
    image: actionCostValue,
    video: actionCostValue,
    repurpose: actionCostValue,
    planner: actionCostValue,
    review: actionCostValue,
    timing: actionCostValue,
    search: actionCostValue,
    ai_publishing: actionCostValue,
  })
  .strict()

export const planLimitsSchema = z
  .object({
    maxChannels: limitValue.default(-1),
    channelCountMode: z.enum(["total", "per_network"]).default("total"),
    maxPostsPerMonth: limitValue.default(-1),
    maxTeamMembers: limitValue.default(-1),
    maxStorageMb: limitValue.default(-1),
    maxFileSizeMb: limitValue.default(-1),
    aiVideoMaxSeconds: limitValue.default(-1),
    creditsPerMonth: limitValue.default(-1),
    aiActionCosts: aiActionCostsSchema.default(defaultAiActionCosts),
    enabledModules: z
      .array(portalModuleKeySchema)
      .default([...portalModuleKeySchema.options]),
  })
  .strict()

export const defaultPlanLimits = planLimitsSchema.parse({})
export const restrictivePlanLimits = planLimitsSchema.parse({
  maxChannels: 0,
  maxPostsPerMonth: 0,
  maxTeamMembers: 0,
  maxStorageMb: 0,
  maxFileSizeMb: 0,
  aiVideoMaxSeconds: 0,
  creditsPerMonth: 0,
  enabledModules: [],
})

export type PortalModuleKey = z.infer<typeof portalModuleKeySchema>
export type PlanLimits = z.infer<typeof planLimitsSchema>
export type AiActionCosts = z.infer<typeof aiActionCostsSchema>

export function planLimitsFrom(value: unknown): PlanLimits {
  const parsed = planLimitsSchema.safeParse(value ?? {})
  return parsed.success ? parsed.data : defaultPlanLimits
}

export function isUnlimited(limit: number): boolean {
  return limit < 0
}

export function splitAiCreditCharge(input: {
  accountUnlimited: boolean
  costUnits: number
  creditsPerMonth: number
  usedPlanUnits: number
}) {
  if (input.accountUnlimited || isUnlimited(input.creditsPerMonth)) {
    return { allowanceUnits: input.costUnits, balanceDebitedUnits: 0 }
  }
  const remainingAllowance = Math.max(
    input.creditsPerMonth - input.usedPlanUnits,
    0
  )
  const allowanceUnits = Math.min(input.costUnits, remainingAllowance)
  return {
    allowanceUnits,
    balanceDebitedUnits: input.costUnits - allowanceUnits,
  }
}

const portalPathModules: Record<string, PortalModuleKey> = {
  publishing: "publishing",
  "bulk-posts": "bulk-posts",
  "rss-schedules": "rss-schedules",
  automation: "automation",
  ai: "ai-studio",
  captions: "captions",
  watermarks: "watermarks",
  files: "files",
  "online-media": "files",
  "link-bio": "link-bio",
  boards: "boards",
}

export function portalModuleForPath(path: string): PortalModuleKey | null {
  const pathname = path.split("?")[0] ?? ""
  if (pathname.startsWith("/v1/portal/ai/publishing-schedules")) {
    return "ai-publishing"
  }
  const match = /^\/v1\/portal\/([a-z-]+)/.exec(pathname)
  if (!match?.[1]) return null
  return portalPathModules[match[1]] ?? null
}

export function portalModuleForHref(href: string): PortalModuleKey | null {
  const settingsModule =
    /^\/portal\/settings\/(ai-studio|link-bio|watermarks|automation)/.exec(
      href
    )?.[1]
  if (settingsModule) return portalPathModules[settingsModule] ?? null
  if (href.startsWith("/portal/ai-studio/automation")) {
    return "ai-publishing"
  }
  if (href.startsWith("/portal/ai-studio")) return "ai-studio"
  const match = /^\/portal\/([a-z-]+)/.exec(href)
  if (!match?.[1]) return null
  return portalPathModules[match[1]] ?? null
}
