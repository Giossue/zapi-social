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
  primaryKey,
  text,
  timestamp,
  unique,
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
    memberLimit: integer("member_limit"),
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
    check(
      "workspaces_member_limit_check",
      sql`${table.memberLimit} is null or ${table.memberLimit} > 0`
    ),
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
    deliveryStatus: varchar("delivery_status", { length: 24 })
      .notNull()
      .default("pending"),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("workspace_invitations_pending_email_unique")
      .on(table.workspaceId, table.emailNormalized)
      .where(sql`${table.status} = 'pending'`),
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
    check(
      "workspace_invitations_delivery_status_check",
      sql`${table.deliveryStatus} in ('pending', 'sent', 'failed')`
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
    remembered: boolean("remembered").notNull().default(true),
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
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
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

export const fileImportBatches = pgTable(
  "file_import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    providerKey: varchar("provider_key", { length: 64 }).notNull(),
    sourceContext: varchar("source_context", { length: 24 })
      .$type<"files" | "publishing">()
      .notNull(),
    destinationFolderId: uuid("destination_folder_id").references(
      () => fileFolders.id,
      { onDelete: "set null" }
    ),
    status: varchar("status", { length: 24 })
      .$type<
        | "pending"
        | "processing"
        | "completed"
        | "partial"
        | "failed"
        | "expired"
      >()
      .notNull()
      .default("pending"),
    encryptedAccessToken: text("encrypted_access_token"),
    credentialExpiresAt: timestamp("credential_expires_at", {
      withTimezone: true,
    }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    totalItems: integer("total_items").notNull(),
    completedItems: integer("completed_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("file_import_batches_request_idempotency_unique").on(
      table.workspaceId,
      table.requestedByUserId,
      table.idempotencyKey
    ),
    index("file_import_batches_workspace_status_updated_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt
    ),
    index("file_import_batches_status_expiry_index").on(
      table.status,
      table.credentialExpiresAt
    ),
    check(
      "file_import_batches_counts_check",
      sql`${table.totalItems} > 0 and ${table.completedItems} >= 0 and ${table.failedItems} >= 0 and ${table.completedItems} + ${table.failedItems} <= ${table.totalItems}`
    ),
  ]
)

export const fileImportItems = pgTable(
  "file_import_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => fileImportBatches.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    providerFileIdCiphertext: text("provider_file_id_ciphertext"),
    providerFileIdHash: varchar("provider_file_id_hash", {
      length: 64,
    }).notNull(),
    resourceKeyCiphertext: text("resource_key_ciphertext"),
    status: varchar("status", { length: 24 })
      .$type<"pending" | "processing" | "completed" | "failed">()
      .notNull()
      .default("pending"),
    fileAssetId: uuid("file_asset_id"),
    fileAssetWorkspaceId: uuid("file_asset_workspace_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorCode: varchar("error_code", { length: 96 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("file_import_items_batch_provider_file_unique").on(
      table.batchId,
      table.providerFileIdHash
    ),
    index("file_import_items_batch_status_index").on(
      table.batchId,
      table.status
    ),
    foreignKey({
      columns: [table.fileAssetId, table.fileAssetWorkspaceId],
      foreignColumns: [fileAssets.id, fileAssets.workspaceId],
      name: "file_import_items_asset_workspace_fk",
    }).onDelete("set null"),
    check(
      "file_import_items_asset_workspace_check",
      sql`(${table.fileAssetId} is null and ${table.fileAssetWorkspaceId} is null) or (${table.fileAssetId} is not null and ${table.fileAssetWorkspaceId} = ${table.workspaceId})`
    ),
    check(
      "file_import_items_attempt_count_check",
      sql`${table.attemptCount} >= 0`
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
    socialAccountId: uuid("social_account_id"),
    status: varchar("status", { length: 16 })
      .$type<"draft" | "scheduled" | "processing" | "published" | "failed">()
      .notNull()
      .default("draft"),
    content: varchar("content", { length: 10000 }).notNull().default(""),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    source: varchar("source", { length: 32 }).notNull().default("portal"),
    externalReference: varchar("external_reference", { length: 255 }),
    networkOptions: jsonb("network_options")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    providerResult: jsonb("provider_result")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    failureCode: varchar("failure_code", { length: 96 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.socialAccountId, table.workspaceId],
      foreignColumns: [socialAccounts.id, socialAccounts.workspaceId],
      name: "publishing_posts_account_workspace_fk",
    }).onDelete("restrict"),
    unique("publishing_posts_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("publishing_posts_workspace_status_index").on(
      table.workspaceId,
      table.status
    ),
    index("publishing_posts_workspace_scheduled_index").on(
      table.workspaceId,
      table.scheduledAt
    ),
    index("publishing_posts_social_account_index").on(table.socialAccountId),
    uniqueIndex("publishing_posts_workspace_source_reference_account_unique")
      .on(
        table.workspaceId,
        table.source,
        table.externalReference,
        table.socialAccountId
      )
      .where(sql`${table.externalReference} is not null`),
  ]
)

export const publishingPostMedia = pgTable(
  "publishing_post_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publishingPostId: uuid("publishing_post_id").notNull(),
    fileAssetId: uuid("file_asset_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    foreignKey({
      columns: [table.publishingPostId, table.workspaceId],
      foreignColumns: [publishingPosts.id, publishingPosts.workspaceId],
      name: "publishing_post_media_post_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.fileAssetId, table.workspaceId],
      foreignColumns: [fileAssets.id, fileAssets.workspaceId],
      name: "publishing_post_media_file_workspace_fk",
    }).onDelete("restrict"),
    uniqueIndex("publishing_post_media_post_file_unique").on(
      table.publishingPostId,
      table.fileAssetId
    ),
    index("publishing_post_media_file_index").on(table.fileAssetId),
  ]
)

export const publishingPostAttempts = pgTable(
  "publishing_post_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publishingPostId: uuid("publishing_post_id").notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: varchar("status", { length: 16 })
      .$type<"queued" | "processing" | "succeeded" | "failed">()
      .notNull()
      .default("queued"),
    jobId: varchar("job_id", { length: 128 }).notNull(),
    providerRequestId: varchar("provider_request_id", { length: 512 }),
    response: jsonb("response")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    errorCode: varchar("error_code", { length: 96 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.publishingPostId, table.workspaceId],
      foreignColumns: [publishingPosts.id, publishingPosts.workspaceId],
      name: "publishing_post_attempts_post_workspace_fk",
    }).onDelete("cascade"),
    uniqueIndex("publishing_post_attempts_post_number_unique").on(
      table.publishingPostId,
      table.attemptNumber
    ),
    uniqueIndex("publishing_post_attempts_job_unique").on(table.jobId),
    index("publishing_post_attempts_workspace_status_created_index").on(
      table.workspaceId,
      table.status,
      table.createdAt
    ),
    check(
      "publishing_post_attempts_status_check",
      sql`${table.status} in ('queued', 'processing', 'succeeded', 'failed')`
    ),
    check(
      "publishing_post_attempts_number_check",
      sql`${table.attemptNumber} > 0`
    ),
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

