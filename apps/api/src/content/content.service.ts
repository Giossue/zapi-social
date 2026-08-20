import { HttpStatus, Injectable } from '@nestjs/common';
import {
  aiTemplateCategories,
  aiTemplates,
  blogCategories,
  blogPostTags,
  blogPosts,
  blogTags,
  faqs,
  languages,
} from '@workspace/database';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from '@workspace/database/query';
import {
  adminBlogPostsQuerySchema,
  adminContentListQuerySchema,
  upsertAdminAiTemplateSchema,
  upsertAdminBlogPostSchema,
  upsertAdminBlogTagSchema,
  upsertAdminFaqSchema,
  upsertAdminLanguageSchema,
  upsertAdminTaxonomySchema,
  type AdminAiTemplatesResponse,
  type AdminBlogPostsResponse,
  type AdminBlogTagsResponse,
  type AdminFaqsResponse,
  type AdminLanguagesResponse,
  type AdminTaxonomiesResponse,
} from '@workspace/contracts';
import { AppException } from '../platform/errors/app-exception';
import { DatabaseService } from '../database/database.service';

type TaxonomyTable = typeof blogCategories | typeof aiTemplateCategories;

type ContentTable =
  | typeof aiTemplateCategories
  | typeof aiTemplates
  | typeof blogCategories
  | typeof blogPosts
  | typeof blogTags
  | typeof faqs
  | typeof languages;

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

/** Contenido global de plataforma: idiomas, blog, FAQs y plantillas de IA. */
@Injectable()
export class ContentService {
  constructor(private readonly database: DatabaseService) {}

