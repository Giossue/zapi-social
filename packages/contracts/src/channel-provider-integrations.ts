import { z } from "zod"

import {
  channelProvider,
  channelProviderDefinitionSchema,
  channelProviderFieldKeySchema,
} from "./channel-catalog.js"
import {
  portalChannelCapabilityKeySchema,
  portalChannelProviderKeySchema,
  type PortalChannelProviderKey,
} from "./channels-v2.js"

export const channelProviderIssueSchema = z.enum([
  "configuration_required",
  "configuration_requires_test",
  "verifier_unavailable",
  "invalid_credentials",
  "provider_unreachable",
  "unknown",
])

export const channelProviderReadinessSchema = z.enum([
  "disabled",
  "incomplete",
  "untested",
  "ready",
])

export const channelProviderCapabilityStateSchema = z.object({
  key: portalChannelCapabilityKeySchema,
  enabled: z.boolean(),
})

export const channelProviderIntegrationSchema = z.object({
  providerKey: portalChannelProviderKeySchema,
  definition: channelProviderDefinitionSchema,
  enabled: z.boolean(),
  readiness: channelProviderReadinessSchema,
  issues: z.array(channelProviderIssueSchema),
  values: z.record(z.string(), z.string()),
  secretsConfigured: z.array(channelProviderFieldKeySchema),
  capabilities: z.array(channelProviderCapabilityStateSchema),
  lastTestedAt: z.string().datetime().nullable(),
  hasCustomScreen: z.boolean(),
})

export const channelProviderIntegrationsResponseSchema = z.object({
  providers: z.array(channelProviderIntegrationSchema),
})

export const saveChannelProviderIntegrationSchema = z
  .object({
    enabled: z.boolean(),
    values: z.record(z.string(), z.string()),
    enabledCapabilityKeys: z.array(portalChannelCapabilityKeySchema).max(20),
  })
  .strict()

export const testChannelProviderIntegrationSchema = z
  .object({ values: z.record(z.string(), z.string()) })
  .strict()

export const testChannelProviderIntegrationResponseSchema = z.object({
  ok: z.boolean(),
  issue: channelProviderIssueSchema.nullable(),
})

export function channelProviderValuesSchema(
  providerKey: PortalChannelProviderKey
) {
  const definition = channelProvider(providerKey)
  if (!definition) return z.record(z.string(), z.string())

  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of definition.fields) {
    if (field.readOnly) continue

    let value = z.string().trim()
    if (field.maxLength !== null) value = value.max(field.maxLength)
    shape[field.key] = field.required
      ? value.min(1)
      : value.optional().default("")
  }

  return z.object(shape).strict()
}

export type ChannelProviderIssue = z.infer<typeof channelProviderIssueSchema>
export type ChannelProviderReadiness = z.infer<
  typeof channelProviderReadinessSchema
>
export type ChannelProviderIntegration = z.infer<
  typeof channelProviderIntegrationSchema
>
export type ChannelProviderIntegrationsResponse = z.infer<
  typeof channelProviderIntegrationsResponseSchema
>
export type SaveChannelProviderIntegrationInput = z.infer<
  typeof saveChannelProviderIntegrationSchema
>
export type TestChannelProviderIntegrationInput = z.infer<
  typeof testChannelProviderIntegrationSchema
>
export type TestChannelProviderIntegrationResponse = z.infer<
  typeof testChannelProviderIntegrationResponseSchema
>