export const accountGroups = pgTable(
  "account_groups",
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
    description: varchar("description", { length: 1000 }).notNull().default(""),
    color: varchar("color", { length: 7 }).notNull().default("#2563eb"),
    status: varchar("status", { length: 16 })
      .$type<"active" | "inactive">()
      .notNull()
      .default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("account_groups_workspace_slug_unique").on(
      table.workspaceId,
      table.slug
    ),
    unique("account_groups_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("account_groups_workspace_status_updated_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt
    ),
    check(
      "account_groups_status_check",
      sql`${table.status} in ('active', 'inactive')`
    ),
    check("account_groups_color_check", sql`${table.color} ~ '^#[0-9a-f]{6}$'`),
  ]
)

export const accountGroupSocialAccounts = pgTable(
  "account_group_social_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    socialAccountId: uuid("social_account_id").notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.groupId, table.workspaceId],
      foreignColumns: [accountGroups.id, accountGroups.workspaceId],
      name: "account_group_social_accounts_group_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.socialAccountId, table.workspaceId],
      foreignColumns: [socialAccounts.id, socialAccounts.workspaceId],
      name: "account_group_social_accounts_account_workspace_fk",
    }).onDelete("cascade"),
    uniqueIndex("account_group_social_accounts_group_account_unique").on(
      table.groupId,
      table.socialAccountId
    ),
    index("account_group_social_accounts_workspace_account_index").on(
      table.workspaceId,
      table.socialAccountId
    ),
  ]
)

export const bulkPostBatches = pgTable(
  "bulk_post_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sourceFileAssetId: uuid("source_file_asset_id").notNull(),
    status: varchar("status", { length: 16 })
      .$type<"queued" | "processing" | "completed" | "failed" | "cancelled">()
      .notNull()
      .default("queued"),
    intervalMinutes: integer("interval_minutes").notNull().default(60),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    jobId: varchar("job_id", { length: 128 }),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    invalidRows: integer("invalid_rows").notNull().default(0),
    createdPosts: integer("created_posts").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 96 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.sourceFileAssetId, table.workspaceId],
      foreignColumns: [fileAssets.id, fileAssets.workspaceId],
      name: "bulk_post_batches_source_file_workspace_fk",
    }).onDelete("restrict"),
    unique("bulk_post_batches_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("bulk_post_batches_workspace_status_created_index").on(
      table.workspaceId,
      table.status,
      table.createdAt
    ),
    index("bulk_post_batches_job_id_index").on(table.jobId),
    check(
      "bulk_post_batches_status_check",
      sql`${table.status} in ('queued', 'processing', 'completed', 'failed', 'cancelled')`
    ),
    check(
      "bulk_post_batches_interval_check",
      sql`${table.intervalMinutes} between 1 and 10080`
    ),
  ]
)

export const bulkPostBatchTargets = pgTable(
  "bulk_post_batch_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    socialAccountId: uuid("social_account_id").notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.batchId, table.workspaceId],
      foreignColumns: [bulkPostBatches.id, bulkPostBatches.workspaceId],
      name: "bulk_post_batch_targets_batch_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.socialAccountId, table.workspaceId],
      foreignColumns: [socialAccounts.id, socialAccounts.workspaceId],
      name: "bulk_post_batch_targets_account_workspace_fk",
    }).onDelete("restrict"),
    uniqueIndex("bulk_post_batch_targets_batch_account_unique").on(
      table.batchId,
      table.socialAccountId
    ),
  ]
)

export const bulkPostRows = pgTable(
  "bulk_post_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    status: varchar("status", { length: 16 })
      .$type<"pending" | "valid" | "invalid" | "processed" | "failed">()
      .notNull()
      .default("pending"),
    payload: jsonb("payload")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    validationErrors: jsonb("validation_errors")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.batchId, table.workspaceId],
      foreignColumns: [bulkPostBatches.id, bulkPostBatches.workspaceId],
      name: "bulk_post_rows_batch_workspace_fk",
    }).onDelete("cascade"),
    uniqueIndex("bulk_post_rows_batch_row_unique").on(
      table.batchId,
      table.rowNumber
    ),
    index("bulk_post_rows_batch_status_index").on(table.batchId, table.status),
    check(
      "bulk_post_rows_status_check",
      sql`${table.status} in ('pending', 'valid', 'invalid', 'processed', 'failed')`
    ),
  ]
)

export const bulkPostRowPosts = pgTable(
  "bulk_post_row_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bulkPostRowId: uuid("bulk_post_row_id")
      .notNull()
      .references(() => bulkPostRows.id, { onDelete: "cascade" }),
    publishingPostId: uuid("publishing_post_id")
      .notNull()
      .references(() => publishingPosts.id, { onDelete: "cascade" }),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("bulk_post_row_posts_row_account_unique").on(
      table.bulkPostRowId,
      table.socialAccountId
    ),
    uniqueIndex("bulk_post_row_posts_post_unique").on(table.publishingPostId),
  ]
)

export const automationApiKeys = pgTable(
  "automation_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    tokenPrefix: varchar("token_prefix", { length: 20 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    permissions: jsonb("permissions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 16 })
      .$type<"active" | "revoked">()
      .notNull()
      .default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("automation_api_keys_token_hash_unique").on(table.tokenHash),
    index("automation_api_keys_workspace_status_created_index").on(
      table.workspaceId,
      table.status,
      table.createdAt
    ),
    check(
      "automation_api_keys_status_check",
      sql`${table.status} in ('active', 'revoked')`
    ),
  ]
)

export const automationWebhooks = pgTable(
  "automation_webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    url: text("url").notNull(),
    signingSecretCiphertext: text("signing_secret_ciphertext").notNull(),
    events: jsonb("events")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    enabled: boolean("enabled").notNull().default(true),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    ...timestamps,
  },
  (table) => [
    unique("automation_webhooks_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("automation_webhooks_workspace_enabled_index").on(
      table.workspaceId,
      table.enabled
    ),
  ]
)

export const automationWebhookDeliveries = pgTable(
  "automation_webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webhookId: uuid("webhook_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    event: varchar("event", { length: 96 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: varchar("status", { length: 16 })
      .$type<"queued" | "processing" | "succeeded" | "failed">()
      .notNull()
      .default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    responseStatus: integer("response_status"),
    errorCode: varchar("error_code", { length: 96 }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.webhookId, table.workspaceId],
      foreignColumns: [automationWebhooks.id, automationWebhooks.workspaceId],
      name: "automation_webhook_deliveries_webhook_workspace_fk",
    }).onDelete("cascade"),
    uniqueIndex("automation_webhook_deliveries_webhook_key_unique").on(
      table.webhookId,
      table.idempotencyKey
    ),
    index("automation_webhook_deliveries_status_next_attempt_index").on(
      table.status,
      table.nextAttemptAt
    ),
  ]
)

