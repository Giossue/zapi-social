import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ChannelConnectionsService } from './channel-connections.service';
import { ChannelsModule } from './channels.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';

describe('channels module wiring', () => {
  it('resolves the connection service with all adapters', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              API_PUBLIC_ORIGIN: 'https://api.example.test',
              WEB_ORIGIN: 'https://app.example.test',
              PROVIDER_INTEGRATIONS_ENCRYPTION_KEY:
                Buffer.alloc(32).toString('base64'),
              JWT_ACCESS_SECRET: 'test-access',
              JWT_REFRESH_SECRET: 'test-refresh',
              REDIS_HOST: '127.0.0.1',
              REDIS_PORT: '6379',
            }),
          ],
        }),
        DatabaseModule,
        ChannelsModule,
      ],
    })
      .overrideProvider(getQueueToken('meta-profile-sync'))
      .useValue({ add: () => Promise.resolve() })
      .overrideProvider(getQueueToken('whatsapp-profile-sync'))
      .useValue({ add: () => Promise.resolve() })
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();

    expect(moduleRef.get(ChannelConnectionsService)).toBeInstanceOf(
      ChannelConnectionsService,
    );
    await moduleRef.close();
  });
});

function getQueueToken(name: string) {
  return `BullQueue_${name}`;
}
