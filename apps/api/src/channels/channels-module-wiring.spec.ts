import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ChannelConnectionsService } from './channel-connections.service';
import { ChannelsModule } from './channels.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';

/**
 * Compila el grafo real de `ChannelsModule` con Nest. Un servicio puede
 * pasar `typecheck` y aun así tumbar la API al arrancar si una dependencia no
 * se resuelve; ya ocurrió una vez y solo se vio como un 502 en producción.
 * Aquí se registran los tres adaptadores nuevos por `useFactory`, que es
 * justo el punto donde un `inject` mal puesto no lo caza el compilador.
 */
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
      // BullMQ intenta abrir Redis al construir las colas; se sustituye.
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