export const automationLogs = pgTable(
  "automation_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    apiKeyId: uuid("api_key_id").references(() => automationApiKeys.id, {
      onDelete: "set null",
    }),
    webhookId: uuid("webhook_id").references(() => automationWebhooks.id, {
      onDelete: "set null",
    }),
    direction: varchar("direction", { length: 16 })
      .$type<"inbound" | "outbound">()
      .notNull(),
    event: varchar("event", { length: 96 }).notNull(),
    requestId: varchar("request_id", { length: 128 }),
    status: varchar("status", { length: 16 })
      .$type<"accepted" | "succeeded" | "failed">()
      .notNull(),
    statusCode: integer("status_code"),
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
    index("automation_logs_workspace_created_index").on(
      table.workspaceId,
      table.createdAt
    ),
    index("automation_logs_api_key_created_index").on(
      table.apiKeyId,
      table.createdAt
    ),
    index("automation_logs_webhook_created_index").on(
      table.webhookId,
      table.createdAt
    ),
    check(
      "automation_logs_direction_check",
      sql`${table.direction} in ('inbound', 'outbound')`
    ),
    check(
      "automation_logs_status_check",
      sql`${table.status} in ('accepted', 'succeeded', 'failed')`
    ),
  ]
)

export const workspaceCreditAccounts = pgTable(
  "workspace_credit_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    balanceUnits: integer("balance_units").notNull().default(0),
    unlimited: boolean("unlimited").notNull().default(false),
    cycleStartedAt: timestamp("cycle_started_at", { withTimezone: true }),
    cycleEndsAt: timestamp("cycle_ends_at", { withTimezone: true }),
    monthlyBudgetMicrousd: integer("monthly_budget_microusd"),
    budgetAlertPercent: integer("budget_alert_percent").notNull().default(80),
    budgetAlertsEnabled: boolean("budget_alerts_enabled")
      .notNull()
      .default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_credit_accounts_workspace_unique").on(
      table.workspaceId
    ),
    check(
      "workspace_credit_accounts_balance_check",
      sql`${table.balanceUnits} >= 0`
    ),
    check(
      "workspace_credit_accounts_budget_check",
      sql`${table.monthlyBudgetMicrousd} is null or ${table.monthlyBudgetMicrousd} >= 0`
    ),
    check(
      "workspace_credit_accounts_alert_percent_check",
      sql`${table.budgetAlertPercent} between 1 and 100`
    ),
  ]
)

export const aiWorkspaceSettings = pgTable(
  "ai_workspace_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    preferredProvider: varchar("preferred_provider", { length: 64 })
      .notNull()
      .default("openai-compatible"),
    preferredTextModel: varchar("preferred_text_model", { length: 160 }),
    preferredImageModel: varchar("preferred_image_model", { length: 160 }),
    brandVoice: varchar("brand_voice", { length: 5000 }).notNull().default(""),
    brandName: varchar("brand_name", { length: 160 }).notNull().default(""),
    brandDescription: varchar("brand_description", { length: 5000 })
      .notNull()
      .default(""),
    brandPersonality: varchar("brand_personality", { length: 80 })
      .notNull()
      .default("cercana"),
    preferredWords: jsonb("preferred_words")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    forbiddenWords: jsonb("forbidden_words")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    requireHumanReview: boolean("require_human_review").notNull().default(true),
    warnSensitiveClaims: boolean("warn_sensitive_claims")
      .notNull()
      .default(true),
    redactPersonalData: boolean("redact_personal_data").notNull().default(true),
    defaultTone: varchar("default_tone", { length: 80 })
      .notNull()
      .default("cercano"),
    language: varchar("language", { length: 16 }).notNull().default("es"),
    enforceCredits: boolean("enforce_credits").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_workspace_settings_workspace_unique").on(table.workspaceId),
  ]
)

