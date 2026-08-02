import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { type Job } from 'bullmq'
import { DatabaseService } from '../database/database.service'
import { Aes256GcmService, DecryptionFailedError } from '../platform/crypto/aes-256-gcm.service'
import {
  WHATSAPP_PROFILE_SYNC_CONCURRENCY,
  WHATSAPP_PROFILE_SYNC_DUE_INTERVAL_MS,
  WHATSAPP_PROFILE_SYNC_JOB,
  WHATSAPP_PROFILE_SYNC_QUEUE,
  type WhatsAppProfileSyncJobData,
} from './whatsapp-profile-sync.constants'

const providerKey = 'whatsapp-status'
const capabilityKey = 'whatsapp_status'

type WhatsAppAccount = {
  id: string
  externalId: string | null
  displayName: string
  handle: string | null
  avatarUrl: string | null
  metadata: Record<string, unknown>
}

type GoWaConfiguration = {
  baseUrl: string
  basicAuthUsername: string
  basicAuthPassword: string
}

type GoWaResponse = {
  code?: string
  results?: Record<string, unknown>
}

type ProfileSnapshot = {
  displayName?: string
  handle?: string
  avatarUrl?: string | null
}

class WhatsAppProfileSyncError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

@Injectable()
@Processor(WHATSAPP_PROFILE_SYNC_QUEUE, { concurrency: WHATSAPP_PROFILE_SYNC_CONCURRENCY })
export class WhatsAppProfileSyncProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
  ) {
    super()
  }

  async process(job: Job<WhatsAppProfileSyncJobData>): Promise<void> {
    if (job.name !== WHATSAPP_PROFILE_SYNC_JOB) return

    const account = await this.findActiveAccount(job.data.accountId)
    if (!account) return

    const auditId = await this.createAuditRun(account, job.id)
    try {
      const configuration = await this.readConfiguration()
      const deviceId = this.deviceId(account)
      if (!deviceId) throw new WhatsAppProfileSyncError('DEVICE_ID_MISSING')

      const profile = await this.fetchProfile(configuration, deviceId, account)
      await this.persistProfile(account, profile)
      await this.finishAuditRun(auditId, 'succeeded')
    } catch (error) {
      const errorCode = error instanceof WhatsAppProfileSyncError ? error.code : 'WHATSAPP_PROFILE_SYNC_FAILED'
      await this.finishAuditRun(auditId, 'failed', errorCode)
      throw new Error(errorCode)
    }
  }

  private async findActiveAccount(accountId: string): Promise<WhatsAppAccount | null> {
    const accounts = await this.database.client<WhatsAppAccount[]>`
      select
        id,
        external_id as "externalId",
        display_name as "displayName",
        handle,
        avatar_url as "avatarUrl",
        metadata
      from social_accounts
      where id = ${accountId}
        and provider_key = ${providerKey}
        and capability_key = ${capabilityKey}
        and status = 'active'
      limit 1
    `
    return accounts[0] ?? null
  }

  private async readConfiguration(): Promise<GoWaConfiguration> {
    const integrations = await this.database.client<{ configurationCiphertext: string | null }[]>`
      select configuration_ciphertext as "configurationCiphertext"
      from provider_integrations
      where provider_key = ${providerKey}
        and enabled = true
        and readiness = 'ready'
      limit 1
    `
    const ciphertext = integrations[0]?.configurationCiphertext
    if (!ciphertext) throw new WhatsAppProfileSyncError('INTEGRATION_NOT_READY')

    let value: unknown
    try {
      value = JSON.parse(this.encryption.decrypt(ciphertext, providerKey))
    } catch (error) {
      if (error instanceof DecryptionFailedError) {
        throw new WhatsAppProfileSyncError('CONFIGURATION_DECRYPTION_FAILED')
      }
      throw new WhatsAppProfileSyncError('CONFIGURATION_INVALID')
    }

    const configuration = this.parseConfiguration(value)
    if (!configuration) throw new WhatsAppProfileSyncError('CONFIGURATION_INVALID')
    return configuration
  }

  private async createAuditRun(account: WhatsAppAccount, jobId: string | undefined): Promise<string> {
    const runs = await this.database.client<{ id: string }[]>`
      insert into channel_sync_runs (
        social_account_id,
        status,
        job_id,
        started_at,
        metadata
      )
      values (
        ${account.id},
        'running',
        ${jobId ?? null},
        now(),
        ${JSON.stringify({ operation: 'whatsapp_profile_sync', capabilityKey })}::jsonb
      )
      returning id
    `
    const auditId = runs[0]?.id
    if (!auditId) throw new WhatsAppProfileSyncError('AUDIT_WRITE_FAILED')
    return auditId
  }

  private async finishAuditRun(auditId: string, status: 'succeeded' | 'failed', errorCode?: string) {
    await this.database.client`
      update channel_sync_runs
      set status = ${status}, error_code = ${errorCode ?? null}, finished_at = now()
      where id = ${auditId}
    `
  }

  private async fetchProfile(
    configuration: GoWaConfiguration,
    deviceId: string,
    account: WhatsAppAccount,
  ): Promise<ProfileSnapshot> {
    const info = await this.requestJson(configuration, '/user/info', deviceId)
    const infoDisplayName = this.firstString(info, [
      'results.verified_name',
      'results.push_name',
      'results.display_name',
      'results.name',
    ])
    const infoPhone = this.firstString(info, ['results.phone_number', 'results.phone', 'results.jid'])
    const knownPhone = this.firstString(account.metadata, ['phoneNumber']) ?? account.handle

    const device = !infoDisplayName || !infoPhone
      ? await this.requestJson(configuration, `/devices/${encodeURIComponent(deviceId)}`, deviceId)
      : null
    const displayName = infoDisplayName ?? this.firstString(device, [
      'results.verified_name',
      'results.push_name',
      'results.display_name',
      'results.name',
    ])
    const handle = infoPhone ?? this.firstString(device, ['results.phone_number', 'results.phone', 'results.jid']) ?? knownPhone ?? undefined

    if (!handle) return displayName ? { displayName } : {}

    const avatar = await this.requestJson(
      configuration,
      `/user/avatar?phone=${encodeURIComponent(handle)}&is_preview=false&is_community=false`,
      deviceId,
    )
    return {
      ...(displayName ? { displayName } : {}),
      handle,
      avatarUrl: this.safeHttpUrl(this.firstString(avatar, ['results.url'])),
    }
  }

  private async persistProfile(account: WhatsAppAccount, profile: ProfileSnapshot) {
    const now = new Date()
    const externalDisplayName = typeof account.metadata.externalDisplayName === 'string'
      ? account.metadata.externalDisplayName
      : undefined
    const nextMetadata = {
      ...account.metadata,
      ...(profile.displayName && profile.displayName !== externalDisplayName
        ? { externalDisplayName: profile.displayName }
        : {}),
      profileSyncDueAt: new Date(now.getTime() + WHATSAPP_PROFILE_SYNC_DUE_INTERVAL_MS).toISOString(),
    }

    await this.database.client`
      update social_accounts
      set
        display_name = case when ${profile.displayName !== undefined && account.displayName !== profile.displayName} then ${profile.displayName ?? null} else display_name end,
        handle = case when ${profile.handle !== undefined && account.handle !== profile.handle} then ${profile.handle ?? null} else handle end,
        avatar_url = case when ${profile.avatarUrl !== undefined && account.avatarUrl !== profile.avatarUrl} then ${profile.avatarUrl ?? null} else avatar_url end,
        metadata = ${JSON.stringify(nextMetadata)}::jsonb,
        updated_at = ${now}
      where id = ${account.id}
    `
  }

  private async requestJson(configuration: GoWaConfiguration, path: string, deviceId: string): Promise<GoWaResponse> {
    let response: Response
    try {
      response = await fetch(new URL(path.replace(/^\/+/, ''), `${configuration.baseUrl}/`), {
        headers: {
          accept: 'application/json',
          authorization: `Basic ${Buffer.from(`${configuration.basicAuthUsername}:${configuration.basicAuthPassword}`).toString('base64')}`,
          'x-device-id': deviceId,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new WhatsAppProfileSyncError('GOWA_TIMEOUT')
      }
      throw new WhatsAppProfileSyncError('GOWA_REQUEST_FAILED')
    }

    const body: unknown = await response.json().catch(() => null)
    if (response.status === 401 || response.status === 403) throw new WhatsAppProfileSyncError('GOWA_UNAUTHORIZED')
    if (response.status === 429) throw new WhatsAppProfileSyncError('GOWA_RATE_LIMITED')
    if (!response.ok) throw new WhatsAppProfileSyncError('GOWA_REQUEST_REJECTED')
    if (!this.isSuccess(body)) throw new WhatsAppProfileSyncError('GOWA_RESPONSE_INVALID')
    return body
  }

  private parseConfiguration(value: unknown): GoWaConfiguration | null {
    if (!isRecord(value)) return null
    const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl.trim().replace(/\/+$/, '') : ''
    const basicAuthUsername = typeof value.basicAuthUsername === 'string' ? value.basicAuthUsername.trim() : ''
    const basicAuthPassword = typeof value.basicAuthPassword === 'string' ? value.basicAuthPassword.trim() : ''
    if (!baseUrl || !basicAuthUsername || !basicAuthPassword) return null

    try {
      const url = new URL(baseUrl)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    } catch {
      return null
    }

    return { baseUrl, basicAuthUsername, basicAuthPassword }
  }

  private deviceId(account: WhatsAppAccount): string | null {
    const metadataDeviceId = account.metadata.deviceId
    if (typeof metadataDeviceId === 'string' && metadataDeviceId.length > 0 && metadataDeviceId.length <= 255) {
      return metadataDeviceId
    }
    return account.externalId && account.externalId.length <= 255 ? account.externalId : null
  }

  private isSuccess(value: unknown): value is GoWaResponse {
    return Boolean(value && typeof value === 'object' && (!('code' in value) || String(value.code).toUpperCase() === 'SUCCESS'))
  }

  private firstString(value: unknown, paths: string[]): string | null {
    for (const path of paths) {
      let current: unknown = value
      for (const segment of path.split('.')) current = isRecord(current) ? current[segment] : undefined
      if (typeof current === 'string' && current.trim()) return current.trim()
    }
    return null
  }

  private safeHttpUrl(value: string | null): string | null {
    if (!value) return null
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
    } catch {
      return null
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
