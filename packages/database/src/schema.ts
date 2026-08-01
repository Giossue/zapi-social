import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    username: varchar('username', { length: 64 }),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    passwordHash: text('password_hash'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    status: varchar('status', { length: 24 }).notNull().default('active'),
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_email_normalized_unique').on(sql`lower(${table.email})`),
    uniqueIndex('users_username_normalized_unique').on(sql`lower(${table.username})`),
    index('users_status_index').on(table.status),
  ],
)

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 96 }).notNull(),
    kind: varchar('kind', { length: 24 }).notNull().default('personal'),
    enabledModules: jsonb('enabled_modules').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('workspaces_slug_unique').on(table.slug),
    uniqueIndex('workspaces_personal_owner_unique')
      .on(table.ownerUserId)
      .where(sql`${table.kind} = 'personal'`),
  ],
)

export const workspaceMemberships = pgTable(
  'workspace_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 24 }).notNull().default('member'),
    status: varchar('status', { length: 24 }).notNull().default('active'),
    permissions: jsonb('permissions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('workspace_memberships_workspace_user_unique').on(table.workspaceId, table.userId),
    index('workspace_memberships_user_status_index').on(table.userId, table.status),
  ],
)

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 64 }).notNull(),
    providerSubject: varchar('provider_subject', { length: 255 }).notNull(),
    accessTokenEncrypted: text('access_token_encrypted'),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    scopes: jsonb('scopes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('auth_identities_provider_subject_unique').on(table.provider, table.providerSubject),
    index('auth_identities_user_provider_index').on(table.userId, table.provider),
  ],
)

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    activeWorkspaceId: uuid('active_workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('auth_sessions_token_hash_unique').on(table.tokenHash),
    index('auth_sessions_user_expiry_index').on(table.userId, table.expiresAt),
  ],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    event: varchar('event', { length: 160 }).notNull(),
    subjectType: varchar('subject_type', { length: 96 }),
    subjectId: uuid('subject_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_workspace_created_index').on(table.workspaceId, table.createdAt),
    index('audit_logs_actor_created_index').on(table.actorUserId, table.createdAt),
  ],
)

export const providerIntegrations = pgTable(
  'provider_integrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerKey: varchar('provider_key', { length: 64 }).notNull(),
    enabled: boolean('enabled').notNull().default(false),
    readiness: varchar('readiness', { length: 24 }).notNull().default('unconfigured'),
    capabilities: jsonb('capabilities').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    enabledCapabilityKeys: jsonb('enabled_capability_keys')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    configurationCiphertext: text('configuration_ciphertext'),
    configVersion: integer('config_version').notNull().default(1),
    readinessIssues: jsonb('readiness_issues').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    testedConfigFingerprint: varchar('tested_config_fingerprint', { length: 128 }),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestedByPlatformAdminId: uuid('last_tested_by_platform_admin_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('provider_integrations_provider_key_unique').on(table.providerKey),
    index('provider_integrations_enabled_readiness_index').on(table.enabled, table.readiness),
  ],
)

export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    providerKey: varchar('provider_key', { length: 64 }).notNull(),
    capabilityKey: varchar('capability_key', { length: 64 }).notNull(),
    externalId: varchar('external_id', { length: 255 }),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    handle: varchar('handle', { length: 255 }),
    profileUrl: text('profile_url'),
    avatarUrl: text('avatar_url'),
    status: varchar('status', { length: 24 }).notNull().default('active'),
    connectedAt: timestamp('connected_at', { withTimezone: true }),
    disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('social_accounts_workspace_provider_capability_external_unique')
      .on(table.workspaceId, table.providerKey, table.capabilityKey, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index('social_accounts_workspace_status_index').on(table.workspaceId, table.status),
    index('social_accounts_workspace_provider_index').on(table.workspaceId, table.providerKey),
  ],
)

export const socialAccountCredentials = pgTable(
  'social_account_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    socialAccountId: uuid('social_account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    accessTokenCiphertext: text('access_token_ciphertext'),
    refreshTokenCiphertext: text('refresh_token_ciphertext'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    scopes: jsonb('scopes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    encryptionKeyVersion: varchar('encryption_key_version', { length: 64 }).notNull().default('v1'),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('social_account_credentials_social_account_unique').on(table.socialAccountId),
    index('social_account_credentials_expiry_index').on(table.expiresAt),
  ],
)

export const socialAccountMemberships = pgTable(
  'social_account_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    socialAccountId: uuid('social_account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    workspaceMembershipId: uuid('workspace_membership_id')
      .notNull()
      .references(() => workspaceMemberships.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('social_account_memberships_account_membership_unique').on(
      table.socialAccountId,
      table.workspaceMembershipId,
    ),
    index('social_account_memberships_membership_index').on(table.workspaceMembershipId),
  ],
)

export const channelOauthStates = pgTable(
  'channel_oauth_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stateHash: varchar('state_hash', { length: 128 }).notNull(),
    providerKey: varchar('provider_key', { length: 64 }).notNull(),
    capabilityKey: varchar('capability_key', { length: 64 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    pkceVerifierCiphertext: text('pkce_verifier_ciphertext'),
    contextCiphertext: text('context_ciphertext'),
    reconnectAccountId: uuid('reconnect_account_id').references(() => socialAccounts.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('channel_oauth_states_state_hash_unique').on(table.stateHash),
    index('channel_oauth_states_expiry_index').on(table.expiresAt),
    index('channel_oauth_states_workspace_provider_index').on(table.workspaceId, table.providerKey),
    index('channel_oauth_states_workspace_provider_capability_index').on(
      table.workspaceId,
      table.providerKey,
      table.capabilityKey,
    ),
  ],
)

export const channelConnectionSessions = pgTable(
  'channel_connection_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    capabilityKey: varchar('capability_key', { length: 64 }).notNull(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    reconnectAccountId: uuid('reconnect_account_id').references(() => socialAccounts.id, { onDelete: 'set null' }),
    socialAccountId: uuid('social_account_id').references(() => socialAccounts.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 24 }).notNull().default('authorizing'),
    externalConnectionId: varchar('external_connection_id', { length: 255 }),
    contextCiphertext: text('context_ciphertext'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index('channel_connection_sessions_workspace_status_index').on(table.workspaceId, table.status),
    index('channel_connection_sessions_expiry_index').on(table.expiresAt),
    index('channel_connection_sessions_social_account_index').on(table.socialAccountId),
  ],
)

export const channelConnectionCandidates = pgTable(
  'channel_connection_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channelConnectionSessionId: uuid('channel_connection_session_id')
      .notNull()
      .references(() => channelConnectionSessions.id, { onDelete: 'cascade' }),
    externalId: varchar('external_id', { length: 512 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('channel_connection_candidates_session_external_unique').on(
      table.channelConnectionSessionId,
      table.externalId,
    ),
    index('channel_connection_candidates_session_index').on(table.channelConnectionSessionId),
  ],
)

export const channelSyncRuns = pgTable(
  'channel_sync_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    socialAccountId: uuid('social_account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 24 }).notNull().default('pending'),
    jobId: varchar('job_id', { length: 128 }),
    requestId: varchar('request_id', { length: 128 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    errorCode: varchar('error_code', { length: 96 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('channel_sync_runs_account_created_index').on(table.socialAccountId, table.createdAt),
    index('channel_sync_runs_status_created_index').on(table.status, table.createdAt),
    index('channel_sync_runs_job_id_index').on(table.jobId),
  ],
)
