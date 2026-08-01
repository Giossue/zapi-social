import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  channelConnectionCandidates,
  channelConnectionSessions,
  socialAccountCredentials,
  socialAccounts,
} from '@workspace/database'
import {
  portalChannelCapabilityKeySchema,
  selectPortalChannelCandidateSchema,
  startPortalChannelConnectionSchema,
  type PortalAuthSession,
  type PortalChannelAccount,
  type PortalChannelCandidate,
  type MetaCapabilityKey,
  type MetaCapabilityScopes,
  type MetaOAuthScope,
  type PortalChannelConnection,
} from '@workspace/contracts'
import { and, eq, gt } from '@workspace/database/query'
import { DatabaseService } from '../database/database.service'
import { IntegrationsService } from '../integrations/integrations.service'
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service'
import { ChannelOAuthService } from './oauth/channel-oauth.service'

const managerRoles = new Set(['owner', 'admin'])
const metaCapabilities = new Set<MetaCapabilityKey>([
  'facebook_page',
  'instagram_profile',
])
const lifetimeMilliseconds = 10 * 60 * 1000

type ConnectionRow = typeof channelConnectionSessions.$inferSelect
type CandidateContext = {
  externalId: string
  displayName: string
  handle: string | null
  profileUrl: string | null
  avatarUrl: string | null
  accessToken: string
}
type MetaConnectionContext = {
  candidates: Record<string, CandidateContext>
  scopes: MetaOAuthScope[]
}

type MetaPage = {
  id?: string
  name?: string
  access_token?: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: {
    id?: string
    username?: string
    profile_picture_url?: string
  }
}

