import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { socialAccounts } from '@workspace/database'
import {
  portalChannelsQuerySchema,
  updatePortalChannelSchema,
  type PortalAuthSession,
  type PortalChannelAccount,
  type PortalChannelCapability,
  type PortalChannelsQuery,
  type PortalChannelsResponse,
} from '@workspace/contracts'
import { and, asc, desc, eq } from '@workspace/database/query'
import { DatabaseService } from '../database/database.service'

const managerRoles = new Set(['owner', 'admin'])
const capabilities: PortalChannelCapability[] = [
  {
    key: 'facebook_page',
    provider: 'meta',
    label: 'Página de Facebook',
    description: 'Publica en una página administrada de Facebook.',
    availability: 'ready',
    connectionKind: 'oauth_picker',
  },
  {
    key: 'instagram_profile',
    provider: 'meta',
    label: 'Perfil profesional de Instagram',
    description: 'Publica en un perfil profesional vinculado a una página.',
    availability: 'ready',
    connectionKind: 'oauth_picker',
  },
  {
    key: 'linkedin_page',
    provider: 'linkedin',
    label: 'Página de LinkedIn',
    description: 'Próximamente.',
    availability: 'coming_soon',
    connectionKind: 'oauth_picker',
  },
  {
    key: 'linkedin_profile',
    provider: 'linkedin',
    label: 'Perfil de LinkedIn',
    description: 'Próximamente.',
    availability: 'coming_soon',
    connectionKind: 'oauth_direct',
  },
  {
    key: 'x_profile',
    provider: 'x',
    label: 'Perfil de X',
    description: 'Próximamente.',
    availability: 'coming_soon',
    connectionKind: 'oauth_direct',
  },
  {
    key: 'tiktok_profile',
    provider: 'tiktok',
    label: 'Perfil de TikTok',
    description: 'Próximamente.',
    availability: 'coming_soon',
    connectionKind: 'oauth_direct',
  },
  {
    key: 'whatsapp_status',
    provider: 'whatsapp',
    label: 'Estados de WhatsApp',
    description: 'Próximamente.',
    availability: 'coming_soon',
    connectionKind: 'qr_device',
  },
]

type SocialAccountRow = typeof socialAccounts.$inferSelect

@Injectable()
export class ChannelsService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalChannelsResponse> {
    const filters = this.parse(portalChannelsQuerySchema.safeParse(query))
    const rows = await this.database.db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.workspaceId, session.workspace.id))
      .orderBy(
        filters.sort === 'display_name_asc'
          ? asc(socialAccounts.displayName)
          : filters.sort === 'updated_at_desc'
            ? desc(socialAccounts.updatedAt)
            : desc(socialAccounts.createdAt),
      )

    return {
      canManage: this.canManage(session),
      capabilities,
      accounts: rows
        .filter((account) => this.providerFor(account.providerKey) !== null)
        .map((account) => this.serialize(account))
        .filter((account) => this.matches(account, filters)),
    }
  }

  async updateDisplayName(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<PortalChannelAccount> {
    this.requireManager(session)
    const accountId = this.parseId(id)
    const values = this.parse(updatePortalChannelSchema.safeParse(input))
    const [account] = await this.database.db
      .update(socialAccounts)
      .set({ displayName: values.displayName, updatedAt: new Date() })
      .where(
        and(
          eq(socialAccounts.id, accountId),
          eq(socialAccounts.workspaceId, session.workspace.id),
        ),
      )
      .returning()

    if (!account) throw new NotFoundException()
    return this.serialize(account)
  }

  async remove(session: PortalAuthSession, id: string): Promise<void> {
    this.requireManager(session)
    const accountId = this.parseId(id)
    const [account] = await this.database.db
      .delete(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, accountId),
          eq(socialAccounts.workspaceId, session.workspace.id),
        ),
      )
      .returning({ id: socialAccounts.id })

    if (!account) throw new NotFoundException()
  }

  assertReconnectAccount(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalChannelAccount> {
    return this.findMetaAccount(session, id)
  }

  private async findMetaAccount(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalChannelAccount> {
    const accountId = this.parseId(id)
    const [account] = await this.database.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, accountId),
          eq(socialAccounts.workspaceId, session.workspace.id),
          eq(socialAccounts.providerKey, 'meta'),
        ),
      )
      .limit(1)
    if (!account) throw new BadRequestException()
    return this.serialize(account)
  }

  private matches(account: PortalChannelAccount, filters: PortalChannelsQuery) {
    if (filters.provider && account.provider !== filters.provider) return false
    if (filters.capability && account.capabilityKey !== filters.capability) return false
    if (filters.status && account.status !== filters.status) return false
    if (!filters.q) return true
    const search = filters.q.toLocaleLowerCase()
    return [account.displayName, account.handle, account.provider, account.capabilityKey]
      .filter((value): value is string => value !== null)
      .some((value) => value.toLocaleLowerCase().includes(search))
  }

  private serialize(account: SocialAccountRow): PortalChannelAccount {
    const provider = this.providerFor(account.providerKey)
    if (!provider) throw new BadRequestException()
    const capabilityKey = account.capabilityKey as PortalChannelAccount['capabilityKey']
    return {
      id: account.id,
      provider,
      capabilityKey,
      displayName: account.displayName,
      externalName: this.externalName(account.metadata),
      handle: account.handle,
      profileUrl: account.profileUrl,
      avatarUrl: account.avatarUrl,
      status: account.status === 'active' && !account.disconnectedAt ? 'connected' : 'disconnected',
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    }
  }

  private externalName(metadata: Record<string, unknown>) {
    const value = metadata.externalDisplayName
    return typeof value === 'string' && value.length > 0 && value.length <= 255 ? value : null
  }

  private providerFor(providerKey: string): PortalChannelAccount['provider'] | null {
    if (providerKey === 'facebook') return 'meta'
    if (providerKey === 'meta' || providerKey === 'linkedin' || providerKey === 'x' || providerKey === 'tiktok') return providerKey
    if (providerKey === 'whatsapp-status') return 'whatsapp'
    return null
  }

  private parseId(id: string) {
    // Validate at the boundary to avoid driver errors.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException()
    }
    return id
  }

  private canManage(session: PortalAuthSession) {
    return managerRoles.has(session.workspace.role)
  }

  private requireManager(session: PortalAuthSession) {
    if (!this.canManage(session)) throw new ForbiddenException()
  }

  private parse<T>(result: { success: true; data: T } | { success: false }): T {
    if (!result.success) throw new BadRequestException()
    return result.data
  }
}
