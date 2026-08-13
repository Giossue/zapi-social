import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createGoogleDriveImportBatchSchema,
  googleDriveIntegrationProviderKey,
  type GoogleDriveImportBatch,
  type PortalAuthSession,
} from '@workspace/contracts';
import {
  fileFolders,
  fileImportBatches,
  fileImportItems,
} from '@workspace/database';
import { and, asc, eq } from '@workspace/database/query';
import type { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AppException } from '../platform/errors/app-exception';

export const FILE_IMPORTS_QUEUE = 'file-imports';
export const GOOGLE_DRIVE_IMPORT_JOB = 'google-drive-import';

@Injectable()
export class GoogleDriveImportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly integrations: IntegrationsService,
    private readonly config: ConfigService,
    @InjectQueue(FILE_IMPORTS_QUEUE) private readonly importsQueue: Queue,
  ) {}

  async getProvider(session: Promise<PortalAuthSession>) {
    await session;
    return this.integrations.readGoogleDrivePortalConfiguration();
  }

  async createBatch(
    session: Promise<PortalAuthSession>,
    input: unknown,
  ): Promise<GoogleDriveImportBatch> {
    const auth = await session;
    this.requireManage(auth);
    const provider =
      await this.integrations.readGoogleDrivePortalConfiguration();
    if (!provider.enabled) {
      throw new AppException(
        'GOOGLE_DRIVE_DISABLED',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const parsed = createGoogleDriveImportBatchSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const values = parsed.data;
    if (
      values.sourceContext === 'publishing' &&
      values.destinationFolderId != null
    ) {
      throw this.invalid();
    }
    const expiresAt = new Date(values.credentialExpiresAt);
    if (expiresAt.valueOf() <= Date.now() + 30_000) {
      throw new AppException(
        'GOOGLE_DRIVE_IMPORT_EXPIRED',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (values.destinationFolderId) {
      const [folder] = await this.database.db
        .select({ id: fileFolders.id })
        .from(fileFolders)
        .where(
          and(
            eq(fileFolders.id, values.destinationFolderId),
            eq(fileFolders.workspaceId, auth.workspace.id),
            eq(fileFolders.status, 'active'),
          ),
        )
        .limit(1);
      if (!folder) throw this.invalid();
    }

    const [existing] = await this.database.db
      .select({ id: fileImportBatches.id })
      .from(fileImportBatches)
      .where(
        and(
          eq(fileImportBatches.workspaceId, auth.workspace.id),
          eq(fileImportBatches.requestedByUserId, auth.user.id),
          eq(fileImportBatches.idempotencyKey, values.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) return this.batch(auth, existing.id);

    const batchId = crypto.randomUUID();
    const created = await this.database.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(fileImportBatches)
        .values({
          id: batchId,
          workspaceId: auth.workspace.id,
          requestedByUserId: auth.user.id,
          providerKey: googleDriveIntegrationProviderKey,
          sourceContext: values.sourceContext,
          destinationFolderId: values.destinationFolderId ?? null,
          encryptedAccessToken: this.encryption().encrypt(
            values.accessToken,
            `google-drive-import:${batchId}`,
          ),
          credentialExpiresAt: expiresAt,
          idempotencyKey: values.idempotencyKey,
          totalItems: values.files.length,
        })
        .onConflictDoNothing()
        .returning({ id: fileImportBatches.id });
      if (!inserted) return false;
      await tx.insert(fileImportItems).values(
        values.files.map((file) => {
          const hash = createHash('sha256')
            .update(file.providerFileId)
            .digest('hex');
          return {
            batchId,
            workspaceId: auth.workspace.id,
            providerFileIdHash: hash,
            providerFileIdCiphertext: this.encryption().encrypt(
              file.providerFileId,
              `google-drive-file:${batchId}:${hash}`,
            ),
            resourceKeyCiphertext: file.resourceKey
              ? this.encryption().encrypt(
                  file.resourceKey,
                  `google-drive-resource:${batchId}:${hash}`,
                )
              : null,
          };
        }),
      );
      return true;
    });

    if (!created) {
      const [concurrent] = await this.database.db
        .select({ id: fileImportBatches.id })
        .from(fileImportBatches)
        .where(
          and(
            eq(fileImportBatches.workspaceId, auth.workspace.id),
            eq(fileImportBatches.requestedByUserId, auth.user.id),
            eq(fileImportBatches.idempotencyKey, values.idempotencyKey),
          ),
        )
        .limit(1);
      if (!concurrent)
        throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
      return this.batch(auth, concurrent.id);
    }

    try {
      await this.importsQueue.add(
        GOOGLE_DRIVE_IMPORT_JOB,
        { batchId },
        {
          jobId: `google-drive-import-${batchId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch {
      // Estado durable: el scheduler del Worker recupera lotes pendientes.
    }

    return this.batch(auth, batchId);
  }

  async getBatch(session: Promise<PortalAuthSession>, id: string) {
    return this.batch(await session, id);
  }

  private async batch(
    auth: PortalAuthSession,
    id: string,
  ): Promise<GoogleDriveImportBatch> {
    const [batch] = await this.database.db
      .select()
      .from(fileImportBatches)
      .where(
        and(
          eq(fileImportBatches.id, id),
          eq(fileImportBatches.workspaceId, auth.workspace.id),
        ),
      )
      .limit(1);
    if (!batch) {
      throw new AppException('REQUEST_FAILED', HttpStatus.NOT_FOUND);
    }
    const items = await this.database.db
      .select({
        id: fileImportItems.id,
        status: fileImportItems.status,
        fileAssetId: fileImportItems.fileAssetId,
        errorCode: fileImportItems.errorCode,
      })
      .from(fileImportItems)
      .where(eq(fileImportItems.batchId, batch.id))
      .orderBy(asc(fileImportItems.createdAt));
    return {
      id: batch.id,
      sourceContext: batch.sourceContext,
      destinationFolderId: batch.destinationFolderId,
      status: batch.status,
      totalItems: batch.totalItems,
      completedItems: batch.completedItems,
      failedItems: batch.failedItems,
      items,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    };
  }

  private requireManage(auth: PortalAuthSession) {
    if (auth.workspace.role !== 'owner' && auth.workspace.role !== 'admin') {
      throw new AppException(
        'AUTH_PORTAL_ACCESS_REQUIRED',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
  }
}