@Injectable()
export class ChannelConnectionsService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly integrations: IntegrationsService,
    private readonly oauth: ChannelOAuthService,
  ) {}

  async start(session: PortalAuthSession, input: unknown) {
    this.requireManager(session)
    const values = this.parse(startPortalChannelConnectionSchema.safeParse(input))
    if (!this.isMetaCapability(values.capabilityKey)) throw new BadRequestException()
    if (values.reconnectAccountId) {
      await this.assertReconnectAccount(session, values.reconnectAccountId, values.capabilityKey)
    }

    const configuration = await this.integrations.readOAuthConfiguration('facebook')
    const scopes = this.metaScopes(configuration, values.capabilityKey)
    const expiresAt = new Date(Date.now() + lifetimeMilliseconds)
    const [connection] = await this.database.db
      .insert(channelConnectionSessions)
      .values({
        workspaceId: session.workspace.id,
        userId: session.user.id,
        capabilityKey: values.capabilityKey,
        reconnectAccountId: values.reconnectAccountId ?? null,
        status: 'authorizing',
        expiresAt,
      })
      .returning()

    const state = await this.oauth.start(session, {
      providerKey: 'facebook',
      capabilityKey: values.capabilityKey,
      reconnectAccountId: values.reconnectAccountId,
      context: { connectionId: connection.id },
    })
    return {
      connection: this.serializeConnection(connection),
      authorizationUrl: this.authorizationUrl(configuration.clientId, state.state, scopes),
    }
  }

  async reconnect(session: PortalAuthSession, accountId: string) {
    this.requireManager(session)
    const account = await this.accountForWorkspace(session, accountId)
    return this.start(session, {
      capabilityKey: account.capabilityKey,
      reconnectAccountId: account.id,
    })
  }

  async candidates(
    session: PortalAuthSession,
    connectionId: string,
  ) {
    const connection = await this.connectionForSession(session, connectionId)
    if (connection.status !== 'picker_ready') throw new BadRequestException()
    const rows = await this.database.db
      .select()
      .from(channelConnectionCandidates)
      .where(eq(channelConnectionCandidates.channelConnectionSessionId, connection.id))
    return {
      connectionId: connection.id,
      state: 'picker_ready',
      candidates: rows.map((candidate): PortalChannelCandidate => ({
        id: candidate.id,
        label: candidate.displayName,
        description: candidate.description,
        metadata: this.publicMetadata(candidate.metadata),
      })),
    }
  }

  async select(
    session: PortalAuthSession,
    connectionId: string,
    input: unknown,
  ) {
    this.requireManager(session)
    const candidateId = this.parse(selectPortalChannelCandidateSchema.safeParse(input)).candidateId
    const connection = await this.connectionForSession(session, connectionId)
    if (connection.status !== 'picker_ready') throw new BadRequestException()
    const [candidate] = await this.database.db
      .select()
      .from(channelConnectionCandidates)
      .where(
        and(
          eq(channelConnectionCandidates.id, candidateId),
          eq(channelConnectionCandidates.channelConnectionSessionId, connection.id),
        ),
      )
      .limit(1)
    if (!candidate) throw new NotFoundException()

    const context = this.decryptContext(connection)
    const selected = context.candidates[candidate.id]
    if (!selected || selected.externalId !== candidate.externalId) throw new BadRequestException()

    const account = await this.persistSelection(connection, selected, context.scopes)
    const [updated] = await this.database.db
      .update(channelConnectionSessions)
      .set({ socialAccountId: account.id, status: 'connected', updatedAt: new Date() })
      .where(eq(channelConnectionSessions.id, connection.id))
      .returning()

    return {
      account: this.serializeAccount(account),
      connection: { ...this.serializeConnection(updated), state: 'connected' },
    }
  }

  async cancel(session: PortalAuthSession, connectionId: string): Promise<PortalChannelConnection> {
    this.requireManager(session)
    const connection = await this.connectionForSession(session, connectionId)
    if (connection.status === 'connected') throw new BadRequestException()
    const [updated] = await this.database.db
      .update(channelConnectionSessions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(channelConnectionSessions.id, connection.id))
      .returning()
    return this.serializeConnection(updated)
  }

  async callback(query: unknown): Promise<{ outcome: 'authorized' | 'denied' | 'failed'; capabilityKey: string }> {
    const parsed = this.parseCallback(query)
    const state = await this.oauth.consume(parsed.state, 'facebook')
    const connectionId = state.context.connectionId
    if (!connectionId) throw new BadRequestException()
    const [connection] = await this.database.db
      .select()
      .from(channelConnectionSessions)
      .where(
        and(
          eq(channelConnectionSessions.id, connectionId),
          eq(channelConnectionSessions.workspaceId, state.workspaceId),
          eq(channelConnectionSessions.userId, state.userId),
          gt(channelConnectionSessions.expiresAt, new Date()),
        ),
      )
      .limit(1)
    if (!connection || connection.status !== 'authorizing') throw new BadRequestException()

    if (!parsed.code || parsed.error) {
      await this.database.db
        .update(channelConnectionSessions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(channelConnectionSessions.id, connection.id))
      return { outcome: 'denied', capabilityKey: connection.capabilityKey }
    }

    try {
      if (!this.isMetaCapability(connection.capabilityKey)) throw new BadRequestException()
      const configuration = await this.integrations.readOAuthConfiguration('facebook')
      const scopes = this.metaScopes(configuration, connection.capabilityKey)
      const token = await this.exchangeCode(configuration, parsed.code)
      const candidates = (await this.fetchCandidates(token)).filter(
        (candidate) => candidate.publicMetadata.kind === connection.capabilityKey,
      )
      const inserted = candidates.length
        ? await this.database.db
            .insert(channelConnectionCandidates)
            .values(
              candidates.map((candidate) => ({
                channelConnectionSessionId: connection.id,
                externalId: candidate.externalId,
                displayName: candidate.displayName,
                description: candidate.description,
                metadata: candidate.publicMetadata,
              })),
            )
            .returning({ id: channelConnectionCandidates.id, externalId: channelConnectionCandidates.externalId })
        : []
      const byExternalId = new Map(candidates.map((candidate) => [candidate.externalId, candidate.context]))
      const context: MetaConnectionContext = {
        scopes,
        candidates: Object.fromEntries(
          inserted.map((candidate) => [candidate.id, byExternalId.get(candidate.externalId)]).filter(([, value]) => value),
        ),
      }
      await this.database.db
        .update(channelConnectionSessions)
        .set({
          status: 'picker_ready',
          contextCiphertext: this.encryptContext(connection.id, context),
          updatedAt: new Date(),
        })
        .where(eq(channelConnectionSessions.id, connection.id))
      return { outcome: 'authorized', capabilityKey: connection.capabilityKey }
    } catch {
      await this.database.db
        .update(channelConnectionSessions)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(channelConnectionSessions.id, connection.id))
      return { outcome: 'failed', capabilityKey: connection.capabilityKey }
    }
  }

  private async persistSelection(
    connection: ConnectionRow,
    selected: CandidateContext,
    scopes: MetaOAuthScope[],
  ) {
    const [existing] = await this.database.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, connection.workspaceId),
          eq(socialAccounts.providerKey, 'meta'),
          eq(socialAccounts.capabilityKey, connection.capabilityKey),
          eq(socialAccounts.externalId, selected.externalId),
        ),
      )
      .limit(1)
    const values = {
      displayName: selected.displayName,
      handle: selected.handle,
      profileUrl: selected.profileUrl,
      avatarUrl: selected.avatarUrl,
      status: 'active',
      connectedAt: new Date(),
      disconnectedAt: null,
      updatedAt: new Date(),
    }
    const account = existing
      ? (await this.database.db.update(socialAccounts).set(values).where(eq(socialAccounts.id, existing.id)).returning())[0]
      : (await this.database.db.insert(socialAccounts).values({
          workspaceId: connection.workspaceId,
          providerKey: 'meta',
          capabilityKey: connection.capabilityKey,
          externalId: selected.externalId,
          ...values,
        }).returning())[0]
    await this.database.db
      .insert(socialAccountCredentials)
      .values({
        socialAccountId: account.id,
        accessTokenCiphertext: this.encryption().encrypt(selected.accessToken, `meta:account:${account.id}`),
        scopes,
      })
      .onConflictDoUpdate({
        target: socialAccountCredentials.socialAccountId,
        set: {
          accessTokenCiphertext: this.encryption().encrypt(selected.accessToken, `meta:account:${account.id}`),
          scopes,
          rotatedAt: new Date(),
          updatedAt: new Date(),
        },
      })
    return account
  }

  private async exchangeCode(configuration: { clientId: string; clientSecret: string }, code: string) {
    const url = new URL('https://graph.facebook.com/v22.0/oauth/access_token')
    url.search = new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      redirect_uri: this.callbackUrl(),
      code,
    }).toString()
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok || !this.hasAccessToken(body)) throw new ServiceUnavailableException()
    return body.access_token
  }

  private async fetchCandidates(userAccessToken: string) {
    const url = new URL('https://graph.facebook.com/v22.0/me/accounts')
    url.search = new URLSearchParams({
      fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}',
      access_token: userAccessToken,
    }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok || !this.hasPages(body)) throw new ServiceUnavailableException()
    return body.data.flatMap((page) => this.candidatesForPage(page))
  }

  private candidatesForPage(page: MetaPage) {
    if (!page.id || !page.name || !page.access_token) return []
    const pageCandidate = {
      externalId: page.id,
      displayName: page.name,
      description: 'Página de Facebook',
      publicMetadata: { kind: 'facebook_page' },
      context: {
        externalId: page.id,
        displayName: page.name,
        handle: null,
        profileUrl: `https://www.facebook.com/${page.id}`,
        avatarUrl: page.picture?.data?.url ?? null,
        accessToken: page.access_token,
      },
    }
    const instagram = page.instagram_business_account
    if (!instagram?.id) return [pageCandidate]
    return [
      pageCandidate,
      {
        externalId: instagram.id,
        displayName: instagram.username ?? page.name,
        description: 'Perfil profesional de Instagram',
        publicMetadata: { kind: 'instagram_profile' },
        context: {
          externalId: instagram.id,
          displayName: instagram.username ?? page.name,
          handle: instagram.username ? `@${instagram.username}` : null,
          profileUrl: instagram.username ? `https://www.instagram.com/${instagram.username}/` : null,
          avatarUrl: instagram.profile_picture_url ?? null,
          accessToken: page.access_token,
        },
      },
    ]
  }

  private authorizationUrl(
    clientId: string,
    state: string,
    scopes: MetaOAuthScope[],
  ) {
    const url = new URL('https://www.facebook.com/v22.0/dialog/oauth')
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.callbackUrl(),
      response_type: 'code',
      scope: scopes.join(','),
      state,
    }).toString()
    return url.toString()
  }

  private callbackUrl() {
    return new URL('/v1/oauth/channels/meta/callback', this.config.getOrThrow<string>('API_PUBLIC_ORIGIN')).toString()
  }

  private async connectionForSession(session: PortalAuthSession, id: string) {
    const [connection] = await this.database.db
      .select()
      .from(channelConnectionSessions)
      .where(
        and(
          eq(channelConnectionSessions.id, this.parseId(id)),
          eq(channelConnectionSessions.workspaceId, session.workspace.id),
          eq(channelConnectionSessions.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!connection) throw new NotFoundException()
    return connection
  }

  private async accountForWorkspace(session: PortalAuthSession, id: string) {
    const [account] = await this.database.db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.id, this.parseId(id)), eq(socialAccounts.workspaceId, session.workspace.id), eq(socialAccounts.providerKey, 'meta')))
      .limit(1)
    if (!account || !this.isMetaCapability(account.capabilityKey)) throw new NotFoundException()
    return account
  }

  private isMetaCapability(
    capabilityKey: string,
  ): capabilityKey is MetaCapabilityKey {
    return metaCapabilities.has(capabilityKey as MetaCapabilityKey)
  }

  private metaScopes(
    configuration: { capabilityScopes?: MetaCapabilityScopes },
    capabilityKey: MetaCapabilityKey,
  ): MetaOAuthScope[] {
    const scopes = configuration.capabilityScopes?.[capabilityKey]
    if (!scopes) throw new ServiceUnavailableException()
    return scopes
  }

  private async assertReconnectAccount(session: PortalAuthSession, id: string, capabilityKey: string) {
    const account = await this.accountForWorkspace(session, id)
    if (account.capabilityKey !== capabilityKey) throw new BadRequestException()
  }

  private decryptContext(connection: ConnectionRow): MetaConnectionContext {
    if (!connection.contextCiphertext) throw new BadRequestException()
    try {
      const value: unknown = JSON.parse(this.encryption().decrypt(connection.contextCiphertext, `channel-connection:${connection.id}`))
      if (!value || typeof value !== 'object' || !('candidates' in value)) throw new Error('Invalid context')
      return value as MetaConnectionContext
    } catch {
      throw new BadRequestException()
    }
  }

  private encryptContext(id: string, context: MetaConnectionContext) {
    return this.encryption().encrypt(JSON.stringify(context), `channel-connection:${id}`)
  }

  private encryption() {
    return new Aes256GcmService(this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'))
  }

  private serializeConnection(connection: ConnectionRow): PortalChannelConnection {
    const state = connection.status as PortalChannelConnection['state']
    return { id: connection.id, capabilityKey: connection.capabilityKey as PortalChannelConnection['capabilityKey'], state, expiresAt: connection.expiresAt.toISOString() }
  }

  private serializeAccount(account: typeof socialAccounts.$inferSelect): PortalChannelAccount {
    return {
      id: account.id,
      provider: 'meta',
      capabilityKey: account.capabilityKey as PortalChannelAccount['capabilityKey'],
      displayName: account.displayName,
      handle: account.handle,
      profileUrl: account.profileUrl,
      avatarUrl: account.avatarUrl,
      status: 'connected',
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    }
  }

  private publicMetadata(metadata: Record<string, unknown>) {
    return typeof metadata.kind === 'string' ? metadata.kind : null
  }

  private parseCallback(value: unknown) {
    if (!value || typeof value !== 'object' || !('state' in value) || typeof value.state !== 'string') throw new BadRequestException()
    const query = value as { state: string; code?: unknown; error?: unknown }
    if (query.code !== undefined && typeof query.code !== 'string') throw new BadRequestException()
    if (query.error !== undefined && typeof query.error !== 'string') throw new BadRequestException()
    return { state: query.state, code: query.code, error: query.error }
  }

  private hasAccessToken(value: unknown): value is { access_token: string } {
    return Boolean(value && typeof value === 'object' && 'access_token' in value && typeof value.access_token === 'string')
  }

  private hasPages(value: unknown): value is { data: MetaPage[] } {
    return Boolean(value && typeof value === 'object' && 'data' in value && Array.isArray(value.data))
  }

  private parseId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException()
    return id
  }

  private requireManager(session: PortalAuthSession) {
    if (!managerRoles.has(session.workspace.role)) throw new ForbiddenException()
  }

  private parse<T>(result: { success: true; data: T } | { success: false }): T {
    if (!result.success) throw new BadRequestException()
    return result.data
  }
}