export const aiModels = pgTable(
  "ai_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerKey: varchar("provider_key", { length: 64 })
      .notNull()
      .references(() => providerIntegrations.providerKey, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    modelId: varchar("model_id", { length: 160 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    capability: varchar("capability", { length: 16 })
      .$type<"text" | "image" | "video">()
      .notNull(),
    tier: varchar("tier", { length: 24 })
      .$type<"quality" | "balanced" | "economy" | "specialized">()
      .notNull(),
    enabled: boolean("enabled").notNull().default(false),
    deprecated: boolean("deprecated").notNull().default(false),
    inputPriceMicrousdPerMillion: integer("input_price_microusd_per_million"),
    outputPriceMicrousdPerMillion: integer("output_price_microusd_per_million"),
    unitPriceMicrousd: integer("unit_price_microusd"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_models_provider_model_unique").on(
      table.providerKey,
      table.modelId
    ),
    index("ai_models_capability_enabled_index").on(
      table.capability,
      table.enabled
    ),
    check(
      "ai_models_capability_check",
      sql`${table.capability} in ('text', 'image', 'video')`
    ),
    check(
      "ai_models_tier_check",
      sql`${table.tier} in ('quality', 'balanced', 'economy', 'specialized')`
    ),
    check(
      "ai_models_prices_check",
      sql`(${table.inputPriceMicrousdPerMillion} is null or ${table.inputPriceMicrousdPerMillion} >= 0) and (${table.outputPriceMicrousdPerMillion} is null or ${table.outputPriceMicrousdPerMillion} >= 0) and (${table.unitPriceMicrousd} is null or ${table.unitPriceMicrousd} >= 0)`
    ),
  ]
)

export const aiModelRoutes = pgTable(
  "ai_model_routes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: varchar("kind", { length: 32 })
      .$type<
        | "content"
        | "image"
        | "video"
        | "repurpose"
        | "planner"
        | "review"
        | "timing"
        | "search"
        | "ai_publishing"
      >()
      .notNull(),
    primaryModelId: uuid("primary_model_id").references(() => aiModels.id, {
      onDelete: "restrict",
    }),
    fallbackModelId: uuid("fallback_model_id").references(() => aiModels.id, {
      onDelete: "restrict",
    }),
    referenceModelId: uuid("reference_model_id").references(() => aiModels.id, {
      onDelete: "restrict",
    }),
    referenceFallbackModelId: uuid("reference_fallback_model_id").references(
      () => aiModels.id,
      { onDelete: "restrict" }
    ),
    reasoningEffort: varchar("reasoning_effort", { length: 16 })
      .$type<"none" | "low" | "medium" | "high" | "xhigh" | "max">()
      .notNull()
      .default("medium"),
    costUnits: integer("cost_units").notNull().default(1),
    enabled: boolean("enabled").notNull().default(true),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_model_routes_kind_unique").on(table.kind),
    check(
      "ai_model_routes_kind_check",
      sql`${table.kind} in ('content', 'image', 'video', 'repurpose', 'planner', 'review', 'timing', 'search', 'ai_publishing')`
    ),
    check(
      "ai_model_routes_reasoning_check",
      sql`${table.reasoningEffort} in ('none', 'low', 'medium', 'high', 'xhigh', 'max')`
    ),
    check("ai_model_routes_cost_check", sql`${table.costUnits} >= 0`),
    check(
      "ai_model_routes_fallback_check",
      sql`${table.fallbackModelId} is null or ${table.fallbackModelId} <> ${table.primaryModelId}`
    ),
    check(
      "ai_model_routes_reference_fallback_check",
      sql`${table.referenceFallbackModelId} is null or ${table.referenceFallbackModelId} <> ${table.referenceModelId}`
    ),
  ]
)

export const aiUserSettings = pgTable(
  "ai_user_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    defaultTone: varchar("default_tone", { length: 80 }),
    language: varchar("language", { length: 16 }),
    preferences: jsonb("preferences")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_user_settings_workspace_user_unique").on(
      table.workspaceId,
      table.userId
    ),
  ]
)

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull().default("Generación AI"),
    kind: varchar("kind", { length: 32 })
      .$type<
        | "content"
        | "image"
        | "video"
        | "repurpose"
        | "planner"
        | "review"
        | "timing"
        | "search"
        | "ai_publishing"
      >()
      .notNull(),
    status: varchar("status", { length: 16 })
      .$type<"queued" | "processing" | "succeeded" | "failed" | "cancelled">()
      .notNull()
      .default("queued"),
    prompt: text("prompt").notNull(),
    input: jsonb("input")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    result: jsonb("result")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    provider: varchar("provider", { length: 64 }),
    model: varchar("model", { length: 160 }),
    providerRequestId: varchar("provider_request_id", { length: 255 }),
    costUnits: integer("cost_units").notNull().default(0),
    progress: integer("progress").notNull().default(0),
    schemaVersion: integer("schema_version").notNull().default(1),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostMicrousd: integer("estimated_cost_microusd")
      .notNull()
      .default(0),
    latencyMs: integer("latency_ms"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    jobId: varchar("job_id", { length: 128 }),
    source: varchar("source", { length: 32 }).notNull().default("portal"),
    errorCode: varchar("error_code", { length: 96 }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_requests_workspace_user_idempotency_unique").on(
      table.workspaceId,
      table.requestedByUserId,
      table.idempotencyKey
    ),
    uniqueIndex("ai_requests_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("ai_requests_workspace_kind_created_index").on(
      table.workspaceId,
      table.kind,
      table.createdAt
    ),
    index("ai_requests_workspace_status_created_index").on(
      table.workspaceId,
      table.status,
      table.createdAt
    ),
    index("ai_requests_job_id_index").on(table.jobId),
    check(
      "ai_requests_kind_check",
      sql`${table.kind} in ('content', 'image', 'video', 'repurpose', 'planner', 'review', 'timing', 'search', 'ai_publishing')`
    ),
    check(
      "ai_requests_status_check",
      sql`${table.status} in ('queued', 'processing', 'succeeded', 'failed', 'cancelled')`
    ),
    check("ai_requests_cost_check", sql`${table.costUnits} >= 0`),
    check(
      "ai_requests_progress_check",
      sql`${table.progress} between 0 and 100`
    ),
    check(
      "ai_requests_usage_check",
      sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.estimatedCostMicrousd} >= 0 and (${table.latencyMs} is null or ${table.latencyMs} >= 0)`
    ),
  ]
)

export const creditLedgerEntries = pgTable(
  "credit_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    aiRequestId: uuid("ai_request_id").references(() => aiRequests.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 16 })
      .$type<"grant" | "debit" | "refund" | "adjustment">()
      .notNull(),
    action: varchar("action", { length: 96 }).notNull(),
    units: integer("units").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("credit_ledger_entries_workspace_key_unique").on(
      table.workspaceId,
      table.idempotencyKey
    ),
    index("credit_ledger_entries_workspace_created_index").on(
      table.workspaceId,
      table.createdAt
    ),
    index("credit_ledger_entries_request_index").on(table.aiRequestId),
    check(
      "credit_ledger_entries_type_check",
      sql`${table.type} in ('grant', 'debit', 'refund', 'adjustment')`
    ),
    check("credit_ledger_entries_units_check", sql`${table.units} <> 0`),
  ]
)

export const aiPublishingSchedules = pgTable(
  "ai_publishing_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    prompt: text("prompt").notNull(),
    status: varchar("status", { length: 16 })
      .$type<"draft" | "active" | "paused">()
      .notNull()
      .default("draft"),
    frequency: varchar("frequency", { length: 16 })
      .$type<"daily" | "weekly">()
      .notNull()
      .default("daily"),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    preferredTime: varchar("preferred_time", { length: 5 }).notNull(),
    weekdays: jsonb("weekdays")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    tone: varchar("tone", { length: 80 }).notNull().default("cercano"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("ai_publishing_schedules_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("ai_publishing_schedules_status_next_run_index").on(
      table.status,
      table.nextRunAt
    ),
    check(
      "ai_publishing_schedules_status_check",
      sql`${table.status} in ('draft', 'active', 'paused')`
    ),
    check(
      "ai_publishing_schedules_frequency_check",
      sql`${table.frequency} in ('daily', 'weekly')`
    ),
    check(
      "ai_publishing_schedules_time_check",
      sql`${table.preferredTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`
    ),
  ]
)

export const aiPublishingScheduleTargets = pgTable(
  "ai_publishing_schedule_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scheduleId: uuid("schedule_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    socialAccountId: uuid("social_account_id").notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.scheduleId, table.workspaceId],
      foreignColumns: [
        aiPublishingSchedules.id,
        aiPublishingSchedules.workspaceId,
      ],
      name: "ai_publishing_schedule_targets_schedule_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.socialAccountId, table.workspaceId],
      foreignColumns: [socialAccounts.id, socialAccounts.workspaceId],
      name: "ai_publishing_schedule_targets_account_workspace_fk",
    }).onDelete("restrict"),
    uniqueIndex("ai_publishing_schedule_targets_schedule_account_unique").on(
      table.scheduleId,
      table.socialAccountId
    ),
  ]
)

export const commerceProducts = pgTable(
  "commerce_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 240 }).notNull(),
    sku: varchar("sku", { length: 96 }).notNull(),
    description: text("description").notNull().default(""),
    status: varchar("status", { length: 16 })
      .$type<"active" | "inactive">()
      .notNull()
      .default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("commerce_products_workspace_sku_unique").on(
      table.workspaceId,
      table.sku
    ),
    unique("commerce_products_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    index("commerce_products_workspace_status_updated_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt
    ),
    check(
      "commerce_products_status_check",
      sql`${table.status} in ('active', 'inactive')`
    ),
  ]
)

export const commerceInventoryLevels = pgTable(
  "commerce_inventory_levels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    available: integer("available").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.productId, table.workspaceId],
      foreignColumns: [commerceProducts.id, commerceProducts.workspaceId],
      name: "commerce_inventory_levels_product_workspace_fk",
    }).onDelete("cascade"),
    uniqueIndex("commerce_inventory_levels_product_unique").on(table.productId),
    index("commerce_inventory_levels_workspace_available_index").on(
      table.workspaceId,
      table.available
    ),
    check(
      "commerce_inventory_levels_nonnegative_check",
      sql`${table.available} >= 0 and ${table.reserved} >= 0 and ${table.lowStockThreshold} >= 0`
    ),
    check(
      "commerce_inventory_levels_reserved_available_check",
      sql`${table.reserved} <= ${table.available}`
    ),
  ]
)

export const commerceOrders = pgTable(
  "commerce_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    customerName: varchar("customer_name", { length: 240 }).notNull(),
    customerEmail: varchar("customer_email", { length: 320 }),
    channel: varchar("channel", { length: 16 })
      .$type<"social" | "store" | "marketplace">()
      .notNull(),
    status: varchar("status", { length: 16 })
      .$type<"processing" | "completed" | "attention" | "cancelled">()
      .notNull()
      .default("processing"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    totalMinor: integer("total_minor").notNull().default(0),
    externalReference: varchar("external_reference", { length: 255 }),
    orderedAt: timestamp("ordered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    unique("commerce_orders_id_workspace_unique").on(
      table.id,
      table.workspaceId
    ),
    uniqueIndex("commerce_orders_workspace_external_reference_unique")
      .on(table.workspaceId, table.externalReference)
      .where(sql`${table.externalReference} is not null`),
    index("commerce_orders_workspace_ordered_index").on(
      table.workspaceId,
      table.orderedAt
    ),
    index("commerce_orders_workspace_status_ordered_index").on(
      table.workspaceId,
      table.status,
      table.orderedAt
    ),
    check(
      "commerce_orders_channel_check",
      sql`${table.channel} in ('social', 'store', 'marketplace')`
    ),
    check(
      "commerce_orders_status_check",
      sql`${table.status} in ('processing', 'completed', 'attention', 'cancelled')`
    ),
    check("commerce_orders_total_check", sql`${table.totalMinor} >= 0`),
  ]
)

export const commerceOrderItems = pgTable(
  "commerce_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commerceOrderId: uuid("commerce_order_id")
      .notNull()
      .references(() => commerceOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => commerceProducts.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 240 }).notNull(),
    sku: varchar("sku", { length: 96 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    totalMinor: integer("total_minor").notNull(),
    ...timestamps,
  },
  (table) => [
    index("commerce_order_items_order_index").on(table.commerceOrderId),
    index("commerce_order_items_product_index").on(table.productId),
    check(
      "commerce_order_items_amount_check",
      sql`${table.quantity} > 0 and ${table.unitPriceMinor} >= 0 and ${table.totalMinor} >= 0`
    ),
  ]
)

export const commerceReturnRequests = pgTable(
  "commerce_return_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commerceOrderId: uuid("commerce_order_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    status: varchar("status", { length: 16 })
      .$type<"requested" | "approved" | "rejected" | "completed">()
      .notNull()
      .default("requested"),
    amountMinor: integer("amount_minor").notNull().default(0),
    reason: varchar("reason", { length: 1000 }).notNull().default(""),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.commerceOrderId, table.workspaceId],
      foreignColumns: [commerceOrders.id, commerceOrders.workspaceId],
      name: "commerce_return_requests_order_workspace_fk",
    }).onDelete("cascade"),
    index("commerce_return_requests_workspace_status_created_index").on(
      table.workspaceId,
      table.status,
      table.createdAt
    ),
    check(
      "commerce_return_requests_status_check",
      sql`${table.status} in ('requested', 'approved', 'rejected', 'completed')`
    ),
    check(
      "commerce_return_requests_amount_check",
      sql`${table.amountMinor} >= 0`
    ),
  ]
)

export const affiliateProfiles = pgTable(
  "affiliate_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 48 }).notNull(),
    status: varchar("status", { length: 16 })
      .$type<"active" | "suspended">()
      .notNull()
      .default("active"),
    commissionRateBps: integer("commission_rate_bps").notNull().default(1000),
    payoutCurrency: varchar("payout_currency", { length: 3 })
      .notNull()
      .default("USD"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("affiliate_profiles_user_unique").on(table.userId),
    uniqueIndex("affiliate_profiles_code_unique").on(table.code),
    index("affiliate_profiles_status_created_index").on(
      table.status,
      table.createdAt
    ),
    check(
      "affiliate_profiles_status_check",
      sql`${table.status} in ('active', 'suspended')`
    ),
    check(
      "affiliate_profiles_rate_check",
      sql`${table.commissionRateBps} >= 0 and ${table.commissionRateBps} <= 10000`
    ),
  ]
)

export const affiliateReferrals = pgTable(
  "affiliate_referrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateProfileId: uuid("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfiles.id, { onDelete: "cascade" }),
    referredUserId: uuid("referred_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 16 })
      .$type<"visited" | "registered" | "converted" | "cancelled">()
      .notNull()
      .default("visited"),
    source: varchar("source", { length: 120 }),
    landingPath: varchar("landing_path", { length: 500 }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("affiliate_referrals_referred_user_unique")
      .on(table.referredUserId)
      .where(sql`${table.referredUserId} is not null`),
    index("affiliate_referrals_profile_status_created_index").on(
      table.affiliateProfileId,
      table.status,
      table.createdAt
    ),
    check(
      "affiliate_referrals_status_check",
      sql`${table.status} in ('visited', 'registered', 'converted', 'cancelled')`
    ),
  ]
)

export const affiliateReferralVisits = pgTable(
  "affiliate_referral_visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateProfileId: uuid("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfiles.id, { onDelete: "cascade" }),
    referralId: uuid("referral_id")
      .notNull()
      .references(() => affiliateReferrals.id, { onDelete: "cascade" }),
    fingerprintHash: varchar("fingerprint_hash", { length: 128 }),
    referrer: varchar("referrer", { length: 1000 }),
    userAgent: varchar("user_agent", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("affiliate_referral_visits_profile_created_index").on(
      table.affiliateProfileId,
      table.createdAt
    ),
    index("affiliate_referral_visits_referral_created_index").on(
      table.referralId,
      table.createdAt
    ),
  ]
)

export const affiliateCommissions = pgTable(
  "affiliate_commissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateProfileId: uuid("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfiles.id, { onDelete: "cascade" }),
    referralId: uuid("referral_id").references(() => affiliateReferrals.id, {
      onDelete: "set null",
    }),
    commerceOrderId: uuid("commerce_order_id").references(
      () => commerceOrders.id,
      { onDelete: "set null" }
    ),
    externalReference: varchar("external_reference", { length: 200 }),
    status: varchar("status", { length: 16 })
      .$type<"pending" | "available" | "paid" | "cancelled">()
      .notNull()
      .default("pending"),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    eligibleAt: timestamp("eligible_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("affiliate_commissions_profile_status_created_index").on(
      table.affiliateProfileId,
      table.status,
      table.createdAt
    ),
    index("affiliate_commissions_order_index").on(table.commerceOrderId),
    uniqueIndex("affiliate_commissions_order_unique")
      .on(table.commerceOrderId)
      .where(sql`${table.commerceOrderId} is not null`),
    uniqueIndex("affiliate_commissions_external_reference_unique")
      .on(table.externalReference)
      .where(sql`${table.externalReference} is not null`),
    check(
      "affiliate_commissions_status_check",
      sql`${table.status} in ('pending', 'available', 'paid', 'cancelled')`
    ),
    check("affiliate_commissions_amount_check", sql`${table.amountMinor} > 0`),
  ]
)

export const affiliateWithdrawals = pgTable(
  "affiliate_withdrawals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateProfileId: uuid("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfiles.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 16 })
      .$type<"requested" | "approved" | "paid" | "rejected">()
      .notNull()
      .default("requested"),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    paymentReference: varchar("payment_reference", { length: 255 }),
    notes: varchar("notes", { length: 1000 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("affiliate_withdrawals_profile_status_created_index").on(
      table.affiliateProfileId,
      table.status,
      table.createdAt
    ),
    check(
      "affiliate_withdrawals_status_check",
      sql`${table.status} in ('requested', 'approved', 'paid', 'rejected')`
    ),
    check("affiliate_withdrawals_amount_check", sql`${table.amountMinor} > 0`),
  ]
)

export const workspacePlanAssignments = pgTable(
  "workspace_plan_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    source: varchar("source", { length: 24 })
      .$type<"signup" | "admin" | "subscription">()
      .notNull()
      .default("admin"),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_plan_assignments_workspace_unique").on(
      table.workspaceId
    ),
    index("workspace_plan_assignments_plan_index").on(table.planId),
    check(
      "workspace_plan_assignments_source_check",
      sql`${table.source} in ('signup', 'admin', 'subscription')`
    ),
  ]
)

export const creditPackages = pgTable(
  "credit_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    description: varchar("description", { length: 500 }).notNull().default(""),
    units: integer("units").notNull(),
    priceMinor: integer("price_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    status: varchar("status", { length: 16 })
      .$type<"active" | "hidden">()
      .notNull()
      .default("active"),
    featured: boolean("featured").notNull().default(false),
    position: integer("position").notNull().default(1),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("credit_packages_name_unique").on(table.name),
    uniqueIndex("credit_packages_slug_unique").on(table.slug),
    index("credit_packages_status_position_index").on(
      table.status,
      table.position
    ),
    check("credit_packages_units_check", sql`${table.units} > 0`),
    check("credit_packages_price_check", sql`${table.priceMinor} >= 0`),
    check("credit_packages_position_check", sql`${table.position} > 0`),
    check(
      "credit_packages_status_check",
      sql`${table.status} in ('active', 'hidden')`
    ),
  ]
)

export const billingCoupons = pgTable(
  "billing_coupons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalDiscountId: varchar("external_discount_id", { length: 160 }),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    type: varchar("type", { length: 16 })
      .$type<"percentage" | "fixed">()
      .notNull(),
    value: integer("value").notNull(),
    currency: varchar("currency", { length: 3 }),
    duration: varchar("duration", { length: 16 })
      .$type<"once" | "forever">()
      .notNull()
      .default("once"),
    eligiblePlanIds: jsonb("eligible_plan_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").notNull().default(0),
    status: varchar("status", { length: 16 })
      .$type<"active" | "inactive">()
      .notNull()
      .default("active"),
    syncStatus: varchar("sync_status", { length: 16 })
      .$type<"pending" | "synced" | "failed">()
      .notNull()
      .default("pending"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_coupons_code_unique").on(sql`upper(${table.code})`),
    uniqueIndex("billing_coupons_external_discount_unique")
      .on(table.externalDiscountId)
      .where(sql`${table.externalDiscountId} is not null`),
    index("billing_coupons_status_created_index").on(
      table.status,
      table.createdAt
    ),
    check("billing_coupons_value_check", sql`${table.value} > 0`),
    check(
      "billing_coupons_max_redemptions_check",
      sql`${table.maxRedemptions} is null or ${table.maxRedemptions} > 0`
    ),
    check(
      "billing_coupons_redemption_count_check",
      sql`${table.redemptionCount} >= 0`
    ),
    check(
      "billing_coupons_type_check",
      sql`${table.type} in ('percentage', 'fixed')`
    ),
    check(
      "billing_coupons_percentage_check",
      sql`${table.type} <> 'percentage' or ${table.value} <= 10000`
    ),
    check(
      "billing_coupons_fixed_currency_check",
      sql`${table.type} <> 'fixed' or ${table.currency} is not null`
    ),
    check(
      "billing_coupons_dates_check",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} > ${table.startsAt}`
    ),
    check(
      "billing_coupons_status_check",
      sql`${table.status} in ('active', 'inactive')`
    ),
    check(
      "billing_coupons_sync_status_check",
      sql`${table.syncStatus} in ('pending', 'synced', 'failed')`
    ),
  ]
)

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalSubscriptionId: varchar("external_subscription_id", {
      length: 160,
    }).notNull(),
    externalCustomerId: varchar("external_customer_id", { length: 160 }),
    externalProductId: varchar("external_product_id", { length: 160 }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 24 })
      .$type<
        | "incomplete"
        | "trialing"
        | "active"
        | "past_due"
        | "paused"
        | "canceled"
        | "unpaid"
      >()
      .notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    interval: varchar("interval", { length: 16 })
      .$type<"month" | "year">()
      .notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStartsAt: timestamp("current_period_starts_at", {
      withTimezone: true,
    }),
    currentPeriodEndsAt: timestamp("current_period_ends_at", {
      withTimezone: true,
    }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_subscriptions_external_unique").on(
      table.externalSubscriptionId
    ),
    index("billing_subscriptions_workspace_status_index").on(
      table.workspaceId,
      table.status
    ),
    index("billing_subscriptions_user_created_index").on(
      table.userId,
      table.createdAt
    ),
    check("billing_subscriptions_amount_check", sql`${table.amountMinor} >= 0`),
    check(
      "billing_subscriptions_interval_check",
      sql`${table.interval} in ('month', 'year')`
    ),
    check(
      "billing_subscriptions_status_check",
      sql`${table.status} in ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'unpaid')`
    ),
  ]
)

