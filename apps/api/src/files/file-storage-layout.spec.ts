import {
  derivativeStoragePrefix,
  originalStorageKey,
  publishVariantStorageKey,
  storageExtension,
  temporaryStorageKey,
  thumbnailStorageKey,
  workspaceStoragePrefix,
} from '@workspace/file-ingestion';

const workspaceId = 'a7537679-6998-4312-b1c2-7d5e9f0a1b2c';
const assetId = '548bdf2d-1111-4222-8333-444455556666';

describe('Disposición de claves de Files', () => {
  it('agrupa cada espacio bajo un shard de dos caracteres', () => {
    expect(workspaceStoragePrefix(workspaceId)).toBe(`ws/a7/${workspaceId}`);
  });

  it('particiona los originales por año y mes en UTC', () => {
    const key = originalStorageKey({
      workspaceId,
      assetId,
      extension: 'foto.PNG',
      at: new Date('2026-01-31T23:30:00Z'),
    });
    expect(key).toBe(`ws/a7/${workspaceId}/orig/2026/01/${assetId}.png`);
  });

  it('acepta un original sin extensión reconocible', () => {
    const key = originalStorageKey({
      workspaceId,
      assetId,
      extension: 'archivo sin punto',
      at: new Date('2026-08-02T00:00:00Z'),
    });
    expect(key).toBe(`ws/a7/${workspaceId}/orig/2026/08/${assetId}`);
  });

  it('reúne los derivados de un asset en su propia carpeta', () => {
    const prefix = derivativeStoragePrefix(workspaceId, assetId);
    expect(thumbnailStorageKey(workspaceId, assetId)).toBe(
      `${prefix}/thumb.webp`,
    );
    expect(
      publishVariantStorageKey({
        workspaceId,
        assetId,
        postId: 'ffffffff-0000-4000-8000-000000000000',
        extension: 'original.mp4',
      }),
    ).toBe(`${prefix}/publish-ffffffff-0000-4000-8000-000000000000.mp4`);
  });

  it('mantiene los temporales fuera del árbol del cliente', () => {
    expect(temporaryStorageKey('subida-1')).toBe('tmp/subida-1');
    expect(temporaryStorageKey('subida-1').startsWith('ws/')).toBe(false);
  });

  it('no deja que un nombre hostil escape de la clave', () => {
    expect(storageExtension('../../etc/passwd')).toBe('');
    expect(storageExtension('foto.png/../../secreto')).toBe('');
    expect(storageExtension('video.MP4')).toBe('.mp4');
  });

  it('usa un shard estable aunque el identificador sea atípico', () => {
    expect(workspaceStoragePrefix('!!')).toBe('ws/00/!!');
  });
});
