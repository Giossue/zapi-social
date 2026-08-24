import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ChannelProviderIntegrationsService } from './channel-provider-integrations.service';
import { IntegrationsModule } from './integrations.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';

describe('integrations module wiring', () => {
  it('resolves every provider without booting the application', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              API_PUBLIC_ORIGIN: 'https://api.example.test',
              PROVIDER_INTEGRATIONS_ENCRYPTION_KEY:
                Buffer.alloc(32).toString('base64'),
              JWT_ACCESS_SECRET: 'test-access-secret',
              JWT_REFRESH_SECRET: 'test-refresh-secret',
              WEB_ORIGIN: 'https://app.example.test',
            }),
          ],
        }),
        DatabaseModule,
        IntegrationsModule,
      ],
    })
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();

    expect(moduleRef.get(ChannelProviderIntegrationsService)).toBeInstanceOf(
      ChannelProviderIntegrationsService,
    );

    await moduleRef.close();
  });
});