export const billingPayments = pgTable(
  "billing_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalOrderId: varchar("external_order_id", { length: 160 }).notNull(),
    externalCheckoutId: varchar("external_checkout_id", { length: 160 }),
    invoiceNumber: varchar("invoice_number", { length: 96 }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    planId: uuid("plan_id").references(() => plans.id, {
      onDelete: "restrict",
    }),
    creditPackageId: uuid("credit_package_id").references(
      () => creditPackages.id,
      { onDelete: "restrict" }
    ),
    subscriptionId: uuid("subscription_id").references(
      () => billingSubscriptions.id,
      { onDelete: "set null" }
    ),
    productType: varchar("product_type", { length: 16 })
      .$type<"plan" | "credits">()
      .notNull(),
    productLabel: varchar("product_label", { length: 200 }).notNull(),
    status: varchar("status", { length: 24 })
      .$type<
        "pending" | "paid" | "partially_refunded" | "refunded" | "failed"
      >()
      .notNull()
      .default("pending"),
    amountMinor: integer("amount_minor").notNull(),
    refundedAmountMinor: integer("refunded_amount_minor").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_payments_external_order_unique").on(
      table.externalOrderId
    ),
    index("billing_payments_workspace_created_index").on(
      table.workspaceId,
      table.createdAt
    ),
    index("billing_payments_user_created_index").on(
      table.userId,
      table.createdAt
    ),
    check("billing_payments_amount_check", sql`${table.amountMinor} >= 0`),
    check(
      "billing_payments_refunded_amount_check",
      sql`${table.refundedAmountMinor} >= 0 and ${table.refundedAmountMinor} <= ${table.amountMinor}`
    ),
    check(
      "billing_payments_product_reference_check",
      sql`(${table.productType} = 'plan' and ${table.planId} is not null and ${table.creditPackageId} is null) or (${table.productType} = 'credits' and ${table.planId} is null and ${table.creditPackageId} is not null)`
    ),
    check(
      "billing_payments_product_type_check",
      sql`${table.productType} in ('plan', 'credits')`
    ),
    check(
      "billing_payments_status_check",
      sql`${table.status} in ('pending', 'paid', 'partially_refunded', 'refunded', 'failed')`
    ),
  ]
)

