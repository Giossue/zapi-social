import {
  blogPosts,
  createDatabase,
  languages,
  type Database,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import { DatabaseService } from './database/database.service';
import { ContentService } from './content/content.service';

const databaseUrl = process.env.SUPPORT_WATERMARKS_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback admin content integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local test database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

function serviceFor(database: Database) {
  return new ContentService({ db: database } as unknown as DatabaseService);
}

describeDatabase('Admin content service', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('keeps the original publish date when a published post is edited', async () => {
    await inRollbackTransaction(async (database) => {
      const content = serviceFor(database);
      const created = await content.saveBlogPost(null, {
        content: 'Cuerpo inicial',
        excerpt: '',
        status: 'published',
        tagIds: [],
        title: 'Entrada publicada',
      });

      const [afterCreate] = await database
        .select({ publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(eq(blogPosts.id, created.id));
      expect(afterCreate?.publishedAt).not.toBeNull();

      await content.saveBlogPost(created.id, {
        content: 'Cuerpo corregido',
        excerpt: '',
        status: 'published',
        tagIds: [],
        title: 'Entrada publicada',
      });

      const [afterEdit] = await database
        .select({ publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(eq(blogPosts.id, created.id));
      expect(afterEdit?.publishedAt?.toISOString()).toBe(
        afterCreate?.publishedAt?.toISOString(),
      );
    });
  });

  it('clears the publish date when a post returns to draft', async () => {
    await inRollbackTransaction(async (database) => {
      const content = serviceFor(database);
      const created = await content.saveBlogPost(null, {
        content: '',
        excerpt: '',
        status: 'published',
        tagIds: [],
        title: 'Entrada que vuelve a borrador',
      });

      await content.saveBlogPost(created.id, {
        content: '',
        excerpt: '',
        status: 'draft',
        tagIds: [],
        title: 'Entrada que vuelve a borrador',
      });

      const [row] = await database
        .select({ publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(eq(blogPosts.id, created.id));
      expect(row?.publishedAt).toBeNull();
    });
  });

  it('promotes the first language to default even without asking', async () => {
    await inRollbackTransaction(async (database) => {
      await database.delete(languages);
      const content = serviceFor(database);
      const suffix = Date.now().toString(36).slice(-6);
      await content.saveLanguage(null, {
        code: `qz-${suffix}`,
        direction: 'ltr',
        isActive: true,
        isDefault: false,
        name: 'Primer idioma',
        nativeName: 'Primer idioma',
        sortOrder: 0,
      });

      const defaults = await database
        .select({ id: languages.id })
        .from(languages)
        .where(eq(languages.isDefault, true));
      expect(defaults).toHaveLength(1);
    });
  });

  it('leaves a single default language when another one is promoted', async () => {
    await inRollbackTransaction(async (database) => {
      const content = serviceFor(database);
      const suffix = Date.now().toString(36).slice(-6);
      await content.saveLanguage(null, {
        code: `qa-${suffix}`,
        direction: 'ltr',
        isActive: true,
        isDefault: true,
        name: 'Idioma uno',
        nativeName: 'Idioma uno',
        sortOrder: 0,
      });
      await content.saveLanguage(null, {
        code: `qb-${suffix}`,
        direction: 'ltr',
        isActive: true,
        isDefault: true,
        name: 'Idioma dos',
        nativeName: 'Idioma dos',
        sortOrder: 1,
      });

      const defaults = await database
        .select({ id: languages.id })
        .from(languages)
        .where(eq(languages.isDefault, true));
      expect(defaults).toHaveLength(1);
    });
  });
});
