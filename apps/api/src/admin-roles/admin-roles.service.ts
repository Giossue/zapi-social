import { HttpStatus, Injectable } from '@nestjs/common';
import {
  assignAdminRoleSchema,
  upsertAdminRoleSchema,
  type AdminRoleCandidatesResponse,
  type AdminRoleMembersResponse,
  type AdminRolesResponse,
  type PlatformAdminAuthSession,
} from '@workspace/contracts';
import { adminRoles, apiAuditLogs, users } from '@workspace/database';
import {
  and,
  asc,
  eq,
  ilike,
  isNull,
  or,
  sql,
} from '@workspace/database/query';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

@Injectable()
export class AdminRolesService {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<AdminRolesResponse> {
    const [rows, counts] = await Promise.all([
      this.database.db.select().from(adminRoles).orderBy(asc(adminRoles.name)),
      this.database.db
        .select({
          adminRoleId: users.adminRoleId,
          members: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(sql`${users.adminRoleId} is not null`)
        .groupBy(users.adminRoleId),
    ]);
    const members = new Map(
      counts.map((row) => [row.adminRoleId, row.members]),
    );
    return {
      roles: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        permissions: row.permissions,
        memberCount: members.get(row.id) ?? 0,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async create(
    session: PlatformAdminAuthSession,
    input: unknown,
  ): Promise<AdminRolesResponse> {
    const values = this.parse(upsertAdminRoleSchema.safeParse(input));
    const [created] = await this.database.db
      .insert(adminRoles)
      .values(values)
      .onConflictDoNothing({ target: adminRoles.name })
      .returning({ id: adminRoles.id });
    if (!created)
      throw new AppException('ADMIN_ROLE_NAME_TAKEN', HttpStatus.CONFLICT);
    await this.audit(session, 'admin_role.created', created.id);
    return this.list();
  }

  async update(
    session: PlatformAdminAuthSession,
    id: string,
    input: unknown,
  ): Promise<AdminRolesResponse> {
    const roleId = this.id(id);
    const values = this.parse(upsertAdminRoleSchema.safeParse(input));
    const [updated] = await this.database.db
      .update(adminRoles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(adminRoles.id, roleId))
      .returning({ id: adminRoles.id });
    if (!updated)
      throw new AppException('ADMIN_ROLE_NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.audit(session, 'admin_role.updated', roleId);
    return this.list();
  }

  async remove(
    session: PlatformAdminAuthSession,
    id: string,
  ): Promise<AdminRolesResponse> {
    const roleId = this.id(id);
    const [deleted] = await this.database.db
      .delete(adminRoles)
      .where(eq(adminRoles.id, roleId))
      .returning({ id: adminRoles.id });
    if (!deleted)
      throw new AppException('ADMIN_ROLE_NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.audit(session, 'admin_role.deleted', roleId);
    return this.list();
  }

  async members(id: string): Promise<AdminRoleMembersResponse> {
    const roleId = this.id(id);
    const rows = await this.database.db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.adminRoleId, roleId))
      .orderBy(asc(users.displayName));
    return { members: rows };
  }

  async candidates(query: unknown): Promise<AdminRoleCandidatesResponse> {
    const parsed = z
      .object({ q: z.string().trim().max(160).optional() })
      .safeParse(query ?? {});
    const q = parsed.success ? parsed.data.q : undefined;
    const rows = await this.database.db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          eq(users.isPlatformAdmin, false),
          isNull(users.adminRoleId),
          eq(users.status, 'active'),
          q
            ? or(
                ilike(users.displayName, `%${q}%`),
                ilike(users.email, `%${q}%`),
              )
            : undefined,
        ),
      )
      .orderBy(asc(users.displayName))
      .limit(20);
    return { candidates: rows };
  }

  async assign(
    session: PlatformAdminAuthSession,
    id: string,
    input: unknown,
  ): Promise<AdminRoleMembersResponse> {
    const roleId = this.id(id);
    const { userId } = this.parse(assignAdminRoleSchema.safeParse(input));
    const [role] = await this.database.db
      .select({ id: adminRoles.id })
      .from(adminRoles)
      .where(eq(adminRoles.id, roleId))
      .limit(1);
    if (!role)
      throw new AppException('ADMIN_ROLE_NOT_FOUND', HttpStatus.NOT_FOUND);
    const [updated] = await this.database.db
      .update(users)
      .set({ adminRoleId: roleId, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.isPlatformAdmin, false)))
      .returning({ id: users.id });
    if (!updated)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    await this.audit(session, 'admin_role.member_assigned', roleId);
    return this.members(roleId);
  }

  async unassign(
    session: PlatformAdminAuthSession,
    id: string,
    userId: string,
  ): Promise<AdminRoleMembersResponse> {
    const roleId = this.id(id);
    const parsedUser = z.uuid().safeParse(userId);
    if (!parsedUser.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    await this.database.db
      .update(users)
      .set({ adminRoleId: null, updatedAt: new Date() })
      .where(and(eq(users.id, parsedUser.data), eq(users.adminRoleId, roleId)));
    await this.audit(session, 'admin_role.member_unassigned', roleId);
    return this.members(roleId);
  }

  private id(value: string): string {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success)
      throw new AppException('ADMIN_ROLE_NOT_FOUND', HttpStatus.NOT_FOUND);
    return parsed.data;
  }

  private parse<T>(result: { success: true; data: T } | { success: false }) {
    if (!result.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return result.data;
  }

  private async audit(
    session: PlatformAdminAuthSession,
    event: string,
    roleId: string,
  ) {
    await this.database.db.insert(apiAuditLogs).values({
      actorUserId: session.user.id,
      event,
      subjectType: 'admin_role',
      summary: roleId,
      metadata: { roleId },
    });
  }
}
