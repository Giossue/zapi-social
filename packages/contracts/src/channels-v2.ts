import { z } from "zod"

/** Contratos Portal Channels V2: sin secretos, tokens, QR ni payloads de providers. */
export const portalChannelProviderKeySchema = z.enum([
  "meta",
  "linkedin",
  "x",
  "tiktok",
  "whatsapp",
])

export const portalChannelCapabilityKeySchema = z.enum([
  "facebook_page",
  "instagram_profile",
  "linkedin_page",
  "linkedin_profile",
  "x_profile",
  "tiktok_profile",
  "whatsapp_status",
])

export const portalChannelConnectionKindSchema = z.enum([
  "oauth_direct",
  "oauth_picker",
  "qr_device",
])

export const portalChannelAvailabilitySchema = z.enum([
  "ready",
  "coming_soon",
  "plan_locked",
])

export const portalChannelStatusSchema = z.enum(["connected", "disconnected"])

export const portalChannelCapabilitySchema = z.object({
  key: portalChannelCapabilityKeySchema,
  provider: portalChannelProviderKeySchema,
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  availability: portalChannelAvailabilitySchema,
  connectionKind: portalChannelConnectionKindSchema,
})

export const portalChannelAccountSchema = z.object({
  id: z.uuid(),
  provider: portalChannelProviderKeySchema,
  capabilityKey: portalChannelCapabilityKeySchema,
  displayName: z.string().min(1).max(255),
  externalName: z.string().min(1).max(255).nullable(),
  handle: z.string().max(255).nullable(),
  profileUrl: z.url().max(2048).nullable(),
  avatarUrl: z.url().max(2048).nullable(),
  status: portalChannelStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const portalChannelsPaginationSchema = z.object({
  limit: z.number().int().min(1).max(50),
  nextCursor: z.string().min(1).max(1024).nullable(),
})

export const portalChannelsSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  connected: z.number().int().nonnegative(),
  disconnected: z.number().int().nonnegative(),
})

export const portalChannelsResponseSchema = z.object({
  canManage: z.boolean(),
  capabilities: z.array(portalChannelCapabilitySchema),
  accounts: z.array(portalChannelAccountSchema),
  pagination: portalChannelsPaginationSchema,
  summary: portalChannelsSummarySchema,
})

export const portalChannelsQuerySchema = z
  .object({
    q: z.string().trim().max(255).optional(),
    provider: portalChannelProviderKeySchema.optional(),
    capability: portalChannelCapabilityKeySchema.optional(),
    status: portalChannelStatusSchema.optional(),
    // Los sorts legados se mantienen con cursor específico y desempate por id.
    sort: z
      .enum(["created_at_desc", "updated_at_desc", "display_name_asc"])
      .default("created_at_desc"),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    cursor: z.string().min(1).max(1024).optional(),
  })
  .strict()

/** Solo `display_name` se edita desde Portal; identidad y vínculo externo son read-only. */
export const updatePortalChannelSchema = z
  .object({ displayName: z.string().trim().min(2).max(255) })
  .strict()

export const portalChannelConnectionStateSchema = z.enum([
  "authorizing",
  "picker_ready",
  "qr_ready",
  "waiting_for_scan",
  "connected",
  "cancelled",
  "expired",
  "failed",
])

export const startPortalChannelConnectionSchema = z
  .object({
    capabilityKey: portalChannelCapabilityKeySchema,
    reconnectAccountId: z.uuid().optional(),
  })
  .strict()

export const portalChannelConnectionSchema = z.object({
  id: z.uuid(),
  capabilityKey: portalChannelCapabilityKeySchema,
  state: portalChannelConnectionStateSchema,
  expiresAt: z.string().datetime(),
})

/** Candidatos emitidos por la conexión actual; el navegador nunca aporta IDs externos arbitrarios. */
export const portalChannelCandidateSchema = z.object({
  id: z.string().min(1).max(512),
  label: z.string().min(1).max(255),
  description: z.string().min(1).max(500),
  metadata: z.string().max(500).nullable(),
  avatarUrl: z.url().max(2048).nullable().optional(),
})

export const portalChannelCandidatesResponseSchema = z.object({
  connectionId: z.uuid(),
  state: z.literal("picker_ready"),
  candidates: z.array(portalChannelCandidateSchema),
})

export const selectPortalChannelCandidateSchema = z
  .object({ candidateId: z.string().min(1).max(512) })
  .strict()

export const selectPortalChannelCandidateResponseSchema = z.object({
  account: portalChannelAccountSchema,
  connection: portalChannelConnectionSchema.extend({
    state: z.literal("connected"),
  }),
})

export const startWhatsAppStatusConnectionSchema = z
  .object({ reconnectAccountId: z.uuid().optional() })
  .strict()

export const whatsappStatusQrResponseSchema = z.object({
  connection: portalChannelConnectionSchema.extend({
    state: z.enum(["qr_ready", "waiting_for_scan"]),
  }),
  /** URL interna de corta vida; nunca la URL original del conector. */
  qrEndpoint: z.string().startsWith("/v1/portal/channel-connections/"),
})

export const requestPortalChannelProfileSyncResponseSchema = z.object({
  acceptedAt: z.string().datetime(),
  nextAllowedAt: z.string().datetime(),
})

export const portalChannelConnectionStatusResponseSchema = z.object({
  connection: portalChannelConnectionSchema,
  account: portalChannelAccountSchema.nullable(),
  publicError: z
    .object({ code: z.string().min(1).max(80), requestId: z.string().uuid() })
    .nullable(),
})

export type PortalChannelProviderKey = z.infer<
  typeof portalChannelProviderKeySchema
>
export type PortalChannelCapabilityKey = z.infer<
  typeof portalChannelCapabilityKeySchema
>
export type PortalChannelAvailability = z.infer<
  typeof portalChannelAvailabilitySchema
>
export type PortalChannelStatus = z.infer<typeof portalChannelStatusSchema>
export type PortalChannelCapability = z.infer<
  typeof portalChannelCapabilitySchema
>
export type PortalChannelAccount = z.infer<typeof portalChannelAccountSchema>
export type PortalChannelsPagination = z.infer<
  typeof portalChannelsPaginationSchema
>
export type PortalChannelsSummary = z.infer<typeof portalChannelsSummarySchema>
export type PortalChannelsResponse = z.infer<
  typeof portalChannelsResponseSchema
>
export type PortalChannelsQuery = z.infer<typeof portalChannelsQuerySchema>
export type UpdatePortalChannelInput = z.infer<typeof updatePortalChannelSchema>
export type StartPortalChannelConnectionInput = z.infer<
  typeof startPortalChannelConnectionSchema
>
export type PortalChannelConnection = z.infer<
  typeof portalChannelConnectionSchema
>
export type PortalChannelCandidate = z.infer<
  typeof portalChannelCandidateSchema
>
export type StartWhatsAppStatusConnectionInput = z.infer<
  typeof startWhatsAppStatusConnectionSchema
>
export type WhatsAppStatusQrResponse = z.infer<
  typeof whatsappStatusQrResponseSchema
>
export type RequestPortalChannelProfileSyncResponse = z.infer<
  typeof requestPortalChannelProfileSyncResponseSchema
>
