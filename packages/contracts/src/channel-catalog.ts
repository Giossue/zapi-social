import { z } from "zod"

import {
  portalChannelCapabilityKeySchema,
  portalChannelProviderKeySchema,
  type PortalChannelCapabilityKey,
  type PortalChannelProviderKey,
} from "./channels-v2.js"

export const channelFieldTypeSchema = z.enum([
  "text",
  "secret",
  "textarea",
  "toggle",
])

export const channelAccountTypeSchema = z.enum(["oauth", "manual"])

export const channelProviderFieldKeySchema = z.enum([
  "clientId",
  "clientSecret",
  "clientKey",
  "apiVersion",
  "graphVersion",
  "callbackUrl",
  "baseUrl",
  "basicAuthUsername",
  "basicAuthPassword",
])

export const channelProviderFieldSchema = z.object({
  key: channelProviderFieldKeySchema,
  type: channelFieldTypeSchema,
  required: z.boolean(),
  readOnly: z.boolean(),
  maxLength: z.number().int().positive().nullable(),
})

export const channelProviderDefinitionSchema = z.object({
  key: portalChannelProviderKeySchema,
  order: z.number().int().nonnegative(),
  accountTypes: z.array(channelAccountTypeSchema).min(1),
  fields: z.array(channelProviderFieldSchema),
})

export const channelMediaRuleSchema = z.object({
  destination: z.string(),
  minItems: z.number().int().nonnegative(),
  maxItems: z.number().int().nonnegative(),
  allows: z.enum(["image", "video", "both"]),
  allowsMixed: z.boolean(),
  maxVideos: z.number().int().nonnegative().nullable(),
})

export const channelCapabilityDefinitionSchema = z.object({
  key: portalChannelCapabilityKeySchema,
  providerKey: portalChannelProviderKeySchema,
  order: z.number().int().nonnegative(),
  supportsPublishing: z.boolean(),
  destinations: z.array(z.string()).min(1),
  mediaRules: z.array(channelMediaRuleSchema).min(1),
})

export type ChannelFieldType = z.infer<typeof channelFieldTypeSchema>
export type ChannelProviderFieldKey = z.infer<
  typeof channelProviderFieldKeySchema
>
export type ChannelAccountType = z.infer<typeof channelAccountTypeSchema>
export type ChannelProviderField = z.infer<typeof channelProviderFieldSchema>
export type ChannelProviderDefinition = z.infer<
  typeof channelProviderDefinitionSchema
>
export type ChannelMediaRule = z.infer<typeof channelMediaRuleSchema>
export type ChannelCapabilityDefinition = z.infer<
  typeof channelCapabilityDefinitionSchema
>

function field(
  key: ChannelProviderFieldKey,
  type: ChannelFieldType,
  options: { required?: boolean; readOnly?: boolean; maxLength?: number } = {}
): ChannelProviderField {
  return {
    key,
    type,
    required: options.required ?? false,
    readOnly: options.readOnly ?? false,
    maxLength: options.maxLength ?? null,
  }
}

export const channelProviderCatalog: readonly ChannelProviderDefinition[] = [
  {
    key: "meta",
    order: 10,
    accountTypes: ["oauth"],
    fields: [
      field("clientId", "text", { required: true, maxLength: 128 }),
      field("clientSecret", "secret", { required: true, maxLength: 256 }),
      field("graphVersion", "text", { maxLength: 8 }),
      field("callbackUrl", "text", { readOnly: true }),
    ],
  },
  {
    key: "linkedin",
    order: 20,
    accountTypes: ["oauth"],
    fields: [
      field("clientId", "text", { required: true, maxLength: 128 }),
      field("clientSecret", "secret", { required: true, maxLength: 256 }),
      field("apiVersion", "text", { required: true, maxLength: 6 }),
      field("callbackUrl", "text", { readOnly: true }),
    ],
  },
  {
    key: "x",
    order: 30,
    accountTypes: ["oauth"],
    fields: [
      field("clientId", "text", { required: true, maxLength: 128 }),
      field("clientSecret", "secret", { required: true, maxLength: 256 }),
      field("callbackUrl", "text", { readOnly: true }),
    ],
  },
  {
    key: "tiktok",
    order: 40,
    accountTypes: ["oauth"],
    fields: [
      field("clientKey", "text", { required: true, maxLength: 128 }),
      field("clientSecret", "secret", { required: true, maxLength: 256 }),
      field("callbackUrl", "text", { readOnly: true }),
    ],
  },
  {
    key: "whatsapp",
    order: 50,
    accountTypes: ["manual"],
    fields: [
      field("baseUrl", "text", { required: true, maxLength: 2048 }),
      field("basicAuthUsername", "text", { required: true, maxLength: 128 }),
      field("basicAuthPassword", "secret", { required: true, maxLength: 128 }),
    ],
  },
]

