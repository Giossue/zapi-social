import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { socialAccounts } from '@workspace/database';
import {
  portalChannelsQuerySchema,
  updatePortalChannelSchema,
  type PortalAuthSession,
  type PortalChannelAccount,
  type PortalChannelCapability,
  type PortalChannelProviderKey,
  type PortalChannelsQuery,
  type PortalChannelsResponse,
} from '@workspace/contracts';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  sql,
} from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import { ChannelProviderIntegrationsService } from '../integrations/channel-provider-integrations.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { TeamAccountAccessService } from '../teams/team-account-access.service';
import { WhatsAppStatusConnectionsService } from './whatsapp-status-connections.service';

const managerRoles = new Set(['owner', 'admin']);
const capabilities: Omit<PortalChannelCapability, 'availability'>[] = [
  {
    key: 'facebook_page',
    provider: 'meta',
    connectionKind: 'oauth_picker',
  },
  {
    key: 'instagram_profile',
    provider: 'meta',
    connectionKind: 'oauth_picker',
  },
  {
    key: 'linkedin_page',
    provider: 'linkedin',
    connectionKind: 'oauth_picker',
  },
  {
    key: 'linkedin_profile',
    provider: 'linkedin',
    connectionKind: 'oauth_direct',
  },
  {
    key: 'x_profile',
    provider: 'x',
    connectionKind: 'oauth_direct',
  },
  {
    key: 'tiktok_profile',
    provider: 'tiktok',
    connectionKind: 'oauth_direct',
  },
  {
    key: 'whatsapp_status',
    provider: 'whatsapp',
    connectionKind: 'qr_device',
  },
];

type SocialAccountRow = typeof socialAccounts.$inferSelect;
type Condition = ReturnType<(typeof socialAccounts.id)['getSQL']>;
type ChannelSort = PortalChannelsQuery['sort'];
type ChannelCursor = {
  version: 1;
  sort: ChannelSort;
  value: string;
  id: string;
};

