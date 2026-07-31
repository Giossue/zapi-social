import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { providerIntegrations, socialAccounts } from '@workspace/database';
import {
  channelListQuerySchema,
  createChannelSchema,
  updateChannelSchema,
  type PortalAuthSession,
  type ChannelAccount,
  type ChannelList,
  type ChannelOAuthProviderKey,
} from '@workspace/contracts';
import { and, asc, desc, eq, sql } from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';

const managerRoles = new Set(['owner', 'admin']);

type SocialAccountRow = typeof socialAccounts.$inferSelect;

@Injectable()
export class ChannelsService {
  constructor(private readonly database: DatabaseService) {}

  async list(session: PortalAuthSession, query: unknown): Promise<ChannelList> {
    const filters = this.parse(channelListQuerySchema.safeParse(query));
    const where = this.listWhere(session.workspace.id, filters);

    const [accounts, metricRows, readyProviderRows] = await Promise.all([
      this.database.db
        .select()
        .from(socialAccounts)
        .where(where)
        .orderBy(
          filters.sort === 'name'
            ? asc(socialAccounts.displayName)
            : desc(socialAccounts.createdAt),
        ),
      this.database.db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.workspaceId, session.workspace.id)),
      this.database.db
        .select({ providerKey: providerIntegrations.providerKey })
        .from(providerIntegrations)
        .where(
          and(
            eq(providerIntegrations.enabled, true),
            eq(providerIntegrations.readiness, 'ready'),
          ),
        ),
    ]);

    const readyProviders = readyProviderRows
      .map(({ providerKey }) => providerKey)
      .filter(
        (providerKey): providerKey is ChannelOAuthProviderKey =>
          providerKey === 'facebook' || providerKey === 'linkedin',
      );

    const recentBoundary = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const providers = [
      ...new Set(metricRows.map((account) => account.providerKey)),
    ].sort((a, b) => a.localeCompare(b));

    return {
      canManage: this.canManage(session),
      canConnect: readyProviders.length > 0,
      readyProviders,
      metrics: {
        total: metricRows.length,
        active: metricRows.filter((account) => account.status === 'active')
          .length,
        paused: metricRows.filter((account) => account.status === 'paused')
          .length,
        recent: metricRows.filter(
          (account) => account.createdAt.getTime() >= recentBoundary,
        ).length,
      },
      providers,
      accounts: accounts.map((account) => this.serialize(account)),
    };
  }

  async create(session: PortalAuthSession, input: unknown): Promise<ChannelAccount> {
    this.requireManager(session);
    const values = this.parse(createChannelSchema.safeParse(input));
    const [account] = await this.database.db
      .insert(socialAccounts)
      .values({
        workspaceId: session.workspace.id,
        providerKey: values.providerKey,
        capabilityKey: values.capabilityKey,
        displayName: values.displayName,
        handle: values.handle || null,
        profileUrl: values.profileUrl || null,
        status: 'active',
      })
      .returning();

    return this.serialize(account);
  }

  async update(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<ChannelAccount> {
    this.requireManager(session);
    const values = this.parse(updateChannelSchema.safeParse(input));
    const [account] = await this.database.db
      .update(socialAccounts)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(socialAccounts.id, id),
          eq(socialAccounts.workspaceId, session.workspace.id),
        ),
      )
      .returning();

    if (!account) throw new NotFoundException();
    return this.serialize(account);
  }

  async remove(session: PortalAuthSession, id: string): Promise<void> {
    this.requireManager(session);
    const [account] = await this.database.db
      .delete(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, id),
          eq(socialAccounts.workspaceId, session.workspace.id),
        ),
      )
      .returning({ id: socialAccounts.id });

    if (!account) throw new NotFoundException();
  }

  private listWhere(
    workspaceId: string,
    filters: { q?: string; status?: 'active' | 'paused'; provider?: string },
  ) {
    const conditions = [eq(socialAccounts.workspaceId, workspaceId)];
    if (filters.status)
      conditions.push(eq(socialAccounts.status, filters.status));
    if (filters.provider)
      conditions.push(eq(socialAccounts.providerKey, filters.provider));
    if (filters.q) {
      const search = `%${filters.q.toLowerCase()}%`;
      conditions.push(
        sql`(
          lower(${socialAccounts.displayName}) like ${search}
          or lower(coalesce(${socialAccounts.handle}, '')) like ${search}
          or lower(${socialAccounts.providerKey}) like ${search}
          or lower(${socialAccounts.capabilityKey}) like ${search}
        )`,
      );
    }
    return and(...conditions) ?? eq(socialAccounts.workspaceId, workspaceId);
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

  private serialize(account: SocialAccountRow): ChannelAccount {
    return {
      id: account.id,
      providerKey: account.providerKey,
      capabilityKey: account.capabilityKey,
      displayName: account.displayName,
      handle: account.handle,
      profileUrl: account.profileUrl,
      status: account.status === 'paused' ? 'paused' : 'active',
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
