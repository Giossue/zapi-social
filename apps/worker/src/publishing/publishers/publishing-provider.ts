/**
 * Piezas compartidas por todos los publicadores: el error de entrega, la
 * lectura defensiva de la respuesta del proveedor y el criterio de qué fallo se
 * reintenta.
 *
 * Vivían dentro del procesador cuando solo había tres redes escritas a mano.
 * Con un publicador por red tienen que ser compartidas, porque la decisión de
 * «esto se reintenta» no puede depender de quién la escriba.
 */

export const providerOutcomeUnknownCode = 'PUBLISHING_PROVIDER_OUTCOME_UNKNOWN';

export type ProviderResult = {
  providerRequestId: string | null;
  response: Record<string, unknown>;
};

export class PublishingDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly permanent = false,
  ) {
    super(code);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function responseJson(response: Response) {
  const value: unknown = await response.json().catch(() => ({}));
  return isRecord(value) ? value : {};
}

export function firstString(
  value: Record<string, unknown>,
  keys: string[],
  maximumLength = 2048,
) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate) {
      return candidate.slice(0, maximumLength);
    }
  }
  return null;
}

/**
 * Solo se persisten campos de la lista blanca: la respuesta del proveedor
 * puede traer tokens, y esta fila se guarda y se enseña.
 */
export function sanitizeProviderResponse(
  value: Record<string, unknown>,
  providerRequestId: string | null,
) {
  const response: Record<string, string | number | boolean> = {};
  if (providerRequestId) {
    response.providerRequestId = providerRequestId.slice(0, 2048);
  }
  const providerPostId = firstString(value, ['post_id']);
  if (providerPostId) response.providerPostId = providerPostId;
  const providerMessageId = firstString(value, ['message_id', 'messageId']);
  if (providerMessageId) response.providerMessageId = providerMessageId;
  const status = firstString(value, ['status', 'status_code'], 256);
  if (status) response.status = status;
  const code = value.code;
  if (typeof code === 'string') response.providerCode = code.slice(0, 256);
  else if (typeof code === 'number' || typeof code === 'boolean')
    response.providerCode = code;
  return response;
}

export function isProviderSuccess(value: Record<string, unknown>) {
  const code = value.code;
  return (
    code === undefined ||
    (typeof code === 'string' && code.toUpperCase() === 'SUCCESS')
  );
}

/**
 * Un 5xx o un tiempo agotado dejan el resultado en duda, así que se reintenta.
 * Un 4xx —salvo 429— es del contenido y no mejora repitiéndolo.
 */
export function providerHttpError(status: number, code: string) {
  if (status === 408 || status >= 500) {
    return new PublishingDeliveryError(providerOutcomeUnknownCode, true);
  }
  const permanent =
    status >= 400 && status < 500 && status !== 408 && status !== 429;
  return new PublishingDeliveryError(code, permanent);
}

export async function providerPost(input: string, init: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    // Una petición que ni sale deja el resultado en duda.
    throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
  }
}
