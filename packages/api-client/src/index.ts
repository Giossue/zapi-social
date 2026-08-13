import type {
  AdminPlan,
  AdminPlansList,
  AdminTurnstileConfiguration,
  AuthSession,
  ActiveWorkspace,
  ActivateAuthWorkspaceInput,
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
  PublicTurnstileConfiguration,
  TestEmailSmtpIntegrationResponse,
  RequestPortalChannelProfileSyncResponse,
  StartPortalChannelConnectionInput,
  StartWhatsAppStatusConnectionInput,
  WhatsAppStatusQrResponse,
  TestMetaIntegrationInput,
  TestMetaIntegrationResponse,
  UpdateAdminPlanInput,
  UpdateAdminTurnstileConfigurationInput,
  UpdateMetaIntegrationInput,
  UpdatePortalChannelInput,
  CreatePortalCaptionInput,
  PortalCaptionsQuery,
  PortalCaptionsResponse,
  PortalCaption,
  UpdatePortalCaptionInput,
  PortalFilesResponse,
  PortalFilesQuery,
  CreatePortalFileFolderInput,
  UpdatePortalFileFolderInput,
  UpdatePortalFileAssetInput,
  StartPortalFileUploadInput,
  PortalPublishingResponse,
  PortalPublishingQuery,
  CreatePortalPublishingPostsInput,
  UpdatePortalPublishingPostInput,
  PortalPublishingPost,
  AdminAuditEventsResponse,
  CreatePortalRssScheduleInput,
  PortalRssSchedule,
  PortalRssFeedValidation,
  PortalRssScheduleHistoriesResponse,
  PortalRssScheduleHistoryQuery,
  PortalRssScheduleRunsQuery,
  PortalRssScheduleRunsResponse,
  PortalRssScheduleRun,
  PortalRssSchedulesQuery,
  PortalRssSchedulesResponse,
  UpdatePortalRssScheduleInput,
  ValidatePortalRssFeedInput,
  RunPortalRssScheduleInput,
  CreatePortalSupportTicketCommentInput,
  CreatePortalSupportTicketInput,
  CreatePortalWatermarkInput,
  PortalSupportCategory,
  PortalSupportTicket,
  PortalSupportTicketDetail,
  PortalSupportTicketsQuery,
  PortalSupportTicketsResponse,
  PortalWatermark,
  PortalWatermarksResponse,
  UpdatePortalWatermarkInput,
  AcceptPortalTeamInvitationInput,
  PreviewPortalTeamInvitationInput,
  PublicPortalTeamInvitationPreview,
  CreatePortalAccountGroupInput,
  CreatePortalAutomationApiKeyInput,
  CreatePortalAutomationWebhookInput,
  CreatePortalBulkPostBatchInput,
  CreatePortalTeamInvitationInput,
  CreatedPortalAutomationApiKey,
  PortalAccountGroup,
  PortalAutomationResponse,
  PortalBulkPostBatch,
  PortalBulkPostBatchDetail,
  PortalBulkPostBatchesQuery,
  PortalBulkPostBatchesResponse,
  PortalBulkPostRowsQuery,
  PortalGroupsQuery,
  PortalGroupsResponse,
  PortalTeamInvitation,
  PortalTeamActivityQuery,
  PortalTeamActivityResponse,
  PortalTeamsResponse,
  ReplacePortalTeamAccountGrantsInput,
  UpdatePortalAccountGroupInput,
  UpdatePortalAutomationWebhookInput,
  UpdatedPortalAutomationWebhook,
  UpdatePortalTeamMemberAccessInput,
  UpdatePortalTeamMemberRoleInput,
  TransferPortalTeamOwnershipInput,
  CreatePortalAiPublishingScheduleInput,
  CreatePortalAiRequestInput,
  AdminAiConfiguration,
  AdminAiModel,
  AdminAiProviderKey,
  AdminAiRoute,
  AdminAiUsage,
  ArchivePortalAiRequestInput,
  CreateAdminAiModelInput,
  PortalAiDashboard,
  PortalAiDraftResult,
  PortalAiPublishingSchedule,
  PortalAiRequest,
  PortalAiRequestsQuery,
  PortalAiRequestsResponse,
  PortalAiSettings,
  PortalCreditsResponse,
  UpdatePortalAiBudgetInput,
  RenamePortalAiRequestInput,
  RetryPortalAiRequestInput,
  TestAdminAiProviderInput,
  UpdateAdminAiModelInput,
  UpdateAdminAiProviderInput,
  UpdateAdminAiRouteInput,
  UpdatePortalAiPublishingScheduleInput,
  UpdatePortalAiSettingsInput,
  UsePortalAiRequestAsDraftInput,
  CaptureAffiliateReferralInput,
  CapturedAffiliateReferral,
  CreatePortalCommerceOrderInput,
  CreatePortalCommerceProductInput,
  CreatePortalCommerceReturnInput,
  ImportPortalOnlineMediaInput,
  ImportedPortalOnlineMedia,
  PortalAffiliateDashboard,
  PortalCommerceDashboard,
  PortalCommerceOrder,
  PortalCommerceProduct,
  PortalCommerceQuery,
  PortalCommerceReturn,
  PortalOnlineMediaSearchQuery,
  PortalOnlineMediaSearchResponse,
  RequestPortalAffiliateWithdrawalInput,
  UpdatePortalCommerceOrderInput,
  UpdatePortalCommerceProductInput,
  AdminOperationActionKey,
  AdminOperationModule,
  AdminOperationView,
  AdminOperationMutationResult,
  PolarIntegration,
  TestPolarIntegrationInput,
  TestPolarIntegrationResponse,
  UpdatePolarIntegrationInput,
} from "@workspace/contracts"

