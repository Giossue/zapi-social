import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ChannelProviderIntegrationsService } from './channel-provider-integrations.service';
import { IntegrationsModule } from './integrations.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';

/**
 * `typecheck` y las pruebas unitarias no resuelven la inyección de Nest: un
 * servicio puede compilar y aun así tumbar la aplicación al arrancar. Pasó de
 * verdad —inyectar `Aes256GcmService`, que en la API no es un proveedor sino
 * una clase que recibe su clave— y el fallo solo se vio como un 502 en
 * producción. Esta prueba construye el grafo real.
 */
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
              // Valores de relleno: la prueba comprueba el grafo de
              // dependencias, no la configuración.
              JWT_ACCESS_SECRET: 'test-access-secret',
              JWT_REFRESH_SECRET: 'test-refresh-secret',
              WEB_ORIGIN: 'https://app.example.test',
            }),
          ],
        }),
        // `DatabaseModule` es global: sin él, quien lo necesita desde otro
        // módulo no se resuelve.
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
