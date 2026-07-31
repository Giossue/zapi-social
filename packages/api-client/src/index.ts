import type {
  AuthSession,
  ChannelAccount,
  ChannelList,
  ChannelListQuery,
  CreateChannelInput,
  LoginInput,
  PortalDashboard,
  ProviderIntegration,
  RegisterInput,
  UpdateChannelInput,
  UpdateProviderIntegrationInput,
} from "@workspace/contracts"

const apiBaseUrl =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001")
    : "/api"

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly requestId?: string
  ) {
    super(code)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: init.body
      ? { "content-type": "application/json", ...init.headers }
      : init.headers,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string
      requestId?: string
    } | null

    throw new ApiError(
      body?.code ?? "REQUEST_FAILED",
      response.status,
      body?.requestId
    )
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function channelQueryString(query: ChannelListQuery = {}) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.status) params.set("status", query.status)
  if (query.provider) params.set("provider", query.provider)
  if (query.sort) params.set("sort", query.sort)
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const authApi = {
  register: (input: RegisterInput) =>
    request<AuthSession>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: LoginInput) =>
    request<AuthSession>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logout: () => request<void>("/v1/auth/logout", { method: "POST" }),
  session: () => request<AuthSession>("/v1/auth/session", { method: "GET" }),
}

export const portalApi = {
  dashboard: () =>
    request<PortalDashboard>("/v1/portal/dashboard", { method: "GET" }),
}

export const channelsApi = {
  list: (query?: ChannelListQuery) =>
    request<ChannelList>(`/v1/portal/channels${channelQueryString(query)}`, {
      method: "GET",
    }),
  create: (input: CreateChannelInput) =>
    request<ChannelAccount>("/v1/portal/channels", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdateChannelInput) =>
    request<ChannelAccount>(`/v1/portal/channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  pause: (id: string) =>
    request<ChannelAccount>(`/v1/portal/channels/${id}/pause`, {
      method: "POST",
    }),
  resume: (id: string) =>
    request<ChannelAccount>(`/v1/portal/channels/${id}/resume`, {
      method: "POST",
    }),
  remove: (id: string) =>
    request<void>(`/v1/portal/channels/${id}`, { method: "DELETE" }),
}

export const integrationsApi = {
  list: () =>
    request<ProviderIntegration[]>("/v1/admin/integrations", { method: "GET" }),
  update: (
    providerKey: ProviderIntegration["providerKey"],
    input: UpdateProviderIntegrationInput
  ) =>
    request<ProviderIntegration>(`/v1/admin/integrations/${providerKey}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
}
