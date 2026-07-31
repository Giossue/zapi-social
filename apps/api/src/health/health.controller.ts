import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Redis } from 'ioredis'
import { DatabaseService } from '../database/database.service'

@ApiTags('health')
@Controller('v1/health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @ApiOkResponse()
  async getHealth() {
    const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) })

    try {
      await Promise.all([this.database.client.unsafe('select 1'), redis.ping()])
      return { status: 'ok' as const, database: 'ok' as const, redis: 'ok' as const }
    } catch {
      throw new ServiceUnavailableException('Infrastructure dependency unavailable')
    } finally {
      await redis.quit()
    }
  }
}
