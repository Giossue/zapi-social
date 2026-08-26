import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { PortalAuthSession } from '@workspace/contracts';
import type { Queue } from 'bullmq';
import type { DatabaseService } from '../database/database.service';
import type { IntegrationsService } from '../integrations/integrations.service';
import { OnlineMediaService } from './online-media.service';

const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(28, 0x20),
]);

function databaseStub() {
  const inserted: Array<Record<string, unknown>> = [];
  const insert = () => ({
    values: (row: Record<string, unknown>) => {
      inserted.push(row);
      const pending = Promise.resolve(undefined) as Promise<undefined> & {
        returning: () => Promise<Array<{ id: unknown }>>;
      };
      pending.returning = () => Promise.resolve([{ id: row.id }]);
      return pending;
    },
  });
  const database = {
    db: {
      transaction: (run: (tx: unknown) => Promise<unknown>) => run({ insert }),
    },
  } as unknown as DatabaseService;
  return { database, inserted };
}

describe('Importación de medios online', () => {
  const originalFetch = globalThis.fetch;
  let storageRoot = '';

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'online-media-'));
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(storageRoot, { force: true, recursive: true });
  });

  it('guarda el binario aunque el árbol de almacenamiento aún no exista', async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(jpeg, {
          headers: {
            'content-type': 'image/jpeg',
            'content-length': String(jpeg.length),
          },
        }),
      );
    const { database, inserted } = databaseStub();
    const service = new OnlineMediaService(
      database,
      {} as IntegrationsService,
      { add: () => Promise.resolve(undefined) } as unknown as Queue,
      new ConfigService({ FILES_STORAGE_PATH: storageRoot }),
    );
    const session = {
      user: { id: '2b2b5b3b-8ac6-4891-975f-06a3a6bb3fc5' },
      workspace: {
        id: 'e013c968-aba5-4c72-941f-4041a965f67a',
        role: 'owner',
        permissions: [],
      },
    } as unknown as PortalAuthSession;

    const result = await service.import(session, {
      id: '674010',
      provider: 'pexels',
      type: 'image',
      title: 'Casa moderna',
      authorName: 'Autor de prueba',
      authorUrl: null,
      sourceUrl: 'https://www.pexels.com/photo/674010/',
      downloadUrl: 'https://images.pexels.com/photos/674010/foto.jpeg',
      mimeType: 'image/jpeg',
    });

    expect(result.fileAssetId).toBe(inserted[0]?.id);
    const storageKey = String(inserted[0]?.storageKey);
    expect(storageKey.endsWith('.jpg')).toBe(true);
    await expect(readFile(resolve(storageRoot, storageKey))).resolves.toEqual(
      jpeg,
    );
    expect(inserted[0]?.name).toBe('Casa moderna.jpg');
    expect(inserted[0]?.sizeBytes).toBe(jpeg.length);
  });
});