  async listLanguages(query: unknown): Promise<AdminLanguagesResponse> {
    const { page, limit, q, status } = this.listQuery(query);
    const where = this.combine(
      status === 'all'
        ? undefined
        : eq(languages.isActive, status === 'active'),
      q
        ? or(ilike(languages.name, `%${q}%`), ilike(languages.code, `%${q}%`))
        : undefined,
    );
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(languages)
        .where(where)
        .orderBy(
          desc(languages.isDefault),
          asc(languages.sortOrder),
          asc(languages.name),
        )
        .limit(limit)
        .offset((page - 1) * limit),
      this.count(languages, where),
    ]);
    return {
      languages: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        nativeName: row.nativeName,
        direction: row.direction,
        isDefault: row.isDefault,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
    };
  }

  async saveLanguage(id: string | null, input: unknown) {
    const parsed = upsertAdminLanguageSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const values = parsed.data;

    return this.database.db.transaction(async (tx) => {
      if (values.isDefault) {
        await tx
          .update(languages)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(id ? ne(languages.id, id) : sql`true`);
      }
      if (id) {
        const [row] = await tx
          .update(languages)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(languages.id, id))
          .returning();
        if (!row) throw this.notFound();
        return row;
      }
      const [row] = await tx.insert(languages).values(values).returning();
      return row;
    });
  }

  async removeLanguage(id: string) {
    const [row] = await this.database.db
      .select({ isDefault: languages.isDefault })
      .from(languages)
      .where(eq(languages.id, id))
      .limit(1);
    if (!row) throw this.notFound();
    if (row.isDefault) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.CONFLICT);
    }
    await this.database.db.delete(languages).where(eq(languages.id, id));
  }

  listBlogCategories(query: unknown) {
    return this.listTaxonomy(blogCategories, query);
  }

  saveBlogCategory(id: string | null, input: unknown) {
    return this.saveTaxonomy(blogCategories, id, input);
  }

  removeBlogCategory(id: string) {
    return this.removeRow(blogCategories, id);
  }

  listAiTemplateCategories(query: unknown) {
    return this.listTaxonomy(aiTemplateCategories, query);
  }

  saveAiTemplateCategory(id: string | null, input: unknown) {
    return this.saveTaxonomy(aiTemplateCategories, id, input);
  }

  removeAiTemplateCategory(id: string) {
    return this.removeRow(aiTemplateCategories, id);
  }

  async listBlogTags(query: unknown): Promise<AdminBlogTagsResponse> {
    const { page, limit, q } = this.listQuery(query);
    const where = q ? ilike(blogTags.name, `%${q}%`) : undefined;
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(blogTags)
        .where(where)
        .orderBy(asc(blogTags.name))
        .limit(limit)
        .offset((page - 1) * limit),
      this.count(blogTags, where),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
    };
  }

  async saveBlogTag(id: string | null, input: unknown) {
    const parsed = upsertAdminBlogTagSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const values = {
      name: parsed.data.name,
      slug: parsed.data.slug ?? slugify(parsed.data.name),
    };
    if (!values.slug) throw this.invalid();
    try {
      if (id) {
        const [row] = await this.database.db
          .update(blogTags)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(blogTags.id, id))
          .returning();
        if (!row) throw this.notFound();
        return row;
      }
      const [row] = await this.database.db
        .insert(blogTags)
        .values(values)
        .returning();
      return row;
    } catch (error) {
      throw this.conflictOr(error);
    }
  }

  removeBlogTag(id: string) {
    return this.removeRow(blogTags, id);
  }

  async listBlogPosts(query: unknown): Promise<AdminBlogPostsResponse> {
    const parsed = adminBlogPostsQuerySchema.safeParse(query ?? {});
    if (!parsed.success) throw this.invalid();
    const { page, limit, q, status } = parsed.data;
    const filters = [
      status === 'all' ? undefined : eq(blogPosts.status, status),
      q
        ? or(ilike(blogPosts.title, `%${q}%`), ilike(blogPosts.slug, `%${q}%`))
        : undefined,
    ].filter(Boolean);
    const where = filters.length ? and(...filters) : undefined;

    const [rows, total, categories, tags] = await Promise.all([
      this.database.db
        .select({
          id: blogPosts.id,
          slug: blogPosts.slug,
          title: blogPosts.title,
          excerpt: blogPosts.excerpt,
          content: blogPosts.content,
          status: blogPosts.status,
          categoryId: blogPosts.categoryId,
          categoryName: blogCategories.name,
          publishedAt: blogPosts.publishedAt,
          createdAt: blogPosts.createdAt,
        })
        .from(blogPosts)
        .leftJoin(blogCategories, eq(blogCategories.id, blogPosts.categoryId))
        .where(where)
        .orderBy(desc(blogPosts.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.count(blogPosts, where),
      this.database.db
        .select()
        .from(blogCategories)
        .orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name)),
      this.database.db.select().from(blogTags).orderBy(asc(blogTags.name)),
    ]);

    const postIds = rows.map((row) => row.id);
    const relations = postIds.length
      ? await this.database.db
          .select()
          .from(blogPostTags)
          .where(inArray(blogPostTags.postId, postIds))
      : [];

    return {
      posts: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        content: row.content,
        status: row.status,
        categoryId: row.categoryId,
        categoryName: row.categoryName ?? null,
        tagIds: relations
          .filter((relation) => relation.postId === row.id)
          .map((relation) => relation.tagId),
        publishedAt: row.publishedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      categories: categories.map((row) => this.taxonomyOut(row)),
      tags: tags.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
    };
  }

  async saveBlogPost(id: string | null, input: unknown) {
    const parsed = upsertAdminBlogPostSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const { tagIds, ...values } = parsed.data;
    const slug = values.slug ?? slugify(values.title);
    if (!slug) throw this.invalid();
    const publishedAt = values.status === 'published' ? new Date() : null;

    try {
      return await this.database.db.transaction(async (tx) => {
        const postId = id
          ? (
              await tx
                .update(blogPosts)
                .set({
                  ...values,
                  slug,
                  publishedAt,
                  updatedAt: new Date(),
                })
                .where(eq(blogPosts.id, id))
                .returning({ id: blogPosts.id })
            )[0]?.id
          : (
              await tx
                .insert(blogPosts)
                .values({ ...values, slug, publishedAt })
                .returning({ id: blogPosts.id })
            )[0]?.id;
        if (!postId) throw this.notFound();

        await tx.delete(blogPostTags).where(eq(blogPostTags.postId, postId));
        if (tagIds.length) {
          await tx
            .insert(blogPostTags)
            .values(tagIds.map((tagId) => ({ postId, tagId })));
        }
        return { id: postId };
      });
    } catch (error) {
      throw this.conflictOr(error);
    }
  }

  removeBlogPost(id: string) {
    return this.removeRow(blogPosts, id);
  }

  async listFaqs(query: unknown): Promise<AdminFaqsResponse> {
    const { page, limit, q, status } = this.listQuery(query);
    const where = this.combine(
      status === 'all' ? undefined : eq(faqs.isActive, status === 'active'),
      q ? ilike(faqs.question, `%${q}%`) : undefined,
    );
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(faqs)
        .where(where)
        .orderBy(asc(faqs.sortOrder), asc(faqs.question))
        .limit(limit)
        .offset((page - 1) * limit),
      this.count(faqs, where),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
    };
  }

  async saveFaq(id: string | null, input: unknown) {
    const parsed = upsertAdminFaqSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    if (id) {
      const [row] = await this.database.db
        .update(faqs)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(faqs.id, id))
        .returning();
      if (!row) throw this.notFound();
      return row;
    }
    const [row] = await this.database.db
      .insert(faqs)
      .values(parsed.data)
      .returning();
    return row;
  }

  removeFaq(id: string) {
    return this.removeRow(faqs, id);
  }

  async listAiTemplates(query: unknown): Promise<AdminAiTemplatesResponse> {
    const { page, limit, q, status } = this.listQuery(query);
    const where = this.combine(
      status === 'all'
        ? undefined
        : eq(aiTemplates.isActive, status === 'active'),
      q ? ilike(aiTemplates.name, `%${q}%`) : undefined,
    );
    const [rows, total, categories] = await Promise.all([
      this.database.db
        .select({
          id: aiTemplates.id,
          slug: aiTemplates.slug,
          name: aiTemplates.name,
          description: aiTemplates.description,
          prompt: aiTemplates.prompt,
          isActive: aiTemplates.isActive,
          sortOrder: aiTemplates.sortOrder,
          categoryId: aiTemplates.categoryId,
          categoryName: aiTemplateCategories.name,
          createdAt: aiTemplates.createdAt,
        })
        .from(aiTemplates)
        .leftJoin(
          aiTemplateCategories,
          eq(aiTemplateCategories.id, aiTemplates.categoryId),
        )
        .where(where)
        .orderBy(asc(aiTemplates.sortOrder), asc(aiTemplates.name))
        .limit(limit)
        .offset((page - 1) * limit),
      this.count(aiTemplates, where),
      this.database.db
        .select()
        .from(aiTemplateCategories)
        .orderBy(
          asc(aiTemplateCategories.sortOrder),
          asc(aiTemplateCategories.name),
        ),
    ]);
    return {
      templates: rows.map((row) => ({
        ...row,
        categoryName: row.categoryName ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      categories: categories.map((row) => this.taxonomyOut(row)),
      page,
      limit,
      total,
    };
  }

  async saveAiTemplate(id: string | null, input: unknown) {
    const parsed = upsertAdminAiTemplateSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const values = parsed.data;
    const slug = values.slug ?? slugify(values.name);
    if (!slug) throw this.invalid();
    try {
      if (id) {
        const [row] = await this.database.db
          .update(aiTemplates)
          .set({ ...values, slug, updatedAt: new Date() })
          .where(eq(aiTemplates.id, id))
          .returning();
        if (!row) throw this.notFound();
        return row;
      }
      const [row] = await this.database.db
        .insert(aiTemplates)
        .values({ ...values, slug })
        .returning();
      return row;
    } catch (error) {
      throw this.conflictOr(error);
    }
  }

  removeAiTemplate(id: string) {
    return this.removeRow(aiTemplates, id);
  }

  private async listTaxonomy(
    table: TaxonomyTable,
    query: unknown,
  ): Promise<AdminTaxonomiesResponse> {
    const { page, limit, q, status } = this.listQuery(query);
    const where = this.combine(
      status === 'all' ? undefined : eq(table.isActive, status === 'active'),
      q ? ilike(table.name, `%${q}%`) : undefined,
    );
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(table)
        .where(where)
        .orderBy(asc(table.sortOrder), asc(table.name))
        .limit(limit)
        .offset((page - 1) * limit),
      this.count(table, where),
    ]);
    return {
      items: rows.map((row) => this.taxonomyOut(row)),
      page,
      limit,
      total,
    };
  }

  private async saveTaxonomy(
    table: TaxonomyTable,
    id: string | null,
    input: unknown,
  ) {
    const parsed = upsertAdminTaxonomySchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const values = parsed.data;
    const slug = values.slug ?? slugify(values.name);
    if (!slug) throw this.invalid();
    try {
      if (id) {
        const [row] = await this.database.db
          .update(table)
          .set({ ...values, slug, updatedAt: new Date() })
          .where(eq(table.id, id))
          .returning();
        if (!row) throw this.notFound();
        return row;
      }
      const [row] = await this.database.db
        .insert(table)
        .values({ ...values, slug })
        .returning();
      return row;
    } catch (error) {
      throw this.conflictOr(error);
    }
  }

  private taxonomyOut(row: {
    id: string;
    slug: string;
    name: string;
    description: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private listQuery(query: unknown) {
    const parsed = adminContentListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) throw this.invalid();
    return parsed.data;
  }

  private combine(...conditions: (SQL | undefined)[]) {
    const filters = conditions.filter((value): value is SQL => Boolean(value));
    return filters.length ? and(...filters) : undefined;
  }

  private async count(table: ContentTable, where: SQL | undefined) {
    const [row] = await this.database.db
      .select({ total: sql<number>`count(*)::int` })
      .from(table)
      .where(where);
    return row?.total ?? 0;
  }

  private async removeRow(table: ContentTable, id: string) {
    const rows = await this.database.db
      .delete(table)
      .where(eq(table.id, id))
      .returning({ id: table.id });
    if (!rows.length) throw this.notFound();
  }

  private conflictOr(error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    ) {
      return new AppException('VALIDATION_FAILED', HttpStatus.CONFLICT);
    }
    return error instanceof AppException ? error : this.invalid();
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private notFound() {
    return new AppException('CONTENT_RESOURCE_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}
