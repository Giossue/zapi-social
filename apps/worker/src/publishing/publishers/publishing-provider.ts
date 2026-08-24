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
    throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
  }
}
