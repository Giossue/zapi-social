import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createDatabase, type Database } from '@workspace/database'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: ReturnType<typeof createDatabase>['client']
  readonly db: Database

  constructor(config: ConfigService) {
    const database = createDatabase(config.getOrThrow<string>('DATABASE_URL'))
    this.client = database.client
    this.db = database.db
  }

  async onModuleDestroy() {
    await this.client.end()
  }
}
