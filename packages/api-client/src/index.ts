import type {
  AdminPlan,
  AdminPlansList,
  AuthSession,
  CreateAdminPlanInput,
  LoginInput,
  MetaIntegration,
  TestWhatsAppStatusIntegrationInput,
  TestWhatsAppStatusIntegrationResponse,
  UpdateWhatsAppStatusIntegrationInput,
  WhatsAppStatusIntegration,
  PortalChannelAccount,
  PortalChannelCandidate,
  PortalChannelConnection,
  PortalChannelsQuery,
  PortalChannelsResponse,
  PortalDashboard,
  PortalProfile,
  RegisterInput,
  UpdatePortalProfileInput,
  ChangePortalPasswordInput,
  EmailSmtpIntegration,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  TestEmailSmtpIntegrationResponse,
  RequestPortalChannelProfileSyncResponse,
  StartPortalChannelConnectionInput,
  StartWhatsAppStatusConnectionInput,
  WhatsAppStatusQrResponse,
  TestMetaIntegrationInput,
  TestMetaIntegrationResponse,
  UpdateAdminPlanInput,
  UpdateMetaIntegrationInput,
  UpdatePortalChannelInput,
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

type EmailSmtpConfigurationDraft = {
  host: string
  port: number
  secure: boolean
  username: string
  password?: string
  fromEmail: string
  fromName: string
}

type UpdateEmailSmtpIntegrationInput = {
  enabled: boolean
  configuration?: EmailSmtpConfigurationDraft
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

    const error = new ApiError(
      body?.code ?? "REQUEST_FAILED",
      response.status,
      body?.requestId
    )
    if (
      typeof window !== "undefined" &&
      error.status === 401 &&
      path !== "/v1/auth/login" &&
      path !== "/v1/auth/register" &&
      !path.startsWith("/v1/auth/password-reset/")
    ) {
      window.dispatchEvent(new Event("zapi:session-invalid"))
    }
    throw error
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function portalChannelsQueryString(query: Partial<PortalChannelsQuery> = {}) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.provider) params.set("provider", query.provider)
  if (query.capability) params.set("capability", query.capability)
  if (query.status) params.set("status", query.status)
  if (query.sort) params.set("sort", query.sort)
  if (query.limit) params.set("limit", String(query.limit))
  if (query.cursor) params.set("cursor", query.cursor)
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

function adminPlansQueryString(query?: {
  q?: string
  status?: "active" | "inactive"
  billingType?: "monthly" | "yearly"
  featured?: boolean
}) {
  const params = new URLSearchParams()
  if (query?.q) params.set("q", query.q)
  if (query?.status) params.set("status", query.status)
  if (query?.billingType) params.set("billingType", query.billingType)
  if (query?.featured !== undefined)
    params.set("featured", String(query.featured))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

type PortalChannelConnectionStartResponse = {
  connection: PortalChannelConnection
  authorizationUrl: string
}

type PortalChannelCandidatesResponse = {
  connectionId: PortalChannelConnection["id"]
  state: "picker_ready"
  candidates: PortalChannelCandidate[]
}

type PortalChannelConnectionStatusResponse = {
  connection: PortalChannelConnection
  account: PortalChannelAccount | null
  publicError: { code: string; requestId: string } | null
}

type SelectPortalChannelCandidateInput = {
  candidateId: PortalChannelCandidate["id"]
}

type SelectPortalChannelCandidateResponse = {
  account: PortalChannelAccount
  connection: PortalChannelConnection & { state: "connected" }
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
  requestPasswordReset: (input: PasswordResetRequestInput) =>
    request<{ accepted: true }>("/v1/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  confirmPasswordReset: (input: PasswordResetConfirmInput) =>
    request<void>("/v1/auth/password-reset/confirm", {
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

export const profileApi = {
  get: () => request<PortalProfile>("/v1/portal/profile", { method: "GET" }),
  update: (input: UpdatePortalProfileInput) =>
    request<PortalProfile>("/v1/portal/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  changePassword: (input: ChangePortalPasswordInput) =>
    request<void>("/v1/portal/profile/password", {
      method: "POST",
      body: JSON.stringify(input),
    }),
}

export const channelsApi = {
  list: (query?: Partial<PortalChannelsQuery>) =>
    request<PortalChannelsResponse>(
      `/v1/portal/channels${portalChannelsQueryString(query)}`,
      { method: "GET" }
    ),
  update: (id: string, input: UpdatePortalChannelInput) =>
    request<PortalChannelAccount>(`/v1/portal/channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/v1/portal/channels/${id}`, { method: "DELETE" }),
  reconnect: (id: string) =>
    request<PortalChannelConnectionStartResponse>(
      `/v1/portal/channels/${id}/reconnect`,
      { method: "POST" }
    ),
  requestProfileSync: (id: string) =>
    request<RequestPortalChannelProfileSyncResponse>(
      `/v1/portal/channels/${id}/profile-sync`,
      { method: "POST" }
    ),
}

export const channelConnectionsApi = {
  startMeta: (input: StartPortalChannelConnectionInput) =>
    request<PortalChannelConnectionStartResponse>(
      "/v1/portal/channel-connections/oauth/start",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  startWhatsAppStatus: (input: StartWhatsAppStatusConnectionInput = {}) =>
    request<WhatsAppStatusQrResponse>(
      "/v1/portal/channel-connections/whatsapp-status/start",
      { method: "POST", body: JSON.stringify(input) }
    ),
  refreshWhatsAppStatusQr: (connectionId: string) =>
    request<WhatsAppStatusQrResponse>(
      `/v1/portal/channel-connections/${connectionId}/refresh-qr`,
      { method: "POST" }
    ),
  status: (connectionId: string) =>
    request<PortalChannelConnectionStatusResponse>(
      `/v1/portal/channel-connections/${connectionId}/status`,
      { method: "GET" }
    ),
  candidates: (connectionId: string) =>
    request<PortalChannelCandidatesResponse>(
      `/v1/portal/channel-connections/${connectionId}/candidates`,
      { method: "GET" }
    ),
  select: (connectionId: string, input: SelectPortalChannelCandidateInput) =>
    request<SelectPortalChannelCandidateResponse>(
      `/v1/portal/channel-connections/${connectionId}/select`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  cancel: (connectionId: string) =>
    request<PortalChannelConnection>(
      `/v1/portal/channel-connections/${connectionId}/cancel`,
      { method: "POST" }
    ),
}

export const integrationsApi = {
  getMeta: () =>
    request<MetaIntegration>("/v1/admin/integrations/meta", { method: "GET" }),
  testMeta: (input: TestMetaIntegrationInput) =>
    request<TestMetaIntegrationResponse>("/v1/admin/integrations/meta/test", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  saveMeta: (input: UpdateMetaIntegrationInput) =>
    request<MetaIntegration>("/v1/admin/integrations/meta", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  getWhatsAppStatus: () =>
    request<WhatsAppStatusIntegration>(
      "/v1/admin/integrations/whatsapp-status",
      { method: "GET" }
    ),
  testWhatsAppStatus: (input: TestWhatsAppStatusIntegrationInput) =>
    request<TestWhatsAppStatusIntegrationResponse>(
      "/v1/admin/integrations/whatsapp-status/test",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  saveWhatsAppStatus: (input: UpdateWhatsAppStatusIntegrationInput) =>
    request<WhatsAppStatusIntegration>(
      "/v1/admin/integrations/whatsapp-status",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  getEmailSmtp: () =>
    request<EmailSmtpIntegration>("/v1/admin/integrations/email-smtp", {
      method: "GET",
    }),
  testEmailSmtp: (input: { configuration: EmailSmtpConfigurationDraft }) =>
    request<TestEmailSmtpIntegrationResponse>(
      "/v1/admin/integrations/email-smtp/test",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  saveEmailSmtp: (input: UpdateEmailSmtpIntegrationInput) =>
    request<EmailSmtpIntegration>("/v1/admin/integrations/email-smtp", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
}

export const plansApi = {
  list: (query?: {
    q?: string
    status?: "active" | "inactive"
    billingType?: "monthly" | "yearly"
    featured?: boolean
  }) =>
    request<AdminPlansList>(`/v1/admin/plans${adminPlansQueryString(query)}`, {
      method: "GET",
    }),
  create: (input: CreateAdminPlanInput) =>
    request<AdminPlan>("/v1/admin/plans", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdateAdminPlanInput) =>
    request<AdminPlan>(`/v1/admin/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/v1/admin/plans/${id}`, { method: "DELETE" }),
}
