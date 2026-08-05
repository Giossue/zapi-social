import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  fileAssets,
  publishingWatermarks,
  socialAccounts,
} from '@workspace/database';
import { and, desc, eq, ilike, isNull } from '@workspace/database/query';
import {
  createPortalWatermarkSchema,
  updatePortalWatermarkSchema,
  type PortalAuthSession,
  type PortalWatermark,
  type PortalWatermarkAccount,
  type PortalWatermarksResponse,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const managerRoles = new Set(['owner', 'admin']);
const publishingCapabilities = new Set([
  'facebook_page',
  'instagram_profile',
  'whatsapp_status',
]);

type Watermark = typeof publishingWatermarks.$inferSelect;

@Injectable()
export class WatermarksService {
  constructor(private readonly database: DatabaseService) {}

  async list(session: PortalAuthSession): Promise<PortalWatermarksResponse> {
    const [rules, accounts] = await Promise.all([
      this.database.db
        .select()
        .from(publishingWatermarks)
        .where(eq(publishingWatermarks.workspaceId, session.workspace.id))
        .orderBy(
          desc(publishingWatermarks.updatedAt),
          desc(publishingWatermarks.id),
        ),
      this.accountsForWorkspace(session.workspace.id),
    ]);
    return {
      canManage: this.canManage(session),
      accounts,
      watermarks: rules.map((rule) => this.serialize(rule)),
    };
  }

  async get(session: PortalAuthSession, id: string): Promise<PortalWatermark> {
    return this.serialize(
      await this.findForWorkspace(session.workspace.id, id),
    );
  }

  async create(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalWatermark> {
    this.requireManage(session);
    const values = this.parse(createPortalWatermarkSchema.safeParse(input));
    const socialAccountId = values.socialAccountId ?? null;
    await this.assertTargetAccount(session.workspace.id, socialAccountId);
    if (values.type === 'image')
      await this.assertImageAsset(
        session.workspace.id,
        values.imageFileAssetId,
      );
    await this.assertTargetAvailable(session.workspace.id, socialAccountId);
    const now = new Date();
    try {
      const [watermark] = await this.database.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(publishingWatermarks)
          .values({
            workspaceId: session.workspace.id,
            createdByUserId: session.user.id,
            socialAccountId,
            type: values.type,
            imageFileAssetId:
              values.type === 'image' ? values.imageFileAssetId : null,
            text: values.type === 'text' ? values.text : null,
            position: values.position,
            opacityPercent: values.opacityPercent,
            scalePercent: values.scalePercent,
            textPreset: values.textPreset,
            textColor: values.textColor,
            textWeight: values.textWeight,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!created) throw this.failed();
        await tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'publishing_watermark.created',
          subjectType: 'publishing_watermark',
          subjectId: created.id,
          summary: 'Publishing watermark created',
          metadata: { socialAccountId, type: values.type },
        });
        return [created];
      });
      if (!watermark) throw this.failed();
      return this.serialize(watermark);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw this.targetExists();
      throw error;
    }
  }

  async update(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<PortalWatermark> {
    this.requireManage(session);
    const current = await this.findForWorkspace(session.workspace.id, id);
    const values = this.parse(updatePortalWatermarkSchema.safeParse(input));
    const socialAccountId = values.socialAccountId ?? null;
    await this.assertTargetAccount(session.workspace.id, socialAccountId);
    if (values.type === 'image')
      await this.assertImageAsset(
        session.workspace.id,
        values.imageFileAssetId,
      );
    await this.assertTargetAvailable(
      session.workspace.id,
      socialAccountId,
      current.id,
    );
    const now = new Date();
    try {
      const [watermark] = await this.database.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(publishingWatermarks)
          .set({
            socialAccountId,
            type: values.type,
            imageFileAssetId:
              values.type === 'image' ? values.imageFileAssetId : null,
            text: values.type === 'text' ? values.text : null,
            position: values.position,
            opacityPercent: values.opacityPercent,
            scalePercent: values.scalePercent,
            textPreset: values.textPreset,
            textColor: values.textColor,
            textWeight: values.textWeight,
            updatedAt: now,
          })
          .where(
            and(
              eq(publishingWatermarks.id, current.id),
              eq(publishingWatermarks.workspaceId, session.workspace.id),
            ),
          )
          .returning();
        if (!updated) throw this.notFound();
        await tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'publishing_watermark.updated',
          subjectType: 'publishing_watermark',
          subjectId: updated.id,
          summary: 'Publishing watermark updated',
          metadata: { socialAccountId, type: values.type },
        });
        return [updated];
      });
      if (!watermark) throw this.notFound();
      return this.serialize(watermark);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw this.targetExists();
      throw error;
    }
  }

  async remove(session: PortalAuthSession, id: string): Promise<void> {
    this.requireManage(session);
    const current = await this.findForWorkspace(session.workspace.id, id);
    await this.database.db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(publishingWatermarks)
        .where(
          and(
            eq(publishingWatermarks.id, current.id),
            eq(publishingWatermarks.workspaceId, session.workspace.id),
          ),
        )
        .returning({ id: publishingWatermarks.id });
      if (!removed) throw this.notFound();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'publishing_watermark.deleted',
        subjectType: 'publishing_watermark',
        subjectId: removed.id,
        summary: 'Publishing watermark deleted',
        metadata: {},
      });
    });
  }

  private async accountsForWorkspace(workspaceId: string) {
    const rows = await this.database.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, workspaceId),
          eq(socialAccounts.status, 'active'),
          isNull(socialAccounts.disconnectedAt),
        ),
      )
      .orderBy(socialAccounts.displayName);
    return rows
      .filter((account) => publishingCapabilities.has(account.capabilityKey))
      .map((account): PortalWatermarkAccount => ({
        id: account.id,
        displayName: account.displayName,
        providerKey: account.providerKey,
        capabilityKey: account.capabilityKey,
      }));
  }

  private async assertTargetAccount(
    workspaceId: string,
    socialAccountId: string | null,
  ) {
    if (!socialAccountId) return;
    const [account] = await this.database.db
      .select({
        id: socialAccounts.id,
        capabilityKey: socialAccounts.capabilityKey,
      })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, socialAccountId),
          eq(socialAccounts.workspaceId, workspaceId),
          eq(socialAccounts.status, 'active'),
          isNull(socialAccounts.disconnectedAt),
        ),
      )
      .limit(1);
    if (!account || !publishingCapabilities.has(account.capabilityKey))
      throw this.invalid();
  }

  private async assertImageAsset(workspaceId: string, id: string) {
    const [asset] = await this.database.db
      .select({ mimeType: fileAssets.mimeType })
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.id, id),
          eq(fileAssets.workspaceId, workspaceId),
          eq(fileAssets.status, 'ready'),
          ilike(fileAssets.mimeType, 'image/%'),
        ),
      )
      .limit(1);
    if (!asset) throw this.invalid();
  }

  private async assertTargetAvailable(
    workspaceId: string,
    socialAccountId: string | null,
    excludingId?: string,
  ) {
    const conditions = [eq(publishingWatermarks.workspaceId, workspaceId)];
    if (socialAccountId)
      conditions.push(
        eq(publishingWatermarks.socialAccountId, socialAccountId),
      );
    else conditions.push(isNull(publishingWatermarks.socialAccountId));
    const [existing] = await this.database.db
      .select({ id: publishingWatermarks.id })
      .from(publishingWatermarks)
      .where(and(...conditions))
      .limit(1);
    if (existing && existing.id !== excludingId) throw this.targetExists();
  }

  private async findForWorkspace(workspaceId: string, id: string) {
    if (!this.isUuid(id)) throw this.notFound();
    const [watermark] = await this.database.db
      .select()
      .from(publishingWatermarks)
      .where(
        and(
          eq(publishingWatermarks.id, id),
          eq(publishingWatermarks.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!watermark) throw this.notFound();
    return watermark;
  }

  private serialize(watermark: Watermark): PortalWatermark {
    return {
      id: watermark.id,
      socialAccountId: watermark.socialAccountId,
      type: watermark.type,
      imageFileAssetId: watermark.imageFileAssetId,
      text: watermark.text,
      position: watermark.position,
      opacityPercent: watermark.opacityPercent,
      scalePercent: watermark.scalePercent,
      textPreset: watermark.textPreset,
      textColor: watermark.textColor,
      textWeight: watermark.textWeight,
      updatedAt: watermark.updatedAt.toISOString(),
      createdAt: watermark.createdAt.toISOString(),
    };
  }

  private canManage(session: PortalAuthSession) {
    return managerRoles.has(session.workspace.role);
  }

  private requireManage(session: PortalAuthSession) {
    if (!this.canManage(session))
      throw new AppException(
        'AUTH_PORTAL_ACCESS_REQUIRED',
        HttpStatus.FORBIDDEN,
      );
  }

  private parse<T>(result: { success: true; data: T } | { success: false }) {
    if (!result.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return result.data;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private isUniqueViolation(error: unknown) {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as { code?: unknown; cause?: { code?: unknown } };
    return candidate.code === '23505' || candidate.cause?.code === '23505';
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private notFound() {
    return new AppException('WATERMARK_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private targetExists() {
    return new AppException('WATERMARK_TARGET_EXISTS', HttpStatus.CONFLICT);
  }

  private failed() {
    return new AppException('REQUEST_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