export const billingRefunds = pgTable(
  "billing_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalRefundId: varchar("external_refund_id", { length: 160 }).notNull(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => billingPayments.id, { onDelete: "restrict" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 16 })
      .$type<"pending" | "succeeded" | "failed" | "canceled">()
      .notNull()
      .default("pending"),
    amountMinor: integer("amount_minor").notNull(),
    reason: varchar("reason", { length: 32 }).notNull().default("other"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_refunds_external_unique").on(table.externalRefundId),
    index("billing_refunds_payment_created_index").on(
      table.paymentId,
      table.createdAt
    ),
    check("billing_refunds_amount_check", sql`${table.amountMinor} > 0`),
    check(
      "billing_refunds_status_check",
      sql`${table.status} in ('pending', 'succeeded', 'failed', 'canceled')`
    ),
  ]
)

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalEventId: varchar("external_event_id", { length: 200 }).notNull(),
    eventType: varchar("event_type", { length: 96 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 })
      .$type<"processing" | "processed" | "failed">()
      .notNull()
      .default("processing"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 96 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("billing_webhook_events_external_unique").on(
      table.externalEventId
    ),
    index("billing_webhook_events_status_created_index").on(
      table.status,
      table.createdAt
    ),
    check(
      "billing_webhook_events_status_check",
      sql`${table.status} in ('processing', 'processed', 'failed')`
    ),
  ]
)

