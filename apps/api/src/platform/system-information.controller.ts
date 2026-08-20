import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminSystemInformation } from '@workspace/contracts';
import type { FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';
import { DatabaseService } from '../database/database.service';
import { SessionAccessService } from '../identity/session-access.service';

/** Estado observable de la plataforma: runtime, dependencias y migraciones aplicadas. */
@ApiTags('admin-system')
@Controller('v1/admin/system-information')
export class SystemInformationController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly database: DatabaseService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest): Promise<AdminSystemInformation> {
    await this.access.requirePlatformAdmin(request);

    const [database, redis, migrations] = await Promise.all([
      this.databaseCheck(),
      this.redisCheck(),
      this.migrationsApplied(),
    ]);

    return {
      environment: process.env.NODE_ENV ?? 'development',
      runtime: [
        { label: 'Node.js', value: process.version },
        { label: 'Plataforma', value: `${process.platform} ${process.arch}` },
        {
          label: 'Memoria en uso',
          value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
        },
      ],
      services: [database, redis],
      migrationsApplied: migrations,
      uptimeSeconds: Math.floor(process.uptime()),
      generatedAt: new Date().toISOString(),
    };
  }

  private async databaseCheck() {
    try {
      const [row] = await this.database.client.unsafe<
        { version: string }[]
      >('select version() as version');
      return {
        label: 'PostgreSQL',
        detail: row?.version?.split(' ').slice(0, 2).join(' ') ?? 'Disponible',
        passed: true,
      };
    } catch {
      return {
        label: 'PostgreSQL',
        detail: 'No responde a la consulta de verificación.',
        passed: false,
      };
    }
  }

  private async redisCheck() {
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await redis.connect();
      const info = await redis.info('server');
      const version = /redis_version:(\S+)/.exec(info)?.[1];
      return {
        label: 'Redis',
        detail: version ? `Versión ${version}` : 'Disponible',
        passed: true,
      };
    } catch {
      return {
        label: 'Redis',
        detail: 'No responde al ping de verificación.',
        passed: false,
      };
    } finally {
      redis.disconnect();
    }
  }

  private async migrationsApplied() {
    try {
      const [row] = await this.database.client.unsafe<{ total: number }[]>(
        'select count(*)::int as total from drizzle.__drizzle_migrations',
      );
      return row?.total ?? 0;
    } catch {
      return 0;
    }
  }
}
