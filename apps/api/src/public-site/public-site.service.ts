import { HttpStatus, Injectable } from '@nestjs/common';
import {
  blogCategories,
  blogPostTags,
  blogPosts,
  blogTags,
  creditPackages,
  faqs,
  languages,
  plans,
  platformSettings,
} from '@workspace/database';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
} from '@workspace/database/query';
import {
  adminAnalyticsSettingsSchema,
  adminAuthSettingsSchema,
  adminGeneralSettingsSchema,
  adminStaticPagesSettingsSchema,
  publicSitePostsQuerySchema,
  type PublicSiteOverview,
  type PublicSitePage,
  type PublicSitePost,
  type PublicSitePostsResponse,
  type PublicSiteSettings,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

/**
 * Lectura pública del sitio. Sin sesión y sin datos de clientes: solo lo que el
 * Admin marca como publicado. Cada consulta filtra por estado activo/publicado,
 * de modo que un borrador nunca puede escaparse a la web pública.
 */
@Injectable()
export class PublicSiteService {
  constructor(private readonly database: DatabaseService) {}

  async overview(): Promise<PublicSiteOverview> {
    const [settings, languageRows, planRows, packageRows, faqRows, pages] =
      await Promise.all([
        this.settings(),
        this.languages(),
        this.plans(),
        this.creditPackages(),
        this.faqs(),
        this.pages(),
      ]);
    return {
      settings,
      languages: languageRows,
      plans: planRows,
      creditPackages: packageRows,
      faqs: faqRows,
      pages,
    };
  }

  async page(slug: string): Promise<PublicSitePage> {
    const parsed = adminStaticPagesSettingsSchema.parse(
      await this.settingsGroup('static-pages'),
    );
    const page = parsed.pages.find(
      (candidate) => candidate.slug === slug && candidate.isPublished,
    );
    if (!page) throw this.notFound();
    return { slug: page.slug, title: page.title, content: page.content };
  }

  async posts(query: unknown): Promise<PublicSitePostsResponse> {
    const filters = this.parse(publicSitePostsQuerySchema.safeParse(query));
    const conditions = [eq(blogPosts.status, 'published')];
    if (filters.category)
      conditions.push(eq(blogCategories.slug, filters.category));
    if (filters.q) {
      const value = `%${filters.q}%`;
      conditions.push(
        or(ilike(blogPosts.title, value), ilike(blogPosts.excerpt, value))!,
      );
    }
    const where = and(...conditions)!;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows, categoryRows] = await Promise.all([
      this.database.db
        .select({
          slug: blogPosts.slug,
          title: blogPosts.title,
          excerpt: blogPosts.excerpt,
          categoryName: blogCategories.name,
          publishedAt: blogPosts.publishedAt,
        })
        .from(blogPosts)
        .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
        .where(where)
        .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
        .limit(filters.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(blogPosts)
        .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
        .where(where),
      this.database.db
        .select({ slug: blogCategories.slug, name: blogCategories.name })
        .from(blogCategories)
        .where(eq(blogCategories.isActive, true))
        .orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name)),
    ]);
    return {
      posts: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        categoryName: row.categoryName ?? null,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      })),
      categories: categoryRows,
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async post(slug: string): Promise<PublicSitePost> {
    const [row] = await this.database.db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        excerpt: blogPosts.excerpt,
        content: blogPosts.content,
        categoryName: blogCategories.name,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')))
      .limit(1);
    if (!row) throw this.notFound();
    const tagRows = await this.database.db
      .select({ name: blogTags.name })
      .from(blogPostTags)
      .innerJoin(blogTags, eq(blogPostTags.tagId, blogTags.id))
      .where(inArray(blogPostTags.postId, [row.id]))
      .orderBy(asc(blogTags.name));
    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      content: row.content,
      categoryName: row.categoryName ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      tags: tagRows.map((tag) => tag.name),
    };
  }

  private async settings(): Promise<PublicSiteSettings> {
    const [general, analytics, auth] = await Promise.all([
      this.settingsGroup('general'),
      this.settingsGroup('analytics'),
      this.settingsGroup('auth'),
    ]);
    const generalValues = adminGeneralSettingsSchema.parse(general);
    const analyticsValues = adminAnalyticsSettingsSchema.parse(analytics);
    const authValues = adminAuthSettingsSchema.parse(auth);
    return {
      ...generalValues,
      /** El identificador solo sale si además se pidió rastrear visitantes. */
      analytics:
        analyticsValues.googleAnalyticsEnabled &&
        analyticsValues.trackGuests &&
        analyticsValues.googleAnalyticsMeasurementId
          ? { measurementId: analyticsValues.googleAnalyticsMeasurementId }
          : null,
      registrationEnabled: authValues.registrationEnabled,
    };
  }

  private async settingsGroup(key: string) {
    const [row] = await this.database.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);
    return row?.value ?? {};
  }

  private async languages() {
    const rows = await this.database.db
      .select()
      .from(languages)
      .where(eq(languages.isActive, true))
      .orderBy(asc(languages.sortOrder), asc(languages.name));
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      nativeName: row.nativeName,
      direction: row.direction,
      isDefault: row.isDefault,
    }));
  }

  private async plans() {
    const rows = await this.database.db
      .select()
      .from(plans)
      .where(eq(plans.status, 'active'))
      .orderBy(asc(plans.position), asc(plans.name));
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      currency: row.currency,
      priceMinor: Math.round(Number(row.price) * 100),
      billingType: row.billingType,
      isFree: row.isFree,
      featured: row.featured,
      trialDays: row.trialDays,
      position: row.position,
      permissionIds: row.permissionIds ?? [],
    }));
  }

  private async creditPackages() {
    const rows = await this.database.db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.status, 'active'))
      .orderBy(asc(creditPackages.position), asc(creditPackages.name));
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      units: row.units,
      priceMinor: row.priceMinor,
      currency: row.currency,
      featured: row.featured,
    }));
  }

  private async faqs() {
    const rows = await this.database.db
      .select()
      .from(faqs)
      .where(eq(faqs.isActive, true))
      .orderBy(asc(faqs.sortOrder), asc(faqs.createdAt));
    return rows.map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
    }));
  }

  private async pages() {
    const parsed = adminStaticPagesSettingsSchema.parse(
      await this.settingsGroup('static-pages'),
    );
    return parsed.pages
      .filter((page) => page.isPublished)
      .map((page) => ({ slug: page.slug, title: page.title }));
  }

  private parse<T>(result: { success: true; data: T } | { success: false }) {
    if (!result.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return result.data;
  }

  private notFound() {
    return new AppException('PUBLIC_CONTENT_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}
