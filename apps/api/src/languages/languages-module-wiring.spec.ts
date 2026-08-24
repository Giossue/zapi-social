import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { LanguagesModule } from './languages.module';
import { LanguagesService } from './languages.service';

describe('languages module wiring', () => {
  it('resolves the service with the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_ACCESS_SECRET: 'test-access',
              JWT_REFRESH_SECRET: 'test-refresh',
              PROVIDER_INTEGRATIONS_ENCRYPTION_KEY:
                Buffer.alloc(32).toString('base64'),
              REDIS_HOST: '127.0.0.1',
              REDIS_PORT: '6379',
            }),
          ],
        }),
        DatabaseModule,
        LanguagesModule,
      ],
    })
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();

    expect(moduleRef.get(LanguagesService)).toBeInstanceOf(LanguagesService);
    await moduleRef.close();
  });
});
