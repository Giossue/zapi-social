import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  channelConnectionSessions,
  socialAccounts,
} from '@workspace/database'
import {
  startWhatsAppStatusConnectionSchema,
  type PortalAuthSession,
  type PortalChannelAccount,
  type PortalChannelConnection,
} from '@workspace/contracts'
import { and, eq, gt } from '@workspace/database/query'
import { randomUUID } from 'node:crypto'
import { Redis } from 'ioredis'
import { DatabaseService } from '../database/database.service'
import { IntegrationsService } from '../integrations/integrations.service'
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service'

const managerRoles = new Set(['owner', 'admin'])
const lifetimeMilliseconds = 10 * 60 * 1000
const providerKey = 'whatsapp-status'
const capabilityKey = 'whatsapp_status'

type ConnectionRow = typeof channelConnectionSessions.$inferSelect
type GoWaConfiguration = Awaited<
  ReturnType<IntegrationsService['readWhatsAppStatusConfiguration']>
>
type ConnectionContext = {
  displayName: string
  qrLink: string
}
type GoWaResponse = {
  code?: string
  results?: Record<string, unknown>
  message?: string
}

class GoWaConnectorError extends Error {}

@Injectable()
export class WhatsAppStatusConnectionsService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly integrations: IntegrationsService,
  ) {}

  async start(session: PortalAuthSession, input: unknown) {
    this.requireManager(session)
    const values = this.parse(startWhatsAppStatusConnectionSchema.safeParse(input))
    const configuration = await this.integrations.readWhatsAppStatusConfiguration()
    const reconnect = values.reconnectAccountId
      ? await this.reconnectAccount(session, values.reconnectAccountId)
      : null

    if (reconnect) await this.purgeDevice(configuration, this.deviceId(reconnect.metadata))

    let deviceId: string = randomUUID()
    const expiresAt = new Date(Date.now() + lifetimeMilliseconds)
    try {
      deviceId = await this.createDevice(configuration, deviceId)
      const qrLink = await this.startQr(configuration, deviceId)
      const [connection] = await this.database.db
        .insert(channelConnectionSessions)
        .values({
          workspaceId: session.workspace.id,
          userId: session.user.id,
          capabilityKey,
          reconnectAccountId: reconnect?.id ?? null,
          externalConnectionId: deviceId,
          contextCiphertext: this.encryptContext(deviceId, {
            displayName: reconnect?.displayName ?? 'WhatsApp Status',
            qrLink,
          }),
          status: 'qr_ready',
          expiresAt,
        })
        .returning()
      return {
        connection: this.serializeConnection(connection),
        qrEndpoint: `/v1/portal/channel-connections/${connection.id}/qr`,
      }
    } catch (error) {
      await this.purgeDevice(configuration, deviceId).catch(() => undefined)
      if (error instanceof GoWaConnectorError) throw new ServiceUnavailableException()
      throw error
    }
  }

  async status(session: PortalAuthSession, id: string) {
    this.requireManager(session)
    const connection = await this.connectionForSession(session, id)
    if (connection.status === 'connected') {
      return { connection: this.serializeConnection(connection), account: await this.connectionAccount(connection), publicError: null }
    }
    if (!['qr_ready', 'waiting_for_scan'].includes(connection.status)) {
      return { connection: this.serializeConnection(connection), account: null, publicError: null }
    }
    if (connection.expiresAt <= new Date()) {
      const updated = await this.updateConnection(connection.id, { status: 'expired' })
      return { connection: this.serializeConnection(updated), account: null, publicError: null }
    }

    const deviceId = connection.externalConnectionId
    if (!deviceId) throw new BadRequestException()
    return this.withDeviceLock(deviceId, async () => {
      const current = await this.connectionForSession(session, id)
      if (current.status === 'connected') {
        return { connection: this.serializeConnection(current), account: await this.connectionAccount(current), publicError: null }
      }
      const configuration = await this.integrations.readWhatsAppStatusConfiguration()
      try {
        const providerStatus = await this.requestJson(configuration, `/devices/${encodeURIComponent(deviceId)}/status`)
        if (!this.isLoggedIn(providerStatus)) {
          const updated = await this.updateConnection(current.id, { status: 'waiting_for_scan' })
          return { connection: this.serializeConnection(updated), account: null, publicError: null }
        }
        const account = await this.persistConnectedDevice(current, configuration, providerStatus)
        const updated = await this.updateConnection(current.id, { socialAccountId: account.id, status: 'connected' })
        return { connection: this.serializeConnection(updated), account: this.serializeAccount(account), publicError: null }
      } catch {
        const updated = await this.updateConnection(current.id, { status: 'failed' })
        return {
          connection: this.serializeConnection(updated),
          account: null,
          publicError: { code: 'WHATSAPP_CONNECTOR_UNAVAILABLE', requestId: randomUUID() },
        }
      }
    })
  }

  async qr(session: PortalAuthSession, id: string) {
    this.requireManager(session)
    const connection = await this.connectionForSession(session, id)
    if (!['qr_ready', 'waiting_for_scan'].includes(connection.status) || connection.expiresAt <= new Date()) {
      throw new NotFoundException()
    }
    const context = this.decryptContext(connection)
    if (context.qrLink.startsWith('data:image/')) return this.dataQr(context.qrLink)

    const configuration = await this.integrations.readWhatsAppStatusConfiguration()
    const url = this.safeQrUrl(configuration, context.qrLink)
    try {
      const response = await fetch(url, { headers: this.headers(configuration), redirect: 'error', signal: AbortSignal.timeout(10_000) })
      if (!response.ok) throw new Error('QR unavailable')
      const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'image/png'
      if (!contentType.startsWith('image/')) throw new Error('Unexpected QR content type')
      return { body: Buffer.from(await response.arrayBuffer()), contentType }
    } catch {
      throw new ServiceUnavailableException()
    }
  }

  async cancel(session: PortalAuthSession, id: string): Promise<PortalChannelConnection> {
    this.requireManager(session)
    const connection = await this.connectionForSession(session, id)
    if (connection.status === 'connected') throw new BadRequestException()
    if (connection.externalConnectionId) {
      const configuration = await this.integrations.readWhatsAppStatusConfiguration()
      await this.purgeDevice(configuration, connection.externalConnectionId)
    }
    return this.serializeConnection(await this.updateConnection(connection.id, { status: 'cancelled' }))
  }

  async purgeAccountDevice(account: typeof socialAccounts.$inferSelect) {
    if (account.providerKey !== providerKey || account.capabilityKey !== capabilityKey) return
    const deviceId = this.deviceId(account.metadata)
    if (!deviceId) return
    await this.purgeDevice(await this.integrations.readWhatsAppStatusConfiguration(), deviceId)
  }

  private async persistConnectedDevice(connection: ConnectionRow, configuration: GoWaConfiguration, status: GoWaResponse) {
    const deviceId = connection.externalConnectionId
    if (!deviceId) throw new BadRequestException()
    const context = this.decryptContext(connection)
    const profile = await this.profile(configuration, deviceId, status)
    const [previous] = connection.reconnectAccountId
      ? await this.database.db.select().from(socialAccounts).where(eq(socialAccounts.id, connection.reconnectAccountId)).limit(1)
      : []
    const values = {
      externalId: deviceId,
      displayName: profile.displayName ?? context.displayName,
      handle: profile.phoneNumber ?? null,
      avatarUrl: profile.avatarUrl,
      profileUrl: null,
      metadata: {
        ...previous?.metadata,
        externalDisplayName: profile.displayName ?? context.displayName,
        provider: 'gowa',
        deviceId,
        phoneNumber: profile.phoneNumber,
        targetJid: 'status@broadcast',
      },
      status: 'active',
      connectedAt: new Date(),
      disconnectedAt: null,
      updatedAt: new Date(),
    }
    if (previous) {
      return (await this.database.db.update(socialAccounts).set(values).where(eq(socialAccounts.id, previous.id)).returning())[0]
    }
    return (await this.database.db.insert(socialAccounts).values({
      workspaceId: connection.workspaceId,
      providerKey,
      capabilityKey,
      ...values,
    }).returning())[0]
  }

  private async profile(configuration: GoWaConfiguration, deviceId: string, status: GoWaResponse) {
    const [info, device] = await Promise.all([
      this.requestJson(configuration, '/user/info', deviceId).catch(() => ({})),
      this.requestJson(configuration, `/devices/${encodeURIComponent(deviceId)}`).catch(() => ({})),
    ])
    const phoneNumber = this.firstString(info, ['results.phone_number', 'results.phone', 'results.jid'])
      ?? this.firstString(device, ['results.phone_number', 'results.phone', 'results.jid'])
      ?? this.firstString(status, ['results.phone_number', 'results.phone', 'results.jid'])
    const avatar = phoneNumber
      ? await this.requestJson(configuration, `/user/avatar?phone=${encodeURIComponent(phoneNumber)}&is_preview=false&is_community=false`, deviceId).catch(() => ({}))
      : {}
    return {
      displayName: this.firstString(info, ['results.verified_name', 'results.push_name', 'results.display_name', 'results.name'])
        ?? this.firstString(device, ['results.verified_name', 'results.push_name', 'results.display_name', 'results.name']),
      phoneNumber,
      avatarUrl: this.safeHttpUrl(this.firstString(avatar, ['results.url'])),
    }
  }

  private async createDevice(configuration: GoWaConfiguration, deviceId: string) {
    const result = await this.requestJson(configuration, '/devices', undefined, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    })
    return this.firstString(result, ['results.id', 'results.device_id']) ?? deviceId
  }

  private async startQr(configuration: GoWaConfiguration, deviceId: string) {
    const attempts = [
      () => this.requestJson(configuration, '/app/login', deviceId),
      () => this.requestJson(configuration, `/devices/${encodeURIComponent(deviceId)}/login`),
    ]
    for (const request of attempts) {
      try {
        const result = await request()
        const qr = this.firstString(result, ['results.qr_link', 'results.qr_url', 'results.qr', 'results.qrcode', 'qr_link', 'qr_url', 'qr', 'qrcode'])
        if (qr) return qr
      } catch {
        // Fallback supported by legacy GOWA deployments.
      }
    }
    throw new GoWaConnectorError()
  }

  private async purgeDevice(configuration: GoWaConfiguration, deviceId: string | null) {
    if (!deviceId) return
    try {
      await this.requestJson(configuration, `/devices/${encodeURIComponent(deviceId)}/logout`, undefined, { method: 'POST' })
    } catch {
      try {
        await this.requestJson(configuration, `/devices/${encodeURIComponent(deviceId)}`, undefined, { method: 'DELETE' })
      } catch {
        throw new ServiceUnavailableException()
      }
    }
  }

  private async requestJson(configuration: GoWaConfiguration, path: string, deviceId?: string, init: RequestInit = {}): Promise<GoWaResponse> {
    const response = await fetch(new URL(path.replace(/^\/+/, ''), `${configuration.baseUrl.replace(/\/+$/, '')}/`), {
      ...init,
      headers: { accept: 'application/json', ...this.headers(configuration), ...(deviceId ? { 'x-device-id': deviceId } : {}), ...init.headers },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok || !this.isSuccess(body)) throw new GoWaConnectorError()
    return body
  }

  private headers(configuration: GoWaConfiguration) {
    return { authorization: `Basic ${Buffer.from(`${configuration.basicAuthUsername}:${configuration.basicAuthPassword}`).toString('base64')}` }
  }

  private isSuccess(value: unknown): value is GoWaResponse {
    return Boolean(value && typeof value === 'object' && (!('code' in value) || String(value.code).toUpperCase() === 'SUCCESS'))
  }

  private isLoggedIn(value: GoWaResponse) {
    const state = this.firstString(value, ['results.status', 'results.state', 'results.connection_status'])?.toLowerCase()
    return state === 'connected' || state === 'logged_in' || state === 'loggedin' || this.firstBoolean(value, ['results.logged_in', 'results.is_logged_in', 'results.connected']) === true
  }

  private firstString(value: unknown, paths: string[]) {
    for (const path of paths) {
      let current: unknown = value
      for (const segment of path.split('.')) current = current && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined
      if (typeof current === 'string' && current.trim()) return current.trim()
    }
    return null
  }

  private firstBoolean(value: unknown, paths: string[]) {
    for (const path of paths) {
      let current: unknown = value
      for (const segment of path.split('.')) current = current && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined
      if (typeof current === 'boolean') return current
    }
    return null
  }

  private safeQrUrl(configuration: GoWaConfiguration, qrLink: string) {
    const url = new URL(qrLink, `${configuration.baseUrl}/`)
    const base = new URL(configuration.baseUrl)
    if (url.origin !== base.origin || url.username || url.password) throw new NotFoundException()
    return url
  }

  private dataQr(value: string) {
    const [metadata, encoded] = value.split(',', 2)
    const contentType = metadata.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/)?.[1]
    if (!contentType || !encoded) throw new NotFoundException()
    const body = Buffer.from(encoded, 'base64')
    if (!body.length) throw new NotFoundException()
    return { body, contentType }
  }

  private safeHttpUrl(value: string | null) {
    if (!value) return null
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
    } catch {
      return null
    }
  }

  private async connectionForSession(session: PortalAuthSession, id: string) {
    const [connection] = await this.database.db.select().from(channelConnectionSessions).where(and(
      eq(channelConnectionSessions.id, this.parseId(id)),
      eq(channelConnectionSessions.workspaceId, session.workspace.id),
      eq(channelConnectionSessions.userId, session.user.id),
      eq(channelConnectionSessions.capabilityKey, capabilityKey),
    )).limit(1)
    if (!connection) throw new NotFoundException()
    return connection
  }

  private async reconnectAccount(session: PortalAuthSession, id: string) {
    const [account] = await this.database.db.select().from(socialAccounts).where(and(
      eq(socialAccounts.id, this.parseId(id)),
      eq(socialAccounts.workspaceId, session.workspace.id),
      eq(socialAccounts.providerKey, providerKey),
      eq(socialAccounts.capabilityKey, capabilityKey),
    )).limit(1)
    if (!account) throw new NotFoundException()
    return account
  }

  private async connectionAccount(connection: ConnectionRow) {
    if (!connection.socialAccountId) return null
    const [account] = await this.database.db.select().from(socialAccounts).where(eq(socialAccounts.id, connection.socialAccountId)).limit(1)
    return account ? this.serializeAccount(account) : null
  }

  private async updateConnection(id: string, values: Partial<typeof channelConnectionSessions.$inferInsert>) {
    return (await this.database.db.update(channelConnectionSessions).set({ ...values, updatedAt: new Date() }).where(eq(channelConnectionSessions.id, id)).returning())[0]
  }

  private encryptContext(deviceId: string, context: ConnectionContext) {
    return this.encryption().encrypt(JSON.stringify(context), `whatsapp-status:${deviceId}`)
  }

  private decryptContext(connection: ConnectionRow): ConnectionContext {
    if (!connection.contextCiphertext || !connection.externalConnectionId) throw new BadRequestException()
    try {
      const value: unknown = JSON.parse(this.encryption().decrypt(connection.contextCiphertext, `whatsapp-status:${connection.externalConnectionId}`))
      if (!value || typeof value !== 'object' || typeof (value as ConnectionContext).qrLink !== 'string') throw new Error('Invalid context')
      return value as ConnectionContext
    } catch {
      throw new BadRequestException()
    }
  }

  private deviceId(metadata: Record<string, unknown>) {
    const value = metadata.deviceId
    return typeof value === 'string' && value.length > 0 && value.length <= 255 ? value : null
  }

  private serializeConnection(connection: ConnectionRow): PortalChannelConnection {
    return { id: connection.id, capabilityKey, state: connection.status as PortalChannelConnection['state'], expiresAt: connection.expiresAt.toISOString() }
  }

  private serializeAccount(account: typeof socialAccounts.$inferSelect): PortalChannelAccount {
    return {
      id: account.id,
      provider: 'whatsapp',
      capabilityKey,
      displayName: account.displayName,
      externalName: typeof account.metadata.externalDisplayName === 'string' ? account.metadata.externalDisplayName : null,
      handle: account.handle,
      profileUrl: account.profileUrl,
      avatarUrl: account.avatarUrl,
      status: account.status === 'active' && !account.disconnectedAt ? 'connected' : 'disconnected',
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    }
  }

  private async withDeviceLock<T>(deviceId: string, callback: () => Promise<T>): Promise<T> {
    const redis = new Redis({ host: this.config.get('REDIS_HOST'), port: Number(this.config.get('REDIS_PORT')), username: this.config.get('REDIS_USERNAME'), password: this.config.get('REDIS_PASSWORD'), maxRetriesPerRequest: 0 })
    const key = `channels:whatsapp-status:${deviceId}`
    const token = randomUUID()
    try {
      if ((await redis.set(key, token, 'PX', 10_000, 'NX')) !== 'OK') throw new ConflictException()
      return await callback()
    } finally {
      try {
        if ((await redis.get(key)) === token) await redis.del(key)
      } finally {
        await redis.quit()
      }
    }
  }

  private encryption() {
    return new Aes256GcmService(this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'))
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
