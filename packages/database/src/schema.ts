import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    username: varchar("username", { length: 64 }),
    locale: varchar("locale", { length: 10 }),
    timezone: varchar("timezone", { length: 64 }),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_normalized_unique").on(sql`lower(${table.email})`),
    uniqueIndex("users_username_normalized_unique").on(
      sql`lower(${table.username})`
    ),
    index("users_status_index").on(table.status),
  ]
)

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull().default("personal"),
    enabledModules: jsonb("enabled_modules")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspaces_slug_unique").on(table.slug),
    uniqueIndex("workspaces_personal_owner_unique")
      .on(table.ownerUserId)
      .where(sql`${table.kind} = 'personal'`),
  ]
)

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 24 }).notNull().default("member"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    permissions: jsonb("permissions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_memberships_workspace_user_unique").on(
      table.workspaceId,
      table.userId
    ),
    index("workspace_memberships_user_status_index").on(
      table.userId,
      table.status
    ),
  ]
)

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    emailNormalized: varchar("email_normalized", { length: 320 }).notNull(),
    role: varchar("role", { length: 24 }).notNull().default("member"),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_invitations_token_hash_unique").on(table.tokenHash),
    index("workspace_invitations_workspace_status_expiry_index").on(
      table.workspaceId,
      table.status,
      table.expiresAt
    ),
    index("workspace_invitations_email_status_index").on(
      table.emailNormalized,
      table.status
    ),
    check(
      "workspace_invitations_role_check",
      sql`${table.role} in ('admin', 'member')`
    ),
    check(
      "workspace_invitations_status_check",
      sql`${table.status} in ('pending', 'accepted', 'revoked', 'expired')`
    ),
  ]
)

export const workspaceMembershipAuditEvents = pgTable(
  "workspace_membership_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subjectUserId: uuid("subject_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 96 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workspace_membership_audit_workspace_created_index").on(
      table.workspaceId,
      table.createdAt
    ),
    index("workspace_membership_audit_subject_created_index").on(
      table.subjectUserId,
      table.createdAt
    ),
  ]
)

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 255 }).notNull(),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: jsonb("scopes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_identities_provider_subject_unique").on(
      table.provider,
      table.providerSubject
    ),
    index("auth_identities_user_provider_index").on(
      table.userId,
      table.provider
    ),
  ]
)

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    activeWorkspaceId: uuid("active_workspace_id").references(
      () => workspaces.id,
      {
        onDelete: "set null",
      }
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    index("auth_sessions_user_expiry_index").on(table.userId, table.expiresAt),
  ]
)

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_expiry_index").on(
      table.userId,
      table.expiresAt
    ),
    index("password_reset_tokens_expiry_index").on(table.expiresAt),
  ]
)

export const auditReleases = pgTable(
  "audit_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    service: varchar("service", { length: 32 }).notNull(),
    commitSha: varchar("commit_sha", { length: 64 }),
    reference: varchar("reference", { length: 255 }),
    deployedAt: timestamp("deployed_at", { withTimezone: true }).notNull(),
    deployedByUserId: uuid("deployed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("audit_releases_service_commit_unique").on(
      table.service,
      table.commitSha
    ),
    index("audit_releases_service_deployed_index").on(
      table.service,
      table.deployedAt
    ),
  ]
)