export const languages = pgTable(
  "languages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 12 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    nativeName: varchar("native_name", { length: 120 }).notNull(),
    direction: varchar("direction", { length: 3 })
      .$type<"ltr" | "rtl">()
      .notNull()
      .default("ltr"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("languages_code_unique").on(table.code),
    check(
      "languages_direction_check",
      sql`${table.direction} in ('ltr', 'rtl')`
    ),
  ]
)

export const blogCategories = pgTable(
  "blog_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 140 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("blog_categories_slug_unique").on(table.slug)]
)

export const blogTags = pgTable(
  "blog_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 140 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("blog_tags_slug_unique").on(table.slug)]
)

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => blogCategories.id, {
      onDelete: "set null",
    }),
    slug: varchar("slug", { length: 180 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    excerpt: text("excerpt").notNull().default(""),
    content: text("content").notNull().default(""),
    status: varchar("status", { length: 16 })
      .$type<"draft" | "published">()
      .notNull()
      .default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("blog_posts_slug_unique").on(table.slug),
    index("blog_posts_status_idx").on(table.status),
    check(
      "blog_posts_status_check",
      sql`${table.status} in ('draft', 'published')`
    ),
  ]
)

export const blogPostTags = pgTable(
  "blog_post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => blogTags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("blog_post_tags_tag_idx").on(table.tagId),
  ]
)

export const faqs = pgTable("faqs", {
  id: uuid("id").defaultRandom().primaryKey(),
  question: varchar("question", { length: 250 }).notNull(),
  answer: text("answer").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
})

export const aiTemplateCategories = pgTable(
  "ai_template_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 140 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("ai_template_categories_slug_unique").on(table.slug)]
)

export const aiTemplates = pgTable(
  "ai_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => aiTemplateCategories.id, {
      onDelete: "set null",
    }),
    slug: varchar("slug", { length: 180 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    prompt: text("prompt").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("ai_templates_slug_unique").on(table.slug)]
)

export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: jsonb("value")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const linkBioPages = pgTable(
  "link_bio_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 160 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    headline: varchar("headline", { length: 190 }).notNull().default(""),
    description: text("description").notNull().default(""),
    templateKey: varchar("template_key", { length: 60 })
      .notNull()
      .default("aurora"),
    avatarFileAssetId: uuid("avatar_file_asset_id").references(
      () => fileAssets.id,
      { onDelete: "set null" }
    ),
    coverFileAssetId: uuid("cover_file_asset_id").references(
      () => fileAssets.id,
      { onDelete: "set null" }
    ),
    status: varchar("status", { length: 16 })
      .$type<"draft" | "published">()
      .notNull()
      .default("draft"),
    blocks: jsonb("blocks")
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    appearance: jsonb("appearance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("link_bio_pages_slug_unique").on(table.slug),
    index("link_bio_pages_workspace_idx").on(table.workspaceId),
    check(
      "link_bio_pages_status_check",
      sql`${table.status} in ('draft', 'published')`
    ),
  ]
)

export const linkBioEvents = pgTable(
  "link_bio_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => linkBioPages.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 16 }).$type<"view" | "click">().notNull(),
    blockIndex: integer("block_index"),
    itemIndex: integer("item_index"),
    url: text("url"),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("link_bio_events_page_type_idx").on(table.pageId, table.type),
    index("link_bio_events_page_target_idx").on(
      table.pageId,
      table.blockIndex,
      table.itemIndex
    ),
    check(
      "link_bio_events_type_check",
      sql`${table.type} in ('view', 'click')`
    ),
  ]
)

export const boardColumns = pgTable(
  "board_columns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    position: integer("position").notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#2563eb"),
    isTerminal: boolean("is_terminal").notNull().default(false),
    wipLimit: integer("wip_limit"),
    ...timestamps,
  },
  (table) => [
    unique("board_columns_id_workspace_unique").on(table.id, table.workspaceId),
    index("board_columns_workspace_position_index").on(
      table.workspaceId,
      table.position
    ),
    check("board_columns_position_check", sql`${table.position} >= 0`),
    check("board_columns_color_check", sql`${table.color} ~ '^#[0-9a-f]{6}$'`),
    check(
      "board_columns_wip_limit_check",
      sql`${table.wipLimit} is null or ${table.wipLimit} > 0`
    ),
  ]
)

export const boardLabels = pgTable(
  "board_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 40 }).notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#64748b"),
    ...timestamps,
  },
  (table) => [
    unique("board_labels_id_workspace_unique").on(table.id, table.workspaceId),
    uniqueIndex("board_labels_workspace_name_unique").on(
      table.workspaceId,
      table.name
    ),
    check("board_labels_color_check", sql`${table.color} ~ '^#[0-9a-f]{6}$'`),
  ]
)