export type ChannelMediaItem = { mimeType: string }

export const channelCapabilityCatalog: readonly ChannelCapabilityDefinition[] =
  [
    {
      key: "facebook_page",
      providerKey: "meta",
      order: 10,
      supportsPublishing: true,
      destinations: ["feed"],
      mediaRules: [
        {
          destination: "feed",
          minItems: 0,
          maxItems: 10,
          allows: "both",
          allowsMixed: false,
          maxVideos: 1,
        },
      ],
    },
    {
      key: "instagram_profile",
      providerKey: "meta",
      order: 20,
      supportsPublishing: true,
      destinations: ["feed"],
      mediaRules: [
        {
          destination: "feed",
          minItems: 1,
          maxItems: 1,
          allows: "both",
          allowsMixed: false,
          maxVideos: 1,
        },
      ],
    },
    {
      key: "linkedin_page",
      providerKey: "linkedin",
      order: 40,
      supportsPublishing: true,
      destinations: ["feed"],
      mediaRules: [
        {
          destination: "feed",
          minItems: 0,
          maxItems: 20,
          allows: "both",
          allowsMixed: false,
          maxVideos: 1,
        },
      ],
    },
    {
      key: "linkedin_profile",
      providerKey: "linkedin",
      order: 50,
      supportsPublishing: true,
      destinations: ["feed"],
      mediaRules: [
        {
          destination: "feed",
          minItems: 0,
          maxItems: 20,
          allows: "both",
          allowsMixed: false,
          maxVideos: 1,
        },
      ],
    },
    {
      key: "x_profile",
      providerKey: "x",
      order: 60,
      supportsPublishing: true,
      destinations: ["feed"],
      mediaRules: [
        {
          destination: "feed",
          minItems: 0,
          maxItems: 4,
          allows: "both",
          allowsMixed: false,
          maxVideos: 1,
        },
      ],
    },
    {
      key: "tiktok_profile",
      providerKey: "tiktok",
      order: 70,
      supportsPublishing: true,
      destinations: ["video", "photo"],
      mediaRules: [
        {
          destination: "video",
          minItems: 1,
          maxItems: 1,
          allows: "video",
          allowsMixed: false,
          maxVideos: 1,
        },
        {
          destination: "photo",
          minItems: 1,
          maxItems: 35,
          allows: "image",
          allowsMixed: false,
          maxVideos: 0,
        },
      ],
    },
    {
      key: "whatsapp_status",
      providerKey: "whatsapp",
      order: 30,
      supportsPublishing: true,
      destinations: ["status"],
      mediaRules: [
        {
          destination: "status",
          minItems: 1,
          maxItems: 1,
          allows: "both",
          allowsMixed: false,
          maxVideos: 1,
        },
      ],
    },
  ]

export function channelProvider(
  key: PortalChannelProviderKey
): ChannelProviderDefinition | undefined {
  return channelProviderCatalog.find((provider) => provider.key === key)
}

export function channelCapability(
  key: PortalChannelCapabilityKey
): ChannelCapabilityDefinition | undefined {
  return channelCapabilityCatalog.find((capability) => capability.key === key)
}

export const channelMediaErrorSchema = z.enum([
  "capabilityUnsupported",
  "destinationUnsupported",
  "tooFewItems",
  "tooManyItems",
  "imagesNotAllowed",
  "videosNotAllowed",
  "mixedNotAllowed",
  "tooManyVideos",
])

export type ChannelMediaError = z.infer<typeof channelMediaErrorSchema>

export function validateChannelMedia(
  capabilityKey: PortalChannelCapabilityKey,
  destination: string,
  items: readonly ChannelMediaItem[]
): ChannelMediaError | null {
  const capability = channelCapability(capabilityKey)
  if (!capability) return "capabilityUnsupported"

  const rule = capability.mediaRules.find(
    (candidate) => candidate.destination === destination
  )
  if (!rule) return "destinationUnsupported"

  const videos = items.filter((item) =>
    item.mimeType.startsWith("video/")
  ).length
  const images = items.filter((item) =>
    item.mimeType.startsWith("image/")
  ).length

  if (items.length < rule.minItems) return "tooFewItems"
  if (items.length > rule.maxItems) return "tooManyItems"
  if (rule.allows === "video" && images > 0) return "imagesNotAllowed"
  if (rule.allows === "image" && videos > 0) return "videosNotAllowed"
  if (!rule.allowsMixed && videos > 0 && images > 0) return "mixedNotAllowed"
  if (rule.maxVideos !== null && videos > rule.maxVideos) return "tooManyVideos"

  return null
}