const apiBaseUrl =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001")
    : (process.env.NEXT_PUBLIC_API_ORIGIN ?? "/api")

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
  const sendsJson = init.method !== "GET" && init.method !== "HEAD"
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    body: sendsJson && init.body === undefined ? "{}" : init.body,
    credentials: "include",
    headers: sendsJson
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

function adminOperationsQueryString(query: {
  tab: string
  q?: string
  status?: string
  page?: number
  pageSize?: number
}) {
  const params = new URLSearchParams({ tab: query.tab })
  if (query.q) params.set("q", query.q)
  if (query.status && query.status !== "all") params.set("status", query.status)
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  return `?${params.toString()}`
}

function portalRssSchedulesQueryString(
  query: Partial<PortalRssSchedulesQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.status) params.set("status", query.status)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

function portalRssHistoryQueryString(
  query: Partial<PortalRssScheduleHistoryQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.result) params.set("result", query.result)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

function portalRssRunsQueryString(
  query: Partial<PortalRssScheduleRunsQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

function portalSupportTicketsQueryString(
  query: Partial<PortalSupportTicketsQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.status) params.set("status", query.status)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
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
  turnstileConfiguration: () =>
    request<PublicTurnstileConfiguration>("/v1/auth/turnstile", {
      method: "GET",
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
  activateWorkspace: (input: ActivateAuthWorkspaceInput) =>
    request<AuthSession>("/v1/auth/workspaces/activate", {
      method: "POST",
      body: JSON.stringify(input),
    }),
}

export const adminTurnstileApi = {
  get: () =>
    request<AdminTurnstileConfiguration>("/v1/admin/settings/turnstile", {
      method: "GET",
    }),
  update: (input: UpdateAdminTurnstileConfigurationInput) =>
    request<AdminTurnstileConfiguration>("/v1/admin/settings/turnstile", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
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

function portalCaptionsQueryString(query: Partial<PortalCaptionsQuery> = {}) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.sourceType) params.set("sourceType", query.sourceType)
  if (query.status) params.set("status", query.status)
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const captionsApi = {
  list: (query?: Partial<PortalCaptionsQuery>) =>
    request<PortalCaptionsResponse>(
      `/v1/portal/captions${portalCaptionsQueryString(query)}`,
      { method: "GET" }
    ),
  create: (input: CreatePortalCaptionInput) =>
    request<PortalCaption>("/v1/portal/captions", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdatePortalCaptionInput) =>
    request<PortalCaption>(`/v1/portal/captions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/v1/portal/captions/${id}`, { method: "DELETE" }),
}

function portalFilesQueryString(query: Partial<PortalFilesQuery> = {}) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.folderId) params.set("folderId", query.folderId)
  if (query.kind) params.set("kind", query.kind)
  if (query.starred !== undefined) params.set("starred", String(query.starred))
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const value = params.toString()
  return value ? `?${value}` : ""
}

export const filesApi = {
  list: (query?: Partial<PortalFilesQuery>) =>
    request<PortalFilesResponse>(
      `/v1/portal/files${portalFilesQueryString(query)}`,
      { method: "GET" }
    ),
  createFolder: (input: CreatePortalFileFolderInput) =>
    request<unknown>("/v1/portal/files/folders", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateFolder: (id: string, input: UpdatePortalFileFolderInput) =>
    request<unknown>(`/v1/portal/files/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  removeFolder: (id: string) =>
    request<void>(`/v1/portal/files/folders/${id}`, { method: "DELETE" }),
  update: (id: string, input: UpdatePortalFileAssetInput) =>
    request<unknown>(`/v1/portal/files/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/v1/portal/files/${id}`, { method: "DELETE" }),
  previewUrl: (id: string) => `${apiBaseUrl}/v1/portal/files/${id}/preview`,
  thumbnailUrl: (id: string) => `${apiBaseUrl}/v1/portal/files/${id}/thumbnail`,
  downloadUrl: (id: string) => `${apiBaseUrl}/v1/portal/files/${id}/download`,
  startUpload: (input: StartPortalFileUploadInput) =>
    request<{ id: string; uploadUrl: string }>("/v1/portal/files/uploads", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  upload: async (id: string, file: File) => {
    const response = await fetch(`${apiBaseUrl}/v1/portal/files/${id}/upload`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/octet-stream" },
      body: file,
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
  },
}

function portalPublishingQueryString(
  query: Partial<PortalPublishingQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  if (query.mediaLimit) params.set("mediaLimit", String(query.mediaLimit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const publishingApi = {
  list: (query?: Partial<PortalPublishingQuery>) =>
    request<PortalPublishingResponse>(
      `/v1/portal/publishing${portalPublishingQueryString(query)}`,
      { method: "GET" }
    ),
  create: (input: CreatePortalPublishingPostsInput) =>
    request<PortalPublishingPost[]>("/v1/portal/publishing", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdatePortalPublishingPostInput) =>
    request<PortalPublishingPost>(`/v1/portal/publishing/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/v1/portal/publishing/${id}`, { method: "DELETE" }),
  retry: (id: string) =>
    request<PortalPublishingPost>(`/v1/portal/publishing/${id}/retry`, {
      method: "POST",
    }),
}

export const rssSchedulesApi = {
  validateFeed: (input: ValidatePortalRssFeedInput) =>
    request<PortalRssFeedValidation>("/v1/portal/rss-schedules/validate-feed", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  list: (query?: Partial<PortalRssSchedulesQuery>) =>
    request<PortalRssSchedulesResponse>(
      `/v1/portal/rss-schedules${portalRssSchedulesQueryString(query)}`,
      { method: "GET" }
    ),
  get: (id: string) =>
    request<PortalRssSchedule>(`/v1/portal/rss-schedules/${id}`, {
      method: "GET",
    }),
  create: (input: CreatePortalRssScheduleInput) =>
    request<PortalRssSchedule>("/v1/portal/rss-schedules", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdatePortalRssScheduleInput) =>
    request<PortalRssSchedule>(`/v1/portal/rss-schedules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  toggle: (id: string) =>
    request<PortalRssSchedule>(`/v1/portal/rss-schedules/${id}/toggle`, {
      method: "POST",
    }),
  run: (
    id: string,
    input: RunPortalRssScheduleInput = { ignoreHistory: false }
  ) =>
    request<PortalRssScheduleRun>(`/v1/portal/rss-schedules/${id}/run`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/v1/portal/rss-schedules/${id}`, { method: "DELETE" }),
  history: (id: string, query?: Partial<PortalRssScheduleHistoryQuery>) =>
    request<PortalRssScheduleHistoriesResponse>(
      `/v1/portal/rss-schedules/${id}/history${portalRssHistoryQueryString(query)}`,
      { method: "GET" }
    ),
  runs: (id: string, query?: Partial<PortalRssScheduleRunsQuery>) =>
    request<PortalRssScheduleRunsResponse>(
      `/v1/portal/rss-schedules/${id}/runs${portalRssRunsQueryString(query)}`,
      { method: "GET" }
    ),
}

export const supportApi = {
  categories: () =>
    request<PortalSupportCategory[]>("/v1/portal/support/categories", {
      method: "GET",
    }),
  list: (query?: Partial<PortalSupportTicketsQuery>) =>
    request<PortalSupportTicketsResponse>(
      `/v1/portal/support${portalSupportTicketsQueryString(query)}`,
      { method: "GET" }
    ),
  get: (id: string) =>
    request<PortalSupportTicketDetail>(`/v1/portal/support/${id}`, {
      method: "GET",
    }),
  create: (input: CreatePortalSupportTicketInput) =>
    request<PortalSupportTicket>("/v1/portal/support", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  addComment: (id: string, input: CreatePortalSupportTicketCommentInput) =>
    request<PortalSupportTicketDetail>(`/v1/portal/support/${id}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  resolve: (id: string) =>
    request<PortalSupportTicket>(`/v1/portal/support/${id}/resolve`, {
      method: "POST",
    }),
}

export const watermarksApi = {
  list: () =>
    request<PortalWatermarksResponse>("/v1/portal/watermarks", {
      method: "GET",
    }),
  get: (id: string) =>
    request<PortalWatermark>(`/v1/portal/watermarks/${id}`, {
      method: "GET",
    }),
  create: (input: CreatePortalWatermarkInput) =>
    request<PortalWatermark>("/v1/portal/watermarks", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdatePortalWatermarkInput) =>
    request<PortalWatermark>(`/v1/portal/watermarks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/v1/portal/watermarks/${id}`, { method: "DELETE" }),
}

function portalGroupsQueryString(query: Partial<PortalGroupsQuery> = {}) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.status) params.set("status", query.status)
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const groupsApi = {
  list: (query?: Partial<PortalGroupsQuery>) =>
    request<PortalGroupsResponse>(
      `/v1/portal/groups${portalGroupsQueryString(query)}`,
      { method: "GET" }
    ),
  create: (input: CreatePortalAccountGroupInput) =>
    request<PortalAccountGroup>("/v1/portal/groups", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdatePortalAccountGroupInput) =>
    request<PortalAccountGroup>(`/v1/portal/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/v1/portal/groups/${id}`, { method: "DELETE" }),
}

function portalBulkPostsQueryString(
  query: Partial<PortalBulkPostBatchesQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

function portalBulkPostRowsQueryString(
  query: Partial<PortalBulkPostRowsQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const bulkPostsApi = {
  list: (query?: Partial<PortalBulkPostBatchesQuery>) =>
    request<PortalBulkPostBatchesResponse>(
      `/v1/portal/bulk-posts${portalBulkPostsQueryString(query)}`,
      { method: "GET" }
    ),
  get: (id: string, query?: Partial<PortalBulkPostRowsQuery>) =>
    request<PortalBulkPostBatchDetail>(
      `/v1/portal/bulk-posts/${id}${portalBulkPostRowsQueryString(query)}`,
      { method: "GET" }
    ),
  create: (input: CreatePortalBulkPostBatchInput) =>
    request<PortalBulkPostBatch>("/v1/portal/bulk-posts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancel: (id: string) =>
    request<void>(`/v1/portal/bulk-posts/${id}`, { method: "DELETE" }),
}

export const automationApi = {
  get: () =>
    request<PortalAutomationResponse>("/v1/portal/automation", {
      method: "GET",
    }),
  createApiKey: (input: CreatePortalAutomationApiKeyInput) =>
    request<CreatedPortalAutomationApiKey>("/v1/portal/automation/api-keys", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  revokeApiKey: (id: string) =>
    request<void>(`/v1/portal/automation/api-keys/${id}`, {
      method: "DELETE",
    }),
  createWebhook: (input: CreatePortalAutomationWebhookInput) =>
    request<UpdatedPortalAutomationWebhook>("/v1/portal/automation/webhooks", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateWebhook: (id: string, input: UpdatePortalAutomationWebhookInput) =>
    request<UpdatedPortalAutomationWebhook>(
      `/v1/portal/automation/webhooks/${id}`,
      { method: "PATCH", body: JSON.stringify(input) }
    ),
  removeWebhook: (id: string) =>
    request<void>(`/v1/portal/automation/webhooks/${id}`, {
      method: "DELETE",
    }),
}

function portalAiRequestsQueryString(
  query: Partial<PortalAiRequestsQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.kind) params.set("kind", query.kind)
  if (query.status) params.set("status", query.status)
  if (query.search) params.set("search", query.search)
  if (query.archived) params.set("archived", "true")
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const aiApi = {
  dashboard: () =>
    request<PortalAiDashboard>("/v1/portal/ai/dashboard", { method: "GET" }),
  listRequests: (query?: Partial<PortalAiRequestsQuery>) =>
    request<PortalAiRequestsResponse>(
      `/v1/portal/ai/requests${portalAiRequestsQueryString(query)}`,
      { method: "GET" }
    ),
  createRequest: (input: CreatePortalAiRequestInput) =>
    request<PortalAiRequest>("/v1/portal/ai/requests", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getRequest: (id: string) =>
    request<PortalAiRequest>(`/v1/portal/ai/requests/${id}`, {
      method: "GET",
    }),
  cancelRequest: (id: string) =>
    request<PortalAiRequest>(`/v1/portal/ai/requests/${id}/cancel`, {
      method: "POST",
    }),
  renameRequest: (id: string, input: RenamePortalAiRequestInput) =>
    request<PortalAiRequest>(`/v1/portal/ai/requests/${id}/title`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  retryRequest: (id: string, input: RetryPortalAiRequestInput) =>
    request<PortalAiRequest>(`/v1/portal/ai/requests/${id}/retry`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  archiveRequest: (id: string, input: ArchivePortalAiRequestInput) =>
    request<PortalAiRequest>(`/v1/portal/ai/requests/${id}/archive`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  useAsDraft: (id: string, input: UsePortalAiRequestAsDraftInput) =>
    request<PortalAiDraftResult>(`/v1/portal/ai/requests/${id}/use-as-draft`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getSettings: () =>
    request<PortalAiSettings>("/v1/portal/ai/settings", { method: "GET" }),
  updateSettings: (input: UpdatePortalAiSettingsInput) =>
    request<PortalAiSettings>("/v1/portal/ai/settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  getCredits: () =>
    request<PortalCreditsResponse>("/v1/portal/ai/credits", {
      method: "GET",
    }),
  updateBudget: (input: UpdatePortalAiBudgetInput) =>
    request<PortalCreditsResponse>("/v1/portal/ai/credits/budget", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  listPublishingSchedules: () =>
    request<PortalAiPublishingSchedule[]>(
      "/v1/portal/ai/publishing-schedules",
      { method: "GET" }
    ),
  createPublishingSchedule: (input: CreatePortalAiPublishingScheduleInput) =>
    request<PortalAiPublishingSchedule>("/v1/portal/ai/publishing-schedules", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePublishingSchedule: (
    id: string,
    input: UpdatePortalAiPublishingScheduleInput
  ) =>
    request<PortalAiPublishingSchedule>(
      `/v1/portal/ai/publishing-schedules/${id}`,
      { method: "PATCH", body: JSON.stringify(input) }
    ),
  runPublishingSchedule: (id: string) =>
    request<PortalAiRequest>(`/v1/portal/ai/publishing-schedules/${id}/run`, {
      method: "POST",
    }),
  removePublishingSchedule: (id: string) =>
    request<void>(`/v1/portal/ai/publishing-schedules/${id}`, {
      method: "DELETE",
    }),
}

export const adminAiApi = {
  configuration: () =>
    request<AdminAiConfiguration>("/v1/admin/ai/configuration", {
      method: "GET",
    }),
  testProvider: (
    providerKey: AdminAiProviderKey,
    input: TestAdminAiProviderInput
  ) =>
    request<{
      providerKey: AdminAiProviderKey
      testedAt: string
      availableModelIds: string[]
    }>(`/v1/admin/ai/providers/${providerKey}/test`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProvider: (
    providerKey: AdminAiProviderKey,
    input: UpdateAdminAiProviderInput
  ) =>
    request<AdminAiConfiguration>(`/v1/admin/ai/providers/${providerKey}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  createModel: (input: CreateAdminAiModelInput) =>
    request<AdminAiModel>("/v1/admin/ai/models", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateModel: (id: string, input: UpdateAdminAiModelInput) =>
    request<AdminAiModel>(`/v1/admin/ai/models/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  updateRoute: (kind: string, input: UpdateAdminAiRouteInput) =>
    request<AdminAiRoute>(`/v1/admin/ai/routes/${kind}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  usage: (days = 30) =>
    request<AdminAiUsage>(`/v1/admin/ai/usage?days=${days}`, { method: "GET" }),
}

function portalCommerceQueryString(query: Partial<PortalCommerceQuery> = {}) {
  const params = new URLSearchParams()
  if (query.period) params.set("period", query.period)
  if (query.channel) params.set("channel", query.channel)
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const commerceApi = {
  dashboard: (query?: Partial<PortalCommerceQuery>) =>
    request<PortalCommerceDashboard>(
      `/v1/portal/commerce${portalCommerceQueryString(query)}`,
      { method: "GET" }
    ),
  products: () =>
    request<PortalCommerceProduct[]>("/v1/portal/commerce/products", {
      method: "GET",
    }),
  createProduct: (input: CreatePortalCommerceProductInput) =>
    request<PortalCommerceProduct>("/v1/portal/commerce/products", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProduct: (id: string, input: UpdatePortalCommerceProductInput) =>
    request<PortalCommerceProduct>(`/v1/portal/commerce/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  createOrder: (input: CreatePortalCommerceOrderInput) =>
    request<PortalCommerceOrder>("/v1/portal/commerce/orders", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateOrder: (id: string, input: UpdatePortalCommerceOrderInput) =>
    request<PortalCommerceOrder>(`/v1/portal/commerce/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  createReturn: (input: CreatePortalCommerceReturnInput) =>
    request<PortalCommerceReturn>("/v1/portal/commerce/returns", {
      method: "POST",
      body: JSON.stringify(input),
    }),
}

export const affiliateApi = {
  dashboard: () =>
    request<PortalAffiliateDashboard>("/v1/portal/affiliate", {
      method: "GET",
    }),
  activate: () =>
    request<NonNullable<PortalAffiliateDashboard["profile"]>>(
      "/v1/portal/affiliate/activate",
      { method: "POST" }
    ),
  requestWithdrawal: (input: RequestPortalAffiliateWithdrawalInput) =>
    request<PortalAffiliateDashboard["withdrawals"][number]>(
      "/v1/portal/affiliate/withdrawals",
      { method: "POST", body: JSON.stringify(input) }
    ),
  capture: (input: CaptureAffiliateReferralInput) =>
    request<CapturedAffiliateReferral>("/v1/public/affiliate/referrals", {
      method: "POST",
      body: JSON.stringify(input),
    }),
}

function portalOnlineMediaQueryString(
  query: Partial<PortalOnlineMediaSearchQuery>
) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.provider) params.set("provider", query.provider)
  if (query.type) params.set("type", query.type)
  if (query.page) params.set("page", String(query.page))
  if (query.perPage) params.set("perPage", String(query.perPage))
  return `?${params.toString()}`
}

export const onlineMediaApi = {
  search: (query: Partial<PortalOnlineMediaSearchQuery> & { q: string }) =>
    request<PortalOnlineMediaSearchResponse>(
      `/v1/portal/online-media/search${portalOnlineMediaQueryString(query)}`,
      { method: "GET" }
    ),
  import: (input: ImportPortalOnlineMediaInput) =>
    request<ImportedPortalOnlineMedia>("/v1/portal/online-media/imports", {
      method: "POST",
      body: JSON.stringify(input),
    }),
}

function portalTeamActivityQueryString(
  query: Partial<PortalTeamActivityQuery> = {}
) {
  const params = new URLSearchParams()
  if (query.category) params.set("category", query.category)
  if (query.q) params.set("q", query.q)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const teamsApi = {
  previewInvitation: (input: PreviewPortalTeamInvitationInput) =>
    request<PublicPortalTeamInvitationPreview>(
      "/v1/public/teams/invitations/preview",
      { method: "POST", body: JSON.stringify(input) }
    ),
  list: () =>
    request<PortalTeamsResponse>("/v1/portal/teams", { method: "GET" }),
  createInvitation: (input: CreatePortalTeamInvitationInput) =>
    request<PortalTeamInvitation>("/v1/portal/teams/invitations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  acceptInvitation: (input: AcceptPortalTeamInvitationInput) =>
    request<{ accepted: true; workspace: ActiveWorkspace }>(
      "/v1/portal/teams/invitations/accept",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  resendInvitation: (id: string) =>
    request<PortalTeamInvitation>(`/v1/portal/teams/invitations/${id}/resend`, {
      method: "POST",
    }),
  revokeInvitation: (id: string) =>
    request<void>(`/v1/portal/teams/invitations/${id}`, {
      method: "DELETE",
    }),
  updateMemberRole: (userId: string, input: UpdatePortalTeamMemberRoleInput) =>
    request<{ id: string; role: "owner" | "admin" | "member" }>(
      `/v1/portal/teams/members/${userId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  replaceAccountGrants: (
    userId: string,
    input: ReplacePortalTeamAccountGrantsInput
  ) =>
    request<{ accountIds: string[]; userId: string }>(
      `/v1/portal/teams/members/${userId}/account-grants`,
      { method: "PUT", body: JSON.stringify(input) }
    ),
  updateMemberAccess: (
    userId: string,
    input: UpdatePortalTeamMemberAccessInput
  ) =>
    request<{
      id: string
      role: "admin" | "member"
      accountIds: string[]
    }>(`/v1/portal/teams/members/${userId}/access`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  removeMember: (userId: string) =>
    request<void>(`/v1/portal/teams/members/${userId}`, {
      method: "DELETE",
    }),
  listActivity: (query?: Partial<PortalTeamActivityQuery>) =>
    request<PortalTeamActivityResponse>(
      `/v1/portal/teams/activity${portalTeamActivityQueryString(query)}`,
      { method: "GET" }
    ),
  leaveWorkspace: () =>
    request<{ left: true }>("/v1/portal/teams/leave", { method: "POST" }),
  transferOwnership: (input: TransferPortalTeamOwnershipInput) =>
    request<{ ownerUserId: string }>("/v1/portal/teams/ownership/transfer", {
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

export const adminOperationsApi = {
  view: (
    module: AdminOperationModule,
    query: {
      tab: string
      q?: string
      status?: string
      page?: number
      pageSize?: number
    }
  ) =>
    request<AdminOperationView>(
      `/v1/admin/operations/${module}${adminOperationsQueryString(query)}`,
      { method: "GET" }
    ),
  create: (module: AdminOperationModule, values: string[]) =>
    request<AdminOperationMutationResult>(`/v1/admin/operations/${module}`, {
      method: "POST",
      body: JSON.stringify({ values }),
    }),
  action: (
    module: AdminOperationModule,
    tab: string,
    id: string,
    action: AdminOperationActionKey,
    values?: string[]
  ) =>
    request<AdminOperationMutationResult>(
      `/v1/admin/operations/${module}/${tab}/${id}/actions`,
      {
        method: "POST",
        body: JSON.stringify({ action, values }),
      }
    ),
}

export const polarApi = {
  get: () =>
    request<PolarIntegration>("/v1/admin/integrations/polar", {
      method: "GET",
    }),
  save: (input: UpdatePolarIntegrationInput) =>
    request<PolarIntegration>("/v1/admin/integrations/polar", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  test: (input: TestPolarIntegrationInput) =>
    request<TestPolarIntegrationResponse>("/v1/admin/integrations/polar/test", {
      method: "POST",
      body: JSON.stringify(input),
    }),
}

export const auditApi = {
  list: () =>
    request<AdminAuditEventsResponse>("/v1/admin/audit-events", {
      method: "GET",
    }),
}
