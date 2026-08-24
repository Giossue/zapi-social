import type {
  ChannelProviderIssue,
  PortalChannelProviderKey,
} from '@workspace/contracts';

/**
 * Comprueba contra el proveedor que las credenciales sirven. Devuelve `null`
 * si son válidas, o la clave del problema para que la interfaz lo traduzca.
 *
 * Es obligatorio para que una integración llegue a `ready`: dar por buenas unas
 * credenciales sin probarlas abriría el canal en el Portal y el fallo saldría
 * al publicar, que es el peor momento.
 */
export interface ChannelProviderVerifier {
  readonly providerKey: PortalChannelProviderKey;
  verify(values: Record<string, string>): Promise<ChannelProviderIssue | null>;
}

export const CHANNEL_PROVIDER_VERIFIERS = Symbol('CHANNEL_PROVIDER_VERIFIERS');