@Injectable()
export class ChannelsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly integrations: IntegrationsService,
    private readonly channelProviders: ChannelProviderIntegrationsService,
    private readonly whatsapp: WhatsAppStatusConnectionsService,
    private readonly accountAccess: TeamAccountAccessService,
  ) {}

  async list(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalChannelsResponse> {
    const filters = this.parse(portalChannelsQuerySchema.safeParse(query));
    const scope = await this.accountAccess.resolve(session);
    const accountScopeWhere = scope.unrestricted
      ? undefined
      : scope.accountIds.size
        ? inArray(socialAccounts.id, [...scope.accountIds])
        : sql`false`;
    const baseWhere = this.listWhere(
      session.workspace.id,
      filters,
      accountScopeWhere,
    );
    const pageWhere = filters.cursor
      ? and(
          baseWhere,
          this.cursorWhere(
            filters.sort,
            this.decodeCursor(filters.cursor, filters.sort),
          ),
        )!
      : baseWhere;

    const [rows, totals, connectedTotals] = await Promise.all([
      this.database.db
        .select()
        .from(socialAccounts)
        .where(pageWhere)
        .orderBy(...this.orderBy(filters.sort))
        .limit(filters.limit + 1),
      this.database.db
        .select({ total: count() })
        .from(socialAccounts)
        .where(baseWhere),
      this.database.db
        .select({ connected: count() })
        .from(socialAccounts)
        .where(and(baseWhere, this.connectedWhere())),
    ]);

    const hasNextPage = rows.length > filters.limit;
    const pageRows = hasNextPage ? rows.slice(0, filters.limit) : rows;
    const total = Number(totals[0]?.total ?? 0);
    const connected = Number(connectedTotals[0]?.connected ?? 0);
    const lastAccount = pageRows.at(-1);

    const portalCapabilities = await this.portalCapabilities();

    return {
      canManage: this.canManage(session),
      capabilities: portalCapabilities,
      accounts: pageRows.map((account) => this.serialize(account)),
      pagination: {
        limit: filters.limit,
        nextCursor:
          hasNextPage && lastAccount
            ? this.encodeCursor(lastAccount, filters.sort)
            : null,
      },
      summary: {
        total,
        connected,
        disconnected: total - connected,
      },
    };
  }

  async updateDisplayName(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<PortalChannelAccount> {
    this.requireManager(session);
    const accountId = this.parseId(id);
    const values = this.parse(updatePortalChannelSchema.safeParse(input));
    const [account] = await this.database.db
      .update(socialAccounts)
      .set({ displayName: values.displayName, updatedAt: new Date() })
      .where(
        and(
          eq(socialAccounts.id, accountId),
          eq(socialAccounts.workspaceId, session.workspace.id),
        ),
      )
      .returning();

    if (!account) throw new NotFoundException();
    return this.serialize(account);
  }

  async remove(session: PortalAuthSession, id: string): Promise<void> {
    this.requireManager(session);
    const accountId = this.parseId(id);
    const [existing] = await this.database.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, accountId),
          eq(socialAccounts.workspaceId, session.workspace.id),
        ),
      )
      .limit(1);
    if (!existing) throw new NotFoundException();

    await this.whatsapp.purgeAccountDevice(existing);
    await this.database.db
      .delete(socialAccounts)
      .where(eq(socialAccounts.id, existing.id));
  }

  assertReconnectAccount(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalChannelAccount> {
    return this.findMetaAccount(session, id);
  }

  private async findMetaAccount(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalChannelAccount> {
    const accountId = this.parseId(id);
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
      .limit(1);
    if (!account) throw new BadRequestException();
    return this.serialize(account);
  }

  /**
   * La disponibilidad de un canal la decide su integración de Admin, no una
   * constante: mientras el proveedor esté apagado, sin credenciales o sin
   * prueba vigente, el Portal lo enseña como «Próximamente» y no deja
   * conectarlo. Un proveedor sin pantalla de Admin todavía tampoco está listo.
   */
  private async portalCapabilities(): Promise<PortalChannelCapability[]> {
    const ready = await this.readyCapabilityKeys();
    return capabilities.map((capability) => ({
      ...capability,
      availability: ready.has(capability.key) ? 'ready' : 'coming_soon',
    }));
  }

  private async readyCapabilityKeys(): Promise<Set<string>> {
    const [meta, whatsApp] = await Promise.all([
      this.integrations.getMeta(),
      this.integrations.getWhatsAppStatus(),
    ]);

    const ready = new Set(await this.channelProviders.readyCapabilityKeys());
    for (const integration of [meta, whatsApp]) {
      // `readiness` ya exige credenciales guardadas y una prueba que coincida
      // con ellas; el interruptor por capability es lo que decide cada canal.
      if (!integration.enabled || integration.readiness !== 'ready') continue;
      for (const capability of integration.capabilities) {
        if (capability.enabled) ready.add(capability.key);
      }
    }
    return ready;
  }

  private listWhere(
    workspaceId: string,
    filters: PortalChannelsQuery,
    accountScopeWhere?: Condition,
  ): Condition {
    const conditions: Condition[] = [
      eq(socialAccounts.workspaceId, workspaceId),
      this.capabilityScopeWhere(),
    ];

    if (accountScopeWhere) conditions.push(accountScopeWhere);

    if (filters.provider) conditions.push(this.providerWhere(filters.provider));
    if (filters.capability) {
      conditions.push(eq(socialAccounts.capabilityKey, filters.capability));
    }
    if (filters.status === 'connected') conditions.push(this.connectedWhere());
    if (filters.status === 'disconnected')
      conditions.push(this.disconnectedWhere());
    if (filters.q) conditions.push(this.searchWhere(filters.q));

    return and(...conditions)!;
  }

  /** Only Portal-supported provider/capability pairs are ever queried or counted. */
  private capabilityScopeWhere(): Condition {
    return this.anyOf(
      capabilities.map((capability) =>
        and(
          eq(socialAccounts.capabilityKey, capability.key),
          this.providerWhere(capability.provider),
        )!,
      ),
    );
  }

  private providerWhere(provider: PortalChannelProviderKey): Condition {
    const providerKeys =
      provider === 'meta'
        ? ['meta', 'facebook', 'whatsapp-status']
        : provider === 'whatsapp'
          ? ['whatsapp-status']
          : [provider];

    return providerKeys.length === 1
      ? eq(socialAccounts.providerKey, providerKeys[0])
      : this.anyOf(
          providerKeys.map((providerKey) =>
            eq(socialAccounts.providerKey, providerKey),
          ),
        );
  }

  private connectedWhere(): Condition {
    return and(
      eq(socialAccounts.status, 'active'),
      isNull(socialAccounts.disconnectedAt),
    )!;
  }

  private disconnectedWhere(): Condition {
    return sql`${socialAccounts.status} <> ${'active'} or ${socialAccounts.disconnectedAt} is not null`;
  }

  private searchWhere(query: string): Condition {
    const search = `%${query}%`;
    const normalized = query.toLocaleLowerCase();
    const conditions: Condition[] = [
      sql`${socialAccounts.displayName} ilike ${search}`,
      sql`${socialAccounts.handle} ilike ${search}`,
      sql`${socialAccounts.capabilityKey} ilike ${search}`,
    ];

    for (const capability of capabilities) {
      if (capability.provider.includes(normalized)) {
        conditions.push(this.providerWhere(capability.provider));
      }
    }

    return this.anyOf(conditions);
  }

  private orderBy(sort: ChannelSort): Condition[] {
    if (sort === 'display_name_asc') {
      return [asc(socialAccounts.displayName), asc(socialAccounts.id)];
    }
    if (sort === 'updated_at_desc') {
      return [desc(socialAccounts.updatedAt), desc(socialAccounts.id)];
    }
    return [desc(socialAccounts.createdAt), desc(socialAccounts.id)];
  }

  private cursorWhere(sort: ChannelSort, cursor: ChannelCursor): Condition {
    if (sort === 'display_name_asc') {
      return this.anyOf([
        gt(socialAccounts.displayName, cursor.value),
        and(
          eq(socialAccounts.displayName, cursor.value),
          gt(socialAccounts.id, cursor.id),
        )!,
      ]);
    }

    const timestamp = new Date(cursor.value);
    const column =
      sort === 'updated_at_desc'
        ? socialAccounts.updatedAt
        : socialAccounts.createdAt;
    return this.anyOf([
      sql`${column} < ${timestamp}`,
      and(eq(column, timestamp), sql`${socialAccounts.id} < ${cursor.id}`)!,
    ]);
  }
  private encodeCursor(account: SocialAccountRow, sort: ChannelSort): string {
    const value =
      sort === 'display_name_asc'
        ? account.displayName
        : sort === 'updated_at_desc'
          ? account.updatedAt.toISOString()
          : account.createdAt.toISOString();

    return Buffer.from(
      JSON.stringify({
        version: 1,
        sort,
        value,
        id: account.id,
      } satisfies ChannelCursor),
    ).toString('base64url');
  }

  private decodeCursor(value: string, sort: ChannelSort): ChannelCursor {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new BadRequestException();

    let cursor: unknown;
    try {
      cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException();
    }

    if (
      !cursor ||
      typeof cursor !== 'object' ||
      (cursor as Record<string, unknown>).version !== 1 ||
      (cursor as Record<string, unknown>).sort !== sort ||
      typeof (cursor as Record<string, unknown>).value !== 'string' ||
      typeof (cursor as Record<string, unknown>).id !== 'string'
    ) {
      throw new BadRequestException();
    }

    const decoded = cursor as ChannelCursor;
    this.parseId(decoded.id);
    if (decoded.value.length === 0 || decoded.value.length > 255) {
      throw new BadRequestException();
    }
    if (sort !== 'display_name_asc') {
      const timestamp = new Date(decoded.value);
      if (
        Number.isNaN(timestamp.getTime()) ||
        timestamp.toISOString() !== decoded.value
      ) {
        throw new BadRequestException();
      }
    }

    return decoded;
  }

  private anyOf(conditions: Condition[]): Condition {
    return sql`(${sql.join(conditions, sql` or `)})`;
  }

  private serialize(account: SocialAccountRow): PortalChannelAccount {
    const provider = this.providerFor(account.providerKey);
    if (!provider) throw new BadRequestException();
    const capabilityKey =
      account.capabilityKey as PortalChannelAccount['capabilityKey'];
    return {
      id: account.id,
      provider,
      capabilityKey,
      displayName: account.displayName,
      externalName: this.externalName(account.metadata),
      handle: account.handle,
      profileUrl: account.profileUrl,
      avatarUrl: account.avatarUrl,
      status:
        account.status === 'active' && !account.disconnectedAt
          ? 'connected'
          : 'disconnected',
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private externalName(metadata: Record<string, unknown>) {
    const value = metadata.externalDisplayName;
    return typeof value === 'string' && value.length > 0 && value.length <= 255
      ? value
      : null;
  }

  private providerFor(
    providerKey: string,
  ): PortalChannelAccount['provider'] | null {
    if (providerKey === 'facebook') return 'meta';
    if (
      providerKey === 'meta' ||
      providerKey === 'linkedin' ||
      providerKey === 'x' ||
      providerKey === 'tiktok'
    ) {
      return providerKey;
    }
    if (providerKey === 'whatsapp-status') return 'whatsapp';
    return null;
  }

  private parseId(id: string) {
    // Validate at the boundary to avoid driver errors.
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new BadRequestException();
    }
    return id;
  }

  private canManage(session: PortalAuthSession) {
    return managerRoles.has(session.workspace.role);
  }

  private requireManager(session: PortalAuthSession) {
    if (!this.canManage(session)) throw new ForbiddenException();
  }

  private parse<T>(result: { success: true; data: T } | { success: false }): T {
    if (!result.success) throw new BadRequestException();
    return result.data;
  }
}