export const apiAuditLogs = pgTable(
  "api_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id").references(() => auditReleases.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    event: varchar("event", { length: 160 }).notNull(),
    subjectType: varchar("subject_type", { length: 96 }),
    subjectId: uuid("subject_id"),
    severity: varchar("severity", { length: 16 })
      .$type<"success" | "warning" | "error">()
      .notNull()
      .default("success"),
    outcome: varchar("outcome", { length: 32 }).notNull().default("succeeded"),
    requestId: varchar("request_id", { length: 128 }),
    httpMethod: varchar("http_method", { length: 12 }),
    httpPath: varchar("http_path", { length: 512 }),
    httpStatus: integer("http_status"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    errorCode: varchar("error_code", { length: 96 }),
    summary: varchar("summary", { length: 500 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("api_audit_logs_workspace_created_index").on(
      table.workspaceId,
      table.createdAt
    ),
    index("api_audit_logs_actor_created_index").on(
      table.actorUserId,
      table.createdAt
    ),
    index("api_audit_logs_severity_created_index").on(
      table.severity,
      table.createdAt
    ),
    index("api_audit_logs_release_created_index").on(
      table.releaseId,
      table.createdAt
    ),
  ]
)

export const webAuditLogs = pgTable(
  "web_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id").references(() => auditReleases.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    event: varchar("event", { length: 160 }).notNull(),
    severity: varchar("severity", { length: 16 })
      .$type<"success" | "warning" | "error">()
      .notNull()
      .default("success"),
    outcome: varchar("outcome", { length: 32 }).notNull().default("succeeded"),
    pagePath: varchar("page_path", { length: 512 }),
    requestId: varchar("request_id", { length: 128 }),
    errorCode: varchar("error_code", { length: 96 }),
    summary: varchar("summary", { length: 500 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("web_audit_logs_workspace_created_index").on(
      table.workspaceId,
      table.createdAt
    ),
    index("web_audit_logs_actor_created_index").on(
      table.actorUserId,
      table.createdAt
    ),
    index("web_audit_logs_severity_created_index").on(
      table.severity,
      table.createdAt
    ),
    index("web_audit_logs_release_created_index").on(
      table.releaseId,
      table.createdAt
    ),
  ]
)

export const workerAuditLogs = pgTable(
  "worker_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id").references(() => auditReleases.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    event: varchar("event", { length: 160 }).notNull(),
    severity: varchar("severity", { length: 16 })
      .$type<"success" | "warning" | "error">()
      .notNull()
      .default("success"),
    outcome: varchar("outcome", { length: 32 }).notNull().default("succeeded"),
    queueName: varchar("queue_name", { length: 128 }),
    jobId: varchar("job_id", { length: 128 }),
    attempt: integer("attempt"),
    errorCode: varchar("error_code", { length: 96 }),
    summary: varchar("summary", { length: 500 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("worker_audit_logs_workspace_created_index").on(
      table.workspaceId,
      table.createdAt
    ),
    index("worker_audit_logs_actor_created_index").on(
      table.actorUserId,
      table.createdAt
    ),
    index("worker_audit_logs_severity_created_index").on(
      table.severity,
      table.createdAt
    ),
    index("worker_audit_logs_queue_job_index").on(table.queueName, table.jobId),
    index("worker_audit_logs_release_created_index").on(
      table.releaseId,
      table.createdAt
    ),
  ]
)

export const providerIntegrations = pgTable(
  "provider_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerKey: varchar("provider_key", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    readiness: varchar("readiness", { length: 24 })
      .notNull()
      .default("unconfigured"),
    capabilities: jsonb("capabilities")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    enabledCapabilityKeys: jsonb("enabled_capability_keys")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    configurationCiphertext: text("configuration_ciphertext"),
    configVersion: integer("config_version").notNull().default(1),
    readinessIssues: jsonb("readiness_issues")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    testedConfigFingerprint: varchar("tested_config_fingerprint", {
      length: 128,
    }),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastTestedByPlatformAdminId: uuid(
      "last_tested_by_platform_admin_id"
    ).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("provider_integrations_provider_key_unique").on(
      table.providerKey
    ),
    index("provider_integrations_enabled_readiness_index").on(
      table.enabled,
      table.readiness
    ),
  ]
)

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    providerKey: varchar("provider_key", { length: 64 }).notNull(),
    capabilityKey: varchar("capability_key", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    handle: varchar("handle", { length: 255 }),
    profileUrl: text("profile_url"),
    avatarUrl: text("avatar_url"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("social_accounts_workspace_provider_capability_external_unique")
      .on(
        table.workspaceId,
        table.providerKey,
        table.capabilityKey,
        table.externalId
      )
      .where(sql`${table.externalId} is not null`),
    index("social_accounts_workspace_status_index").on(
      table.workspaceId,
      table.status
    ),
    index("social_accounts_workspace_provider_index").on(
      table.workspaceId,
      table.providerKey
    ),
    uniqueIndex("social_accounts_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
  ]
)

export const socialAccountCredentials = pgTable(
  "social_account_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    accessTokenCiphertext: text("access_token_ciphertext"),
    refreshTokenCiphertext: text("refresh_token_ciphertext"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopes: jsonb("scopes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    encryptionKeyVersion: varchar("encryption_key_version", { length: 64 })
      .notNull()
      .default("v1"),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("social_account_credentials_social_account_unique").on(
      table.socialAccountId
    ),
    index("social_account_credentials_expiry_index").on(table.expiresAt),
  ]
)

export const socialAccountMemberships = pgTable(
  "social_account_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    workspaceMembershipId: uuid("workspace_membership_id")
      .notNull()
      .references(() => workspaceMemberships.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("social_account_memberships_account_membership_unique").on(
      table.socialAccountId,
      table.workspaceMembershipId
    ),
    index("social_account_memberships_membership_index").on(
      table.workspaceMembershipId
    ),
  ]
)

export const channelOauthStates = pgTable(
  "channel_oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stateHash: varchar("state_hash", { length: 128 }).notNull(),
    providerKey: varchar("provider_key", { length: 64 }).notNull(),
    capabilityKey: varchar("capability_key", { length: 64 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pkceVerifierCiphertext: text("pkce_verifier_ciphertext"),
    contextCiphertext: text("context_ciphertext"),
    reconnectAccountId: uuid("reconnect_account_id").references(
      () => socialAccounts.id,
      {
        onDelete: "set null",
      }
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("channel_oauth_states_state_hash_unique").on(table.stateHash),
    index("channel_oauth_states_expiry_index").on(table.expiresAt),
    index("channel_oauth_states_workspace_provider_index").on(
      table.workspaceId,
      table.providerKey
    ),
    index("channel_oauth_states_workspace_provider_capability_index").on(
      table.workspaceId,
      table.providerKey,
      table.capabilityKey
    ),
  ]
)

export const channelConnectionSessions = pgTable(
  "channel_connection_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    capabilityKey: varchar("capability_key", { length: 64 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reconnectAccountId: uuid("reconnect_account_id").references(
      () => socialAccounts.id,
      { onDelete: "set null" }
    ),
    socialAccountId: uuid("social_account_id").references(
      () => socialAccounts.id,
      {
        onDelete: "set null",
      }
    ),
    status: varchar("status", { length: 24 }).notNull().default("authorizing"),
    externalConnectionId: varchar("external_connection_id", { length: 255 }),
    contextCiphertext: text("context_ciphertext"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("channel_connection_sessions_workspace_status_index").on(
      table.workspaceId,
      table.status
    ),
    index("channel_connection_sessions_expiry_index").on(table.expiresAt),
    index("channel_connection_sessions_social_account_index").on(
      table.socialAccountId
    ),
  ]
)

export const channelConnectionCandidates = pgTable(
  "channel_connection_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelConnectionSessionId: uuid("channel_connection_session_id")
      .notNull()
      .references(() => channelConnectionSessions.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 512 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("channel_connection_candidates_session_external_unique").on(
      table.channelConnectionSessionId,
      table.externalId
    ),
    index("channel_connection_candidates_session_index").on(
      table.channelConnectionSessionId
    ),
  ]
)

export const channelSyncRuns = pgTable(
  "channel_sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    jobId: varchar("job_id", { length: 128 }),
    requestId: varchar("request_id", { length: 128 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 96 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("channel_sync_runs_account_created_index").on(
      table.socialAccountId,
      table.createdAt
    ),
    index("channel_sync_runs_status_created_index").on(
      table.status,
      table.createdAt
    ),
    index("channel_sync_runs_job_id_index").on(table.jobId),
  ]
)

export const captions = pgTable(
  "captions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    sourceType: varchar("source_type", { length: 16 })
      .$type<"manual" | "ai">()
      .notNull(),
    status: varchar("status", { length: 16 })
      .$type<"active" | "draft" | "archived">()
      .notNull(),
    content: varchar("content", { length: 10000 }).notNull(),
    notes: varchar("notes", { length: 2000 }),
    tags: jsonb("tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("captions_workspace_slug_unique").on(
      table.workspaceId,
      table.slug
    ),
    index("captions_workspace_updated_index").on(
      table.workspaceId,
      table.updatedAt
    ),
    index("captions_workspace_status_index").on(
      table.workspaceId,
      table.status
    ),
    index("captions_workspace_source_type_index").on(
      table.workspaceId,
      table.sourceType
    ),
  ]
)

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    featured: boolean("featured").notNull().default(false),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    billingType: varchar("billing_type", { length: 24 })
      .$type<"monthly" | "yearly">()
      .notNull()
      .default("monthly"),
    isFree: boolean("is_free").notNull().default(false),
    isDefaultSignup: boolean("is_default_signup").notNull().default(false),
    trialDays: integer("trial_days").notNull().default(0),
    position: integer("position").notNull().default(1),
    description: varchar("description", { length: 500 }).notNull().default(""),
    permissionIds: jsonb("permission_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("plans_name_unique").on(table.name),
    uniqueIndex("plans_slug_unique").on(table.slug),
    uniqueIndex("plans_default_signup_unique")
      .on(table.isDefaultSignup)
      .where(sql`${table.isDefaultSignup} = true`),
    index("plans_status_position_index").on(table.status, table.position),
  ]
)

export const fileFolders = pgTable(
  "file_folders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    parentFolderId: uuid("parent_folder_id").references(
      (): AnyPgColumn => fileFolders.id,
      { onDelete: "set null" }
    ),
    name: varchar("name", { length: 160 }).notNull(),
    status: varchar("status", { length: 16 })
      .$type<"active" | "trashed">()
      .notNull()
      .default("active"),
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("file_folders_workspace_parent_name_unique").on(
      table.workspaceId,
      sql`coalesce(${table.parentFolderId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`lower(${table.name})`
    ),
    index("file_folders_workspace_updated_index").on(
      table.workspaceId,
      table.updatedAt
    ),
    index("file_folders_workspace_parent_updated_index").on(
      table.workspaceId,
      table.parentFolderId,
      table.updatedAt
    ),
    index("file_folders_workspace_status_updated_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt
    ),
  ]
)

export const fileAssets = pgTable(
  "file_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => fileFolders.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 127 }).notNull(),
    extension: varchar("extension", { length: 16 }),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    thumbnailKey: varchar("thumbnail_key", { length: 512 }),
    thumbnailStatus: varchar("thumbnail_status", { length: 16 })
      .$type<"pending" | "ready" | "failed" | "not_applicable">()
      .notNull()
      .default("not_applicable"),
    thumbnailErrorCode: varchar("thumbnail_error_code", { length: 64 }),
    status: varchar("status", { length: 16 })
      .$type<"pending" | "ready" | "trashed">()
      .notNull()
      .default("pending"),
    starred: boolean("starred").notNull().default(false),
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("file_assets_storage_key_unique").on(table.storageKey),
    uniqueIndex("file_assets_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("file_assets_workspace_status_updated_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt
    ),
    index("file_assets_workspace_folder_index").on(
      table.workspaceId,
      table.folderId
    ),
    index("file_assets_workspace_thumbnail_index").on(
      table.workspaceId,
      table.thumbnailStatus
    ),
  ]
)

export const publishingPosts = pgTable(
  "publishing_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    socialAccountId: uuid("social_account_id").references(
      () => socialAccounts.id,
      { onDelete: "restrict" }
    ),
    status: varchar("status", { length: 16 })
      .$type<"draft" | "scheduled" | "processing" | "published" | "failed">()
      .notNull()
      .default("draft"),
    content: varchar("content", { length: 10000 }).notNull().default(""),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("publishing_posts_workspace_status_index").on(
      table.workspaceId,
      table.status
    ),
    index("publishing_posts_workspace_scheduled_index").on(
      table.workspaceId,
      table.scheduledAt
    ),
    index("publishing_posts_social_account_index").on(table.socialAccountId),
  ]
)

export const publishingPostMedia = pgTable(
  "publishing_post_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publishingPostId: uuid("publishing_post_id")
      .notNull()
      .references(() => publishingPosts.id, { onDelete: "cascade" }),
    fileAssetId: uuid("file_asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    uniqueIndex("publishing_post_media_post_file_unique").on(
      table.publishingPostId,
      table.fileAssetId
    ),
    index("publishing_post_media_file_index").on(table.fileAssetId),
  ]
)

export const publishingWatermarks = pgTable(
  "publishing_watermarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    socialAccountId: uuid("social_account_id"),
    imageFileAssetId: uuid("image_file_asset_id"),
    type: varchar("type", { length: 16 }).$type<"image" | "text">().notNull(),
    text: varchar("text", { length: 1000 }),
    position: varchar("position", { length: 16 })
      .$type<
        "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right"
      >()
      .notNull()
      .default("bottom-right"),
    opacityPercent: integer("opacity_percent").notNull().default(72),
    scalePercent: integer("scale_percent").notNull().default(24),
    textPreset: varchar("text_preset", { length: 24 })
      .$type<"glass" | "solid-dark" | "solid-light" | "minimal">()
      .notNull()
      .default("glass"),
    textColor: varchar("text_color", { length: 24 })
      .$type<
        | "brand-gradient"
        | "sunset-gradient"
        | "ocean-gradient"
        | "dark"
        | "white"
      >()
      .notNull()
      .default("brand-gradient"),
    textWeight: varchar("text_weight", { length: 16 })
      .$type<"medium" | "semibold" | "bold">()
      .notNull()
      .default("semibold"),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.socialAccountId, table.workspaceId],
      foreignColumns: [socialAccounts.id, socialAccounts.workspaceId],
      name: "publishing_watermarks_social_account_workspace_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.imageFileAssetId, table.workspaceId],
      foreignColumns: [fileAssets.id, fileAssets.workspaceId],
      name: "publishing_watermarks_image_file_workspace_fk",
    }).onDelete("restrict"),
    uniqueIndex("publishing_watermarks_workspace_target_unique").on(
      table.workspaceId,
      sql`coalesce(${table.socialAccountId}, '00000000-0000-0000-0000-000000000000'::uuid)`
    ),
    index("publishing_watermarks_workspace_updated_index").on(
      table.workspaceId,
      table.updatedAt
    ),
    index("publishing_watermarks_image_file_index").on(table.imageFileAssetId),
    check(
      "publishing_watermarks_type_check",
      sql`${table.type} in ('image', 'text')`
    ),
    check(
      "publishing_watermarks_content_check",
      sql`(${table.type} = 'image' and ${table.imageFileAssetId} is not null and ${table.text} is null) or (${table.type} = 'text' and ${table.imageFileAssetId} is null and ${table.text} is not null and length(trim(${table.text})) > 0)`
    ),
    check(
      "publishing_watermarks_position_check",
      sql`${table.position} in ('top-left', 'top-right', 'center', 'bottom-left', 'bottom-right')`
    ),
    check(
      "publishing_watermarks_opacity_check",
      sql`${table.opacityPercent} between 5 and 100`
    ),
    check(
      "publishing_watermarks_scale_check",
      sql`${table.scalePercent} between 5 and 100`
    ),
  ]
)

export const supportCategories = pgTable(
  "support_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: varchar("description", { length: 280 }).notNull().default(""),
    status: varchar("status", { length: 16 })
      .$type<"active" | "inactive">()
      .notNull()
      .default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("support_categories_slug_unique").on(table.slug),
    index("support_categories_status_name_index").on(table.status, table.name),
  ]
)

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => supportCategories.id, { onDelete: "restrict" }),
    subject: varchar("subject", { length: 250 }).notNull(),
    description: text("description").notNull(),
    status: varchar("status", { length: 16 })
      .$type<"open" | "resolved" | "closed">()
      .notNull()
      .default("open"),
    requesterLastReadAt: timestamp("requester_last_read_at", {
      withTimezone: true,
    }),
    supportLastReadAt: timestamp("support_last_read_at", {
      withTimezone: true,
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("support_tickets_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("support_tickets_workspace_requester_activity_index").on(
      table.workspaceId,
      table.requesterUserId,
      table.lastActivityAt
    ),
    index("support_tickets_workspace_status_activity_index").on(
      table.workspaceId,
      table.status,
      table.lastActivityAt
    ),
    check(
      "support_tickets_status_check",
      sql`${table.status} in ('open', 'resolved', 'closed')`
    ),
  ]
)

export const supportTicketComments = pgTable(
  "support_ticket_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supportTicketId: uuid("support_ticket_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    authorRole: varchar("author_role", { length: 16 })
      .$type<"requester" | "support">()
      .notNull()
      .default("requester"),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.supportTicketId, table.workspaceId],
      foreignColumns: [supportTickets.id, supportTickets.workspaceId],
      name: "support_ticket_comments_ticket_workspace_fk",
    }).onDelete("cascade"),
    index("support_ticket_comments_ticket_created_index").on(
      table.supportTicketId,
      table.createdAt
    ),
    check(
      "support_ticket_comments_author_role_check",
      sql`${table.authorRole} in ('requester', 'support')`
    ),
  ]
)

export const rssSchedules = pgTable(
  "rss_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    feedUrl: text("feed_url").notNull(),
    description: varchar("description", { length: 500 }).notNull().default(""),
    status: varchar("status", { length: 16 })
      .$type<"active" | "paused">()
      .notNull()
      .default("active"),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    timeSlots: jsonb("time_slots")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    weekdays: jsonb("weekdays")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    startDate: date("start_date"),
    endDate: date("end_date"),
    contentRules: jsonb("content_rules")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastQueuedAt: timestamp("last_queued_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("rss_schedules_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("rss_schedules_workspace_status_next_run_index").on(
      table.workspaceId,
      table.status,
      table.nextRunAt
    ),
    index("rss_schedules_workspace_updated_index").on(
      table.workspaceId,
      table.updatedAt
    ),
  ]
)

export const rssScheduleTargets = pgTable(
  "rss_schedule_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rssScheduleId: uuid("rss_schedule_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    socialAccountId: uuid("social_account_id").notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.rssScheduleId, table.workspaceId],
      foreignColumns: [rssSchedules.id, rssSchedules.workspaceId],
      name: "rss_schedule_targets_schedule_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.socialAccountId, table.workspaceId],
      foreignColumns: [socialAccounts.id, socialAccounts.workspaceId],
      name: "rss_schedule_targets_social_account_workspace_fk",
    }).onDelete("restrict"),
    uniqueIndex("rss_schedule_targets_schedule_account_unique").on(
      table.rssScheduleId,
      table.socialAccountId
    ),
    uniqueIndex("rss_schedule_targets_id_schedule_workspace_unique").on(
      table.id,
      table.rssScheduleId,
      table.workspaceId
    ),
    index("rss_schedule_targets_workspace_account_index").on(
      table.workspaceId,
      table.socialAccountId
    ),
  ]
)

export const rssScheduleHistories = pgTable(
  "rss_schedule_histories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rssScheduleId: uuid("rss_schedule_id").notNull(),
    rssScheduleTargetId: uuid("rss_schedule_target_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    publishingPostId: uuid("publishing_post_id").references(
      () => publishingPosts.id,
      { onDelete: "set null" }
    ),
    itemGuid: varchar("item_guid", { length: 1024 }),
    itemUrl: text("item_url"),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    title: varchar("title", { length: 500 }),
    result: varchar("result", { length: 16 })
      .$type<"queued" | "skipped" | "failed" | "published">()
      .notNull(),
    errorCode: varchar("error_code", { length: 96 }),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [
        table.rssScheduleTargetId,
        table.rssScheduleId,
        table.workspaceId,
      ],
      foreignColumns: [
        rssScheduleTargets.id,
        rssScheduleTargets.rssScheduleId,
        rssScheduleTargets.workspaceId,
      ],
      name: "rss_schedule_histories_target_schedule_workspace_fk",
    }).onDelete("cascade"),
    uniqueIndex("rss_schedule_histories_schedule_target_hash_unique").on(
      table.rssScheduleId,
      table.rssScheduleTargetId,
      table.contentHash
    ),
    index("rss_schedule_histories_schedule_created_index").on(
      table.rssScheduleId,
      table.createdAt
    ),
    index("rss_schedule_histories_target_result_created_index").on(
      table.rssScheduleTargetId,
      table.result,
      table.createdAt
    ),
    index("rss_schedule_histories_workspace_created_index").on(
      table.workspaceId,
      table.createdAt
    ),
  ]
)

export const rssScheduleRuns = pgTable(
  "rss_schedule_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rssScheduleId: uuid("rss_schedule_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    trigger: varchar("trigger", { length: 16 })
      .$type<"scheduled" | "manual">()
      .notNull(),
    triggeredByUserId: uuid("triggered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 16 })
      .$type<"queued" | "running" | "succeeded" | "failed">()
      .notNull()
      .default("queued"),
    jobId: varchar("job_id", { length: 128 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    feedItemsRead: integer("feed_items_read").notNull().default(0),
    queuedCount: integer("queued_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    errorCode: varchar("error_code", { length: 96 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.rssScheduleId, table.workspaceId],
      foreignColumns: [rssSchedules.id, rssSchedules.workspaceId],
      name: "rss_schedule_runs_schedule_workspace_fk",
    }).onDelete("cascade"),
    index("rss_schedule_runs_schedule_created_index").on(
      table.rssScheduleId,
      table.createdAt
    ),
    index("rss_schedule_runs_workspace_status_created_index").on(
      table.workspaceId,
      table.status,
      table.createdAt
    ),
    index("rss_schedule_runs_job_id_index").on(table.jobId),
  ]
)
