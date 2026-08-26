import { HttpStatus, Injectable } from '@nestjs/common';
import { platformSettings } from '@workspace/database';
import { eq } from '@workspace/database/query';
import {
  adminAnalyticsSettingsSchema,
  adminAuthSettingsSchema,
  adminBrandingSettingsSchema,
  adminGeneralSettingsSchema,
  adminPublicSiteSettingsSchema,
  adminSettingsGroupSchema,
  adminStaticPagesSettingsSchema,
  type AdminCacheState,
  type AdminScheduledJobs,
  type AdminScheduledQueue,
} from '@workspace/contracts';
import { Redis } from 'ioredis';
import type { ZodType } from 'zod';
import { AppException } from '../platform/errors/app-exception';
import { DatabaseService } from '../database/database.service';

const groupSchemas = {
  general: adminGeneralSettingsSchema,
  auth: adminAuthSettingsSchema,
  analytics: adminAnalyticsSettingsSchema,
  'static-pages': adminStaticPagesSettingsSchema,
  'public-site': adminPublicSiteSettingsSchema,
  branding: adminBrandingSettingsSchema,
} satisfies Record<string, ZodType>;

const scheduledQueues = [
  { queue: 'rss-schedule-dispatch' },
  { queue: 'ai-schedule-dispatch' },
  { queue: 'automation-webhooks' },
  { queue: 'meta-profile-schedule' },
  { queue: 'whatsapp-profile-schedule' },
  { queue: 'file-imports' },
  { queue: 'file-derivatives' },
] as const satisfies readonly { queue: AdminScheduledQueue }[];

const cachePurgeKey = 'cache:last-purged-at';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly database: DatabaseService) {}

  async get(group: unknown) {
    const key = this.group(group);
    const [row] = await this.database.db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);
    return groupSchemas[key].parse(row?.value ?? {});
  }

  async save(group: unknown, input: unknown) {
    const key = this.group(group);
    const parsed = groupSchemas[key].safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    const value = parsed.data as Record<string, unknown>;
    await this.database.db
      .insert(platformSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, updatedAt: new Date() },
      });
    return parsed.data;
  }

  async cacheState(): Promise<AdminCacheState> {
    const redis = this.redis();
    try {
      await redis.connect();
      const [keys, info, lastPurgedAt] = await Promise.all([
        redis.dbsize(),
        redis.info('memory'),
        redis.get(cachePurgeKey),
      ]);
      return {
        reachable: true,
        keys,
        memoryUsed: /used_memory_human:(\S+)/.exec(info)?.[1] ?? 'desconocido',
        lastPurgedAt,
      };
    } catch {
      return {
        reachable: false,
        keys: 0,
        memoryUsed: 'desconocido',
        lastPurgedAt: null,
      };
    } finally {
      redis.disconnect();
    }
  }

  async purgeCache() {
    const redis = this.redis();
    try {
      await redis.connect();
      let cursor = '0';
      let removed = 0;
      do {
        const [next, keys] = await redis.scan(
          cursor,
          'MATCH',
          'cache:*',
          'COUNT',
          200,
        );
        cursor = next;
        const purgeable = keys.filter((key) => key !== cachePurgeKey);
        if (purgeable.length) {
          removed += await redis.del(...purgeable);
        }
      } while (cursor !== '0');
      await redis.set(cachePurgeKey, new Date().toISOString());
      return { removed };
    } catch {
      throw new AppException(
        'PLATFORM_CACHE_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      redis.disconnect();
    }
  }

  async scheduledJobs(): Promise<AdminScheduledJobs> {
    const redis = this.redis();
    try {
      await redis.connect();
      const jobs = await Promise.all(
        scheduledQueues.map(async (entry) => {
          const prefix = `bull:${entry.queue}`;
          const [waiting, delayed, failed, repeatables] = await Promise.all([
            redis.llen(`${prefix}:wait`),
            redis.zcard(`${prefix}:delayed`),
            redis.zcard(`${prefix}:failed`),
            redis.zrange(`${prefix}:repeat`, 0, 0, 'WITHSCORES'),
          ]);
          const nextRunScore = Number(repeatables[1]);
          const everyMatch = /:{0,1}(\d+)$/.exec(repeatables[0] ?? '');
          const everyMs = everyMatch ? Number(everyMatch[1]) : NaN;
          return {
            queue: entry.queue,
            everyMinutes:
              Number.isFinite(everyMs) && everyMs >= 60_000
                ? Math.round(everyMs / 60_000)
                : null,
            nextRunAt: Number.isFinite(nextRunScore)
              ? new Date(nextRunScore).toISOString()
              : null,
            waiting,
            delayed,
            failed,
          };
        }),
      );
      return { reachable: true, jobs };
    } catch {
      return { reachable: false, jobs: [] };
    } finally {
      redis.disconnect();
    }
  }

  private group(value: unknown) {
    const parsed = adminSettingsGroupSchema.safeParse(value);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    return parsed.data;
  }

  private redis() {
    return new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }
}
