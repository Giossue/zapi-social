import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  automationLogs,
  automationWebhookDeliveries,
  automationWebhooks,
} from '@workspace/database';
import { and, eq, inArray, or, sql } from '@workspace/database/query';
import type { Job, Queue } from 'bullmq';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { DatabaseService } from '../database/database.service';
import {
  AUTOMATION_WEBHOOK_DELIVERY_JOB,
  AUTOMATION_WEBHOOK_DISPATCH_JOB,
  AUTOMATION_WEBHOOK_QUEUE,
  type AutomationWebhookDeliveryJobData,
  type AutomationWebhookDispatchJobData,
} from './automation.constants';

const maximumAttempts = 5;
const retryDelayMs = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const processingLeaseMs = 5 * 60_000;
const webhookTimeoutMs = 15_000;

@Injectable()
@Processor(AUTOMATION_WEBHOOK_QUEUE, { concurrency: 5 })
export class AutomationWebhookProcessor extends WorkerHost {
  private readonly requireHttps: boolean;

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
    @InjectQueue(AUTOMATION_WEBHOOK_QUEUE)
    private readonly queue: Queue<
      AutomationWebhookDispatchJobData | AutomationWebhookDeliveryJobData
    >,
    config: ConfigService,
  ) {
    super();
    this.requireHttps = config.get<string>('NODE_ENV') === 'production';
  }

  async process(
    job: Job<
      AutomationWebhookDispatchJobData | AutomationWebhookDeliveryJobData
    >,
  ) {
    if (job.name === AUTOMATION_WEBHOOK_DISPATCH_JOB) {
      await this.enqueueDue();
      return;
    }
    if (job.name !== AUTOMATION_WEBHOOK_DELIVERY_JOB) return;
    const data = job.data as AutomationWebhookDeliveryJobData;
    await this.deliver(data.deliveryId);
  }

  async enqueueDue() {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - processingLeaseMs);
    const deliveries = await this.database.db
      .select({
        id: automationWebhookDeliveries.id,
        attemptCount: automationWebhookDeliveries.attemptCount,
      })
      .from(automationWebhookDeliveries)
      .where(
        and(
          sql`${automationWebhookDeliveries.attemptCount} < ${maximumAttempts}`,
          or(
            and(
              inArray(automationWebhookDeliveries.status, ['queued', 'failed']),
              sql`${automationWebhookDeliveries.nextAttemptAt} <= ${now}`,
            ),
            and(
              eq(automationWebhookDeliveries.status, 'processing'),
              sql`${automationWebhookDeliveries.updatedAt} <= ${staleBefore}`,
            ),
          ),
        ),
      )
      .limit(200);
    for (const delivery of deliveries) {
      await this.queue
        .add(
          AUTOMATION_WEBHOOK_DELIVERY_JOB,
          { deliveryId: delivery.id },
          {
            jobId: `webhook-${delivery.id}-${delivery.attemptCount}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        )
        .catch(() => undefined);
    }
  }

  private async deliver(deliveryId: string) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - processingLeaseMs);
    const [delivery] = await this.database.db
      .update(automationWebhookDeliveries)
      .set({
        status: 'processing',
        attemptCount: sql`${automationWebhookDeliveries.attemptCount} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(automationWebhookDeliveries.id, deliveryId),
          sql`${automationWebhookDeliveries.attemptCount} < ${maximumAttempts}`,
          or(
            and(
              inArray(automationWebhookDeliveries.status, ['queued', 'failed']),
              sql`${automationWebhookDeliveries.nextAttemptAt} <= ${now}`,
            ),
            and(
              eq(automationWebhookDeliveries.status, 'processing'),
              sql`${automationWebhookDeliveries.updatedAt} <= ${staleBefore}`,
            ),
          ),
        ),
      )
      .returning();
    if (!delivery) return;
    const [webhook] = await this.database.db
      .select()
      .from(automationWebhooks)
      .where(
        and(
          eq(automationWebhooks.id, delivery.webhookId),
          eq(automationWebhooks.workspaceId, delivery.workspaceId),
          eq(automationWebhooks.enabled, true),
        ),
      )
      .limit(1);
    if (!webhook) {
      await this.finishFailure(delivery, 'AUTOMATION_WEBHOOK_DISABLED', null);
      return;
    }

    let responseStatus: number | null = null;
    try {
      const url = new URL(webhook.url);
      const address = await resolvePublicWebhookAddress(url, this.requireHttps);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify(delivery.payload);
      const secret = this.encryption.decrypt(
        webhook.signingSecretCiphertext,
        `automation-webhook:${delivery.workspaceId}`,
      );
      const signature = createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
      responseStatus = await postWebhookToAddress(url, address.address, body, {
        'content-type': 'application/json',
        'user-agent': 'ZapiSocial-Webhooks/1.0',
        'x-zapi-delivery': delivery.id,
        'x-zapi-event': delivery.event,
        'x-zapi-signature': `sha256=${signature}`,
        'x-zapi-timestamp': timestamp,
      });
      if (responseStatus < 200 || responseStatus >= 300) {
        throw new WebhookDeliveryError('AUTOMATION_WEBHOOK_REJECTED');
      }
      await this.database.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(automationWebhookDeliveries)
          .set({
            status: 'succeeded',
            responseStatus,
            errorCode: null,
            deliveredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(automationWebhookDeliveries.id, delivery.id),
              eq(automationWebhookDeliveries.status, 'processing'),
              eq(automationWebhookDeliveries.updatedAt, delivery.updatedAt),
            ),
          )
          .returning({ id: automationWebhookDeliveries.id });
        if (!updated) return;
        await tx
          .update(automationWebhooks)
          .set({
            lastSentAt: new Date(),
            lastStatusCode: responseStatus,
            updatedAt: new Date(),
          })
          .where(eq(automationWebhooks.id, webhook.id));
        await tx.insert(automationLogs).values({
          workspaceId: delivery.workspaceId,
          webhookId: webhook.id,
          direction: 'outbound',
          event: delivery.event,
          requestId: delivery.id,
          status: 'succeeded',
          statusCode: responseStatus,
          summary: 'Webhook entregado',
          metadata: { attempt: delivery.attemptCount },
        });
      });
    } catch (error) {
      await this.finishFailure(
        delivery,
        error instanceof WebhookDeliveryError
          ? error.code
          : 'AUTOMATION_WEBHOOK_DELIVERY_FAILED',
        responseStatus,
      );
    }
  }

  private async finishFailure(
    delivery: typeof automationWebhookDeliveries.$inferSelect,
    errorCode: string,
    responseStatus: number | null,
  ) {
    const finalAttempt = delivery.attemptCount >= maximumAttempts;
    const delay = retryDelayMs[Math.max(0, delivery.attemptCount - 1)] ?? 0;
    const nextAttemptAt = new Date(Date.now() + delay);
    await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(automationWebhookDeliveries)
        .set({
          status: 'failed',
          responseStatus,
          errorCode,
          nextAttemptAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(automationWebhookDeliveries.id, delivery.id),
            eq(automationWebhookDeliveries.status, 'processing'),
            eq(automationWebhookDeliveries.updatedAt, delivery.updatedAt),
          ),
        )
        .returning({ id: automationWebhookDeliveries.id });
      if (!updated) return;
      await tx
        .update(automationWebhooks)
        .set({ lastStatusCode: responseStatus, updatedAt: new Date() })
        .where(eq(automationWebhooks.id, delivery.webhookId));
      await tx.insert(automationLogs).values({
        workspaceId: delivery.workspaceId,
        webhookId: delivery.webhookId,
        direction: 'outbound',
        event: delivery.event,
        requestId: delivery.id,
        status: 'failed',
        statusCode: responseStatus,
        summary: finalAttempt
          ? 'Webhook agotó sus reintentos'
          : 'Webhook pendiente de reintento',
        metadata: { attempt: delivery.attemptCount, errorCode },
      });
    });
  }
}

