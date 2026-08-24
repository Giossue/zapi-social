import { z } from "zod"

import {
  portalChannelCapabilityKeySchema,
  portalChannelProviderKeySchema,
  type PortalChannelCapabilityKey,
  type PortalChannelProviderKey,
} from "./channels-v2.js"

/**
 * Catálogo declarativo de proveedores y capabilities.
 *
 * Hasta ahora cada integración se escribía a mano —un schema por proveedor, un
 * `if` por red en el worker—, y eso no escala a las siete redes que se quieren
 * soportar. Aquí la red se describe como datos: qué credenciales pide, qué
 * destinos admite y qué media acepta cada destino. La API y la interfaz leen el
 * mismo catálogo, así que no pueden discrepar.
 *
 * El catálogo no lleva texto. Cada entrada aporta claves y la interfaz las
 * traduce, como el resto de V2.
 */

export const channelFieldTypeSchema = z.enum([
  "text",
  "secret",
  "textarea",
  "toggle",
])

export const channelAccountTypeSchema = z.enum(["oauth", "manual"])

/**
 * Conjunto cerrado: cada campo necesita su rótulo traducido, y un `string`
 * libre dejaría pasar uno sin texto. Añadir un campo nuevo obliga a añadirlo
 * aquí y en los catálogos de idioma, que es justo lo que se quiere.
 */
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
  /** Solo informativo: lo calcula el servidor y no se envía. */
  readOnly: z.boolean(),
  maxLength: z.number().int().positive().nullable(),
})

export const channelProviderDefinitionSchema = z.object({
  key: portalChannelProviderKeySchema,
  order: z.number().int().nonnegative(),
  accountTypes: z.array(channelAccountTypeSchema).min(1),
  fields: z.array(channelProviderFieldSchema),
})

/**
 * Reglas de media de un destino, tomadas de lo que acepta la API de la red.
 * Son declarativas para que la interfaz avise antes de guardar y la API lo
 * vuelva a comprobar antes de encolar: esconder un botón no valida nada.
 */
export const channelMediaRuleSchema = z.object({
  destination: z.string(),
  minItems: z.number().int().nonnegative(),
  maxItems: z.number().int().nonnegative(),
  allows: z.enum(["image", "video", "both"]),
  /** Si es `false`, no se pueden mezclar imágenes y vídeos. */
  allowsMixed: z.boolean(),
  maxVideos: z.number().int().nonnegative().nullable(),
})

export const channelCapabilityDefinitionSchema = z.object({
  key: portalChannelCapabilityKeySchema,
  providerKey: portalChannelProviderKeySchema,
  order: z.number().int().nonnegative(),
  supportsPublishing: z.boolean(),
  /** El primero es el destino por defecto. */
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
      // La versión de la Posts API va en cabecera y caduca al año, así que es
      // configurable: si quedara fija, el conector dejaría de publicar solo.
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

/** Un elemento de la publicación, reducido a lo que deciden las reglas. */
export type ChannelMediaItem = { mimeType: string }

/**
 * De dónde salen los límites de media, para que no parezcan arbitrarios cuando
 * alguien los cambie:
 *
 * - **Facebook e Instagram**: Graph API. El Feed rechaza mezclar foto y vídeo y
 *   admite un solo vídeo; Instagram no publica sin media.
 * - **LinkedIn**: Posts API. `content.media` referencia un único `urn`; varias
 *   imágenes exigen la MultiImage API, que es solo de imágenes.
 * - **X**: hasta cuatro imágenes, o un solo vídeo o GIF, nunca mezclados.
 * - **TikTok**: `/v2/post/publish/video/init/` para vídeo —uno— y
 *   `/v2/post/publish/content/init/` para fotos.
 *
 * Los detalles y el contraste con lo que hace ZapiSocial están en
 * `docs/planes/canales-publicacion-v2.md`.
 */
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
          // El Feed rechaza una publicación que mezcle foto y vídeo, y solo
          // admite un vídeo por publicación.
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
          // Instagram no publica sin media.
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
          // La Posts API referencia un único `urn` de media por publicación,
          // salvo el caso MultiImage, que es solo de imágenes.
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
          // X admite hasta cuatro imágenes, o un solo vídeo o GIF.
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

/** Claves de error que devuelve la validación de media. La interfaz las traduce. */
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

/**
 * Comprueba la media de una publicación contra las reglas de su destino.
 * Devuelve la clave del problema, o `null` si es válida.
 */
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
