import { z } from "zod"

import {
  channelProvider,
  channelProviderDefinitionSchema,
} from "./channel-catalog.js"
import {
  portalChannelCapabilityKeySchema,
  portalChannelProviderKeySchema,
  type PortalChannelProviderKey,
} from "./channels-v2.js"

/**
 * Pantalla genérica de integración de canal.
 *
 * Hasta ahora cada proveedor tenía su schema, sus tres métodos en la API y su
 * tarjeta en la web. Con siete redes eso significa escribir la misma pantalla
 * siete veces. Aquí el formulario sale del catálogo: la API valida contra los
 * campos declarados y la interfaz los pinta sin saber de qué red se trata.
 */

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
  /** Claves que la interfaz traduce; nunca prosa. */
  issues: z.array(z.string()),
  /**
   * Valores guardados de los campos no secretos. Un campo `secret` nunca
   * vuelve: solo se dice si está puesto, en `secretsConfigured`.
   */
  values: z.record(z.string(), z.string()),
  secretsConfigured: z.array(z.string()),
  capabilities: z.array(channelProviderCapabilityStateSchema),
  lastTestedAt: z.string().datetime().nullable(),
  /**
   * Un proveedor puede traer pantalla propia cuando necesita más que un
   * formulario —Meta edita permisos por capability, WhatsApp prueba contra un
   * conector—. La interfaz la respeta y no pinta la genérica.
   */
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
  /** Clave de error si la prueba falló; la interfaz la traduce. */
  issue: z.string().nullable(),
})

/**
 * Construye el validador de los valores de un proveedor a partir de sus campos
 * declarados. La API no repite las reglas: las deriva del mismo catálogo que
 * la interfaz usa para pintar el formulario.
 */
export function channelProviderValuesSchema(
  providerKey: PortalChannelProviderKey
) {
  const definition = channelProvider(providerKey)
  if (!definition) return z.record(z.string(), z.string())

  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of definition.fields) {
    // Un campo calculado por el servidor no se acepta desde fuera.
    if (field.readOnly) continue

    let value = z.string().trim()
    if (field.maxLength !== null) value = value.max(field.maxLength)
    shape[field.key] = field.required
      ? value.min(1)
      : value.optional().default("")
  }

  return z.object(shape).strict()
}

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