export const boardTasks = pgTable(
  "board_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    columnId: uuid("column_id").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    priority: varchar("priority", { length: 8 })
      .$type<"low" | "medium" | "high">()
      .notNull()
      .default("medium"),
    dueDate: date("due_date"),
    progress: integer("progress").notNull().default(0),
    position: integer("position").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    publishingPostId: uuid("publishing_post_id"),
    ...timestamps,
  },
  (table) => [
    unique("board_tasks_id_workspace_unique").on(table.id, table.workspaceId),
    foreignKey({
      columns: [table.columnId, table.workspaceId],
      foreignColumns: [boardColumns.id, boardColumns.workspaceId],
      name: "board_tasks_column_workspace_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.publishingPostId, table.workspaceId],
      foreignColumns: [publishingPosts.id, publishingPosts.workspaceId],
      name: "board_tasks_publishing_post_workspace_fk",
    }).onDelete("set null"),
    index("board_tasks_workspace_column_position_index").on(
      table.workspaceId,
      table.columnId,
      table.position
    ),
    index("board_tasks_workspace_assignee_due_index").on(
      table.workspaceId,
      table.assigneeUserId,
      table.dueDate
    ),
    check(
      "board_tasks_priority_check",
      sql`${table.priority} in ('low', 'medium', 'high')`
    ),
    check(
      "board_tasks_progress_check",
      sql`${table.progress} between 0 and 100`
    ),
    check("board_tasks_position_check", sql`${table.position} >= 0`),
  ]
)

export const boardTaskLabels = pgTable(
  "board_task_labels",
  {
    taskId: uuid("task_id").notNull(),
    labelId: uuid("label_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.labelId] }),
    foreignKey({
      columns: [table.taskId, table.workspaceId],
      foreignColumns: [boardTasks.id, boardTasks.workspaceId],
      name: "board_task_labels_task_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.labelId, table.workspaceId],
      foreignColumns: [boardLabels.id, boardLabels.workspaceId],
      name: "board_task_labels_label_workspace_fk",
    }).onDelete("cascade"),
    index("board_task_labels_label_index").on(table.labelId),
  ]
)

export const boardTaskComments = pgTable(
  "board_task_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.taskId, table.workspaceId],
      foreignColumns: [boardTasks.id, boardTasks.workspaceId],
      name: "board_task_comments_task_workspace_fk",
    }).onDelete("cascade"),
    index("board_task_comments_task_created_index").on(
      table.taskId,
      table.createdAt
    ),
  ]
)

export const boardTaskAttachments = pgTable(
  "board_task_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").notNull(),
    fileAssetId: uuid("file_asset_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.taskId, table.workspaceId],
      foreignColumns: [boardTasks.id, boardTasks.workspaceId],
      name: "board_task_attachments_task_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.fileAssetId, table.workspaceId],
      foreignColumns: [fileAssets.id, fileAssets.workspaceId],
      name: "board_task_attachments_asset_workspace_fk",
    }).onDelete("cascade"),
    uniqueIndex("board_task_attachments_task_asset_unique").on(
      table.taskId,
      table.fileAssetId
    ),
    index("board_task_attachments_asset_index").on(table.fileAssetId),
  ]
)

export const workspaceNotifications = pgTable(
  "workspace_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 64 }).notNull(),
    payload: jsonb("payload")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    url: varchar("url", { length: 2048 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("workspace_notifications_user_feed_index").on(
      table.userId,
      table.archivedAt,
      table.createdAt
    ),
    index("workspace_notifications_workspace_index").on(
      table.workspaceId,
      table.createdAt
    ),
  ]
)

export const platformAnnouncements = pgTable(
  "platform_announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    url: varchar("url", { length: 2048 }),
    audience: varchar("audience", { length: 16 })
      .$type<"all" | "workspace" | "user">()
      .notNull()
      .default("all"),
    targetWorkspaceId: uuid("target_workspace_id").references(
      () => workspaces.id,
      { onDelete: "cascade" }
    ),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    status: varchar("status", { length: 16 })
      .$type<"draft" | "published">()
      .notNull()
      .default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("platform_announcements_status_published_index").on(
      table.status,
      table.publishedAt
    ),
    index("platform_announcements_audience_index").on(
      table.audience,
      table.targetWorkspaceId,
      table.targetUserId
    ),
    check(
      "platform_announcements_audience_check",
      sql`${table.audience} in ('all', 'workspace', 'user')`
    ),
    check(
      "platform_announcements_status_check",
      sql`${table.status} in ('draft', 'published')`
    ),
    check(
      "platform_announcements_target_check",
      sql`(${table.audience} = 'all' and ${table.targetWorkspaceId} is null and ${table.targetUserId} is null) or (${table.audience} = 'workspace' and ${table.targetWorkspaceId} is not null and ${table.targetUserId} is null) or (${table.audience} = 'user' and ${table.targetUserId} is not null and ${table.targetWorkspaceId} is null)`
    ),
    check(
      "platform_announcements_published_check",
      sql`${table.status} = 'draft' or ${table.publishedAt} is not null`
    ),
  ]
)

export const platformAnnouncementReads = pgTable(
  "platform_announcement_reads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => platformAnnouncements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("platform_announcement_reads_unique").on(
      table.announcementId,
      table.userId
    ),
    index("platform_announcement_reads_user_index").on(
      table.userId,
      table.archivedAt
    ),
  ]
)

export const manualPayments = pgTable(
  "manual_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    planId: uuid("plan_id").references(() => plans.id, {
      onDelete: "restrict",
    }),
    creditPackageId: uuid("credit_package_id").references(
      () => creditPackages.id,
      { onDelete: "restrict" }
    ),
    productType: varchar("product_type", { length: 16 })
      .$type<"plan" | "credits">()
      .notNull(),
    reference: varchar("reference", { length: 190 }).notNull(),
    paymentInfo: varchar("payment_info", { length: 2000 })
      .notNull()
      .default(""),
    note: text("note").notNull().default(""),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    status: varchar("status", { length: 16 })
      .$type<"pending" | "approved" | "rejected">()
      .notNull()
      .default("pending"),
    billingPaymentId: uuid("billing_payment_id").references(
      () => billingPayments.id,
      { onDelete: "set null" }
    ),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("manual_payments_reference_unique").on(table.reference),
    index("manual_payments_status_created_index").on(
      table.status,
      table.createdAt
    ),
    index("manual_payments_workspace_index").on(table.workspaceId),
    check("manual_payments_amount_check", sql`${table.amountMinor} > 0`),
    check(
      "manual_payments_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected')`
    ),
    check(
      "manual_payments_product_reference_check",
      sql`(${table.productType} = 'plan' and ${table.planId} is not null and ${table.creditPackageId} is null) or (${table.productType} = 'credits' and ${table.planId} is null and ${table.creditPackageId} is not null)`
    ),
  ]
)

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 96 }).notNull(),
    locale: varchar("locale", { length: 8 }).notNull().default("es"),
    subject: varchar("subject", { length: 250 }).notNull(),
    title: varchar("title", { length: 250 }).notNull(),
    description: text("description").notNull(),
    actionLabel: varchar("action_label", { length: 120 }),
    notice: text("notice"),
    isActive: boolean("is_active").notNull().default(true),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("email_templates_key_locale_unique").on(
      table.key,
      table.locale
    ),
  ]
)