class WebhookDeliveryError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function resolvePublicWebhookAddress(
  url: URL,
  requireHttps: boolean,
) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new WebhookDeliveryError('AUTOMATION_WEBHOOK_URL_INVALID');
  }
  if (requireHttps && url.protocol !== 'https:') {
    throw new WebhookDeliveryError('AUTOMATION_WEBHOOK_HTTPS_REQUIRED');
  }
  if (
    url.username ||
    url.password ||
    (url.port &&
      ((url.protocol === 'http:' && url.port !== '80') ||
        (url.protocol === 'https:' && url.port !== '443')))
  ) {
    throw new WebhookDeliveryError('AUTOMATION_WEBHOOK_URL_FORBIDDEN');
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new WebhookDeliveryError('AUTOMATION_WEBHOOK_URL_FORBIDDEN');
  }
  const [address] = addresses;
  if (!address) {
    throw new WebhookDeliveryError('AUTOMATION_WEBHOOK_URL_FORBIDDEN');
  }
  return address;
}

async function postWebhookToAddress(
  url: URL,
  address: string,
  body: string,
  headers: Record<string, string>,
) {
  return new Promise<number>((resolvePromise, rejectPromise) => {
    let settled = false;
    const finish = (error?: Error, statusCode?: number) => {
      if (settled) return;
      settled = true;
      if (error) rejectPromise(error);
      else if (statusCode) resolvePromise(statusCode);
      else rejectPromise(new Error('Webhook response did not include status'));
    };
    const options = {
      headers: {
        ...headers,
        host: url.host,
        'content-length': Buffer.byteLength(body).toString(),
      },
      hostname: address,
      method: 'POST',
      path: `${url.pathname}${url.search}`,
      port: url.port || undefined,
    };
    const request =
      url.protocol === 'https:'
        ? httpsRequest({ ...options, servername: url.hostname })
        : httpRequest(options);
    request.setTimeout(webhookTimeoutMs, () => {
      request.destroy(new Error('Webhook request timed out'));
    });
    request.on('error', (error) => finish(error));
    request.on('response', (response) => {
      const statusCode = response.statusCode;
      response.resume();
      response.on('end', () => finish(undefined, statusCode));
      response.on('error', (error) => finish(error));
    });
    request.end(body);
  });
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a = 0, b = 0] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (family !== 6) return true;
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    const mappedAddress = normalized.slice('::ffff:'.length);
    return isIP(mappedAddress) !== 4 || isPrivateAddress(mappedAddress);
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('64:ff9b:')
  );
}
