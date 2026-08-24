import { HttpStatus, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  baseLanguageCodes,
  createAdminPlatformLanguageSchema,
  flattenMessages,
  importAdminTranslationsSchema,
  listAdminTranslationsQuerySchema,
  localeCodeSchema,
  messageCatalogs,
  rtlLanguageCodes,
  saveAdminTranslationSchema,
  updateAdminPlatformLanguageSchema,
  worldLanguageCodes,
  type AdminPlatformLanguage,
  type AdminPlatformLanguagesResponse,
  type AdminTranslationsResponse,
  type ExportAdminTranslationsResponse,
  type ImportAdminTranslationsResult,
  type LanguageDirection,
  type PlatformAdminAuthSession,
  type PublicLanguageMessagesResponse,
  type PublicLanguagesResponse,
} from '@workspace/contracts';
import {
  apiAuditLogs,
  languages,
  platformTranslations,
} from '@workspace/database';
import { and, asc, eq, sql } from '@workspace/database/query';
import { Redis } from 'ioredis';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const sourceFlat = flattenMessages(messageCatalogs.es);
const fileFlat: Record<string, Record<string, string>> = {
  es: sourceFlat,
  en: flattenMessages(messageCatalogs.en),
};
const sourceKeys = Object.keys(sourceFlat).sort();
const ICU_ARGUMENT = /\{(\w+)\s*[,}]/g;
const ICU_KIND = /\{\w+\s*,\s*(\w+)/g;
const LANGUAGES_CACHE_KEY = 'i18n:languages';
const MESSAGES_CACHE_PREFIX = 'i18n:messages:';
const CACHE_TTL_SECONDS = 3600;

function matches(pattern: RegExp, value: string): string[] {
  return [...value.matchAll(pattern)].map((match) => match[1]);
}

export function icuMismatch(source: string, value: string): boolean {
  const sourceArguments = new Set(matches(ICU_ARGUMENT, source));
  const valueArguments = new Set(matches(ICU_ARGUMENT, value));
  if (
    sourceArguments.size !== valueArguments.size ||
    [...sourceArguments].some((name) => !valueArguments.has(name))
  ) {
    return true;
  }
  const sourceKinds = matches(ICU_KIND, source).sort();
  const valueKinds = matches(ICU_KIND, value).sort();
  return (
    sourceKinds.length !== valueKinds.length ||
    sourceKinds.some((kind, index) => kind !== valueKinds[index])
  );
}

@Injectable()
export class LanguagesService implements OnModuleDestroy {
  private client: Redis | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  onModuleDestroy() {
    this.client?.disconnect();
    this.client = null;
  }

  async activeLanguages(): Promise<PublicLanguagesResponse> {
    const cached = await this.cacheGet(LANGUAGES_CACHE_KEY);
    if (cached) return JSON.parse(cached) as PublicLanguagesResponse;
    const rows = await this.database.db
      .select()
      .from(languages)
      .where(eq(languages.isActive, true))
      .orderBy(asc(languages.sortOrder), asc(languages.name));
    const response: PublicLanguagesResponse = {
      languages: rows.map((row) => ({
        code: row.code,
        name: row.name,
        nativeName: row.nativeName,
        direction: row.direction,
        isDefault: row.isDefault,
      })),
    };
    await this.cacheSet(LANGUAGES_CACHE_KEY, JSON.stringify(response));
    return response;
  }

  async localeMessages(code: string): Promise<PublicLanguageMessagesResponse> {
    const parsed = localeCodeSchema.safeParse(code);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const cacheKey = `${MESSAGES_CACHE_PREFIX}${parsed.data}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached) as PublicLanguageMessagesResponse;
    const rows = await this.database.db
      .select({
        key: platformTranslations.key,
        value: platformTranslations.value,
      })
      .from(platformTranslations)
      .where(eq(platformTranslations.languageCode, parsed.data));
    const messages: Record<string, string> = {};
    for (const row of rows) messages[row.key] = row.value;
    const response: PublicLanguageMessagesResponse = {
      code: parsed.data,
      messages,
    };
    await this.cacheSet(cacheKey, JSON.stringify(response));
    return response;
  }

  async adminList(): Promise<AdminPlatformLanguagesResponse> {
    const [rows, counts] = await Promise.all([
      this.database.db
        .select()
        .from(languages)
        .orderBy(asc(languages.sortOrder), asc(languages.name)),
      this.database.db
        .select({
          languageCode: platformTranslations.languageCode,
          translated: sql<number>`count(*)::int`,
        })
        .from(platformTranslations)
        .groupBy(platformTranslations.languageCode),
    ]);
    const overrides = new Map(
      counts.map((row) => [row.languageCode, row.translated]),
    );
    const existing = new Set(rows.map((row) => row.code));
    return {
      languages: rows.map((row) => this.adminLanguage(row, overrides)),
      catalog: worldLanguageCodes
        .filter((code) => !existing.has(code))
        .map((code) => this.catalogEntry(code)),
    };
  }

  async create(
    session: PlatformAdminAuthSession,
    input: unknown,
  ): Promise<AdminPlatformLanguagesResponse> {
    const parsed = createAdminPlatformLanguageSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const code = parsed.data.code;
    if (!worldLanguageCodes.includes(code as never))
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const entry = this.catalogEntry(code);
    const [last] = await this.database.db
      .select({ sortOrder: languages.sortOrder })
      .from(languages)
      .orderBy(sql`${languages.sortOrder} desc`)
      .limit(1);
    await this.database.db
      .insert(languages)
      .values({
        code,
        name: entry.name,
        nativeName: entry.nativeName,
        direction: entry.direction,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      })
      .onConflictDoNothing({ target: languages.code });
    await this.audit(session, 'language.created', code);
    await this.cacheDelete(LANGUAGES_CACHE_KEY);
    return this.adminList();
  }

  async update(
    session: PlatformAdminAuthSession,
    code: string,
    input: unknown,
  ): Promise<AdminPlatformLanguagesResponse> {
    const parsed = updateAdminPlatformLanguageSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const language = await this.requireLanguage(code);
    const values = parsed.data;
    if (
      language.isDefault &&
      (values.isActive === false || values.isDefault === false)
    ) {
      throw new AppException('LANGUAGE_DEFAULT_REQUIRED', HttpStatus.CONFLICT);
    }
    await this.database.db.transaction(async (tx) => {
      if (values.isDefault === true) {
        await tx
          .update(languages)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(languages.isDefault, true));
      }
      await tx
        .update(languages)
        .set({
          ...(values.isActive === undefined
            ? {}
            : { isActive: values.isActive }),
          ...(values.isDefault === undefined
            ? {}
            : { isDefault: values.isDefault }),
          ...(values.sortOrder === undefined
            ? {}
            : { sortOrder: values.sortOrder }),
          ...(values.isDefault === true ? { isActive: true } : {}),
          updatedAt: new Date(),
        })
        .where(eq(languages.code, language.code));
    });
    await this.audit(session, 'language.updated', language.code);
    await this.cacheDelete(LANGUAGES_CACHE_KEY);
    return this.adminList();
  }

  async remove(
    session: PlatformAdminAuthSession,
    code: string,
  ): Promise<AdminPlatformLanguagesResponse> {
    const language = await this.requireLanguage(code);
    if (language.isDefault || this.isBase(language.code))
      throw new AppException('LANGUAGE_NOT_REMOVABLE', HttpStatus.CONFLICT);
    await this.database.db
      .delete(languages)
      .where(eq(languages.code, language.code));
    await this.audit(session, 'language.deleted', language.code);
    await this.cacheDelete(LANGUAGES_CACHE_KEY);
    await this.cacheDelete(`${MESSAGES_CACHE_PREFIX}${language.code}`);
    return this.adminList();
  }

  async translations(
    code: string,
    query: unknown,
  ): Promise<AdminTranslationsResponse> {
    const parsed = listAdminTranslationsQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const language = await this.requireLanguage(code);
    const values = await this.storedValues(language.code);
    const fileLayer = fileFlat[language.code];
    const rows = sourceKeys.map((key) => ({
      key,
      source: sourceFlat[key],
      value: values.get(key) ?? fileLayer?.[key] ?? null,
    }));
    const needle = parsed.data.q?.toLowerCase();
    const filtered = rows.filter((row) => {
      if (parsed.data.missing && row.value !== null) return false;
      if (!needle) return true;
      return (
        row.key.toLowerCase().includes(needle) ||
        row.source.toLowerCase().includes(needle) ||
        (row.value?.toLowerCase().includes(needle) ?? false)
      );
    });
    const page = filtered.slice(
      parsed.data.offset,
      parsed.data.offset + parsed.data.limit,
    );
    const overrides = new Map([[language.code, values.size]]);
    return {
      language: this.adminLanguage(language, overrides),
      rows: page,
      total: sourceKeys.length,
      filtered: filtered.length,
    };
  }

  async saveTranslation(
    session: PlatformAdminAuthSession,
    code: string,
    input: unknown,
  ): Promise<AdminTranslationsResponse> {
    const parsed = saveAdminTranslationSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const language = await this.requireLanguage(code);
    const source = sourceFlat[parsed.data.key];
    if (source === undefined)
      throw new AppException('TRANSLATION_KEY_UNKNOWN', HttpStatus.NOT_FOUND);
    const value = parsed.data.value.trim();
    const fileValue = fileFlat[language.code]?.[parsed.data.key];
    if (!value || value === fileValue) {
      await this.database.db
        .delete(platformTranslations)
        .where(
          and(
            eq(platformTranslations.languageCode, language.code),
            eq(platformTranslations.key, parsed.data.key),
          ),
        );
    } else {
      if (icuMismatch(source, value))
        throw new AppException(
          'TRANSLATION_ARGUMENTS_MISMATCH',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      await this.upsertTranslation(
        language.code,
        parsed.data.key,
        value,
        session.user.id,
      );
    }
    await this.audit(session, 'language.translation_saved', language.code);
    await this.cacheDelete(`${MESSAGES_CACHE_PREFIX}${language.code}`);
    return this.translations(language.code, {});
  }

  async importTranslations(
    session: PlatformAdminAuthSession,
    code: string,
    input: unknown,
  ): Promise<ImportAdminTranslationsResult> {
    const parsed = importAdminTranslationsSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const language = await this.requireLanguage(code);
    const rejected: string[] = [];
    let imported = 0;
    const fileLayer = fileFlat[language.code];
    await this.database.db.transaction(async (tx) => {
      for (const [key, raw] of Object.entries(parsed.data.messages)) {
        const source = sourceFlat[key];
        const value = raw.trim();
        if (source === undefined || !value) {
          rejected.push(key);
          continue;
        }
        if (icuMismatch(source, value)) {
          rejected.push(key);
          continue;
        }
        if (value === fileLayer?.[key]) continue;
        await tx
          .insert(platformTranslations)
          .values({
            languageCode: language.code,
            key,
            value,
            updatedByUserId: session.user.id,
          })
          .onConflictDoUpdate({
            target: [
              platformTranslations.languageCode,
              platformTranslations.key,
            ],
            set: {
              value,
              updatedByUserId: session.user.id,
              updatedAt: new Date(),
            },
          });
        imported += 1;
      }
    });
    await this.audit(session, 'language.translations_imported', language.code);
    await this.cacheDelete(`${MESSAGES_CACHE_PREFIX}${language.code}`);
    return { imported, rejected };
  }

  async exportTranslations(
    code: string,
  ): Promise<ExportAdminTranslationsResponse> {
    const language = await this.requireLanguage(code);
    const values = await this.storedValues(language.code);
    const fileLayer = fileFlat[language.code];
    const messages: Record<string, string> = {};
    for (const key of sourceKeys) {
      messages[key] = values.get(key) ?? fileLayer?.[key] ?? sourceFlat[key];
    }
    return { code: language.code, messages };
  }

  private adminLanguage(
    row: typeof languages.$inferSelect,
    overrides: Map<string, number>,
  ): AdminPlatformLanguage {
    const isBase = this.isBase(row.code);
    return {
      code: row.code,
      name: row.name,
      nativeName: row.nativeName,
      direction: row.direction,
      isDefault: row.isDefault,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      isBase,
      translated: isBase
        ? sourceKeys.length
        : Math.min(overrides.get(row.code) ?? 0, sourceKeys.length),
      total: sourceKeys.length,
    };
  }

  private isBase(code: string) {
    return baseLanguageCodes.includes(code as never);
  }

  private catalogEntry(code: string) {
    const direction: LanguageDirection = rtlLanguageCodes.includes(
      code as never,
    )
      ? 'rtl'
      : 'ltr';
    const name = this.displayName(code, 'en') ?? code;
    const nativeName = this.displayName(code, code) ?? name;
    return { code, name, nativeName, direction };
  }

  private displayName(code: string, inLocale: string): string | null {
    try {
      const value = new Intl.DisplayNames([inLocale], {
        type: 'language',
      }).of(code);
      if (!value || value === code) return null;
      return value.charAt(0).toUpperCase() + value.slice(1);
    } catch {
      return null;
    }
  }

  private async requireLanguage(code: string) {
    const parsed = localeCodeSchema.safeParse(code);
    if (!parsed.success)
      throw new AppException('LANGUAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
    const [row] = await this.database.db
      .select()
      .from(languages)
      .where(eq(languages.code, parsed.data))
      .limit(1);
    if (!row)
      throw new AppException('LANGUAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
    return row;
  }

  private async storedValues(code: string) {
    const rows = await this.database.db
      .select({
        key: platformTranslations.key,
        value: platformTranslations.value,
      })
      .from(platformTranslations)
      .where(eq(platformTranslations.languageCode, code));
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  private async upsertTranslation(
    code: string,
    key: string,
    value: string,
    userId: string,
  ) {
    await this.database.db
      .insert(platformTranslations)
      .values({ languageCode: code, key, value, updatedByUserId: userId })
      .onConflictDoUpdate({
        target: [platformTranslations.languageCode, platformTranslations.key],
        set: { value, updatedByUserId: userId, updatedAt: new Date() },
      });
  }

  private async audit(
    session: PlatformAdminAuthSession,
    event: string,
    code: string,
  ) {
    await this.database.db.insert(apiAuditLogs).values({
      actorUserId: session.user.id,
      event,
      subjectType: 'language',
      summary: code,
      metadata: { code },
    });
  }

  private redis(): Redis {
    if (!this.client) {
      this.client = new Redis({
        host: this.config.get<string>('REDIS_HOST'),
        port: Number(this.config.get<string>('REDIS_PORT') ?? 6379),
        username: this.config.get<string>('REDIS_USERNAME'),
        password: this.config.get<string>('REDIS_PASSWORD'),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      this.client.on('error', () => {});
    }
    return this.client;
  }

  private async cacheGet(key: string): Promise<string | null> {
    try {
      return await this.redis().get(key);
    } catch {
      return null;
    }
  }

  private async cacheSet(key: string, value: string) {
    try {
      await this.redis().set(key, value, 'EX', CACHE_TTL_SECONDS);
    } catch {}
  }

  private async cacheDelete(key: string) {
    try {
      await this.redis().del(key);
    } catch {}
  }
}
