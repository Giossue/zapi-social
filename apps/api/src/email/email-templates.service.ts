import { HttpStatus, Injectable } from '@nestjs/common';
import { apiAuditLogs, emailTemplates } from '@workspace/database';
import { and, eq, inArray } from '@workspace/database/query';
import {
  DEFAULT_EMAIL_TEMPLATE_LOCALE,
  emailTemplateKeySchema,
  resetAdminEmailTemplateSchema,
  updateAdminEmailTemplateSchema,
  type AdminEmailTemplate,
  type AdminEmailTemplateCopy,
  type AdminEmailTemplatesResponse,
  type EmailTemplateKey,
  type PlatformAdminAuthSession,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import {
  EMAIL_TEMPLATE_CATALOG,
  type EmailTemplateCopy,
} from './email-template-catalog';

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<AdminEmailTemplatesResponse> {
    const rows = await this.database.db.select().from(emailTemplates);
    const byKey = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = byKey.get(row.key) ?? [];
      bucket.push(row);
      byKey.set(row.key, bucket);
    }

    const templates = (
      Object.keys(EMAIL_TEMPLATE_CATALOG) as EmailTemplateKey[]
    ).map((key): AdminEmailTemplate => {
      const entry = EMAIL_TEMPLATE_CATALOG[key];
      const stored = byKey.get(key) ?? [];
      const defaultRow = stored.find(
        (row) => row.locale === DEFAULT_EMAIL_TEMPLATE_LOCALE,
      );
      const fallback = entry.copy.es;

      return {
        key,
        name: entry.name,
        description: entry.description,
        defaultCopy: {
          locale: DEFAULT_EMAIL_TEMPLATE_LOCALE,
          subject: defaultRow?.subject ?? fallback.subject,
          title: defaultRow?.title ?? fallback.title,
          body: defaultRow?.description ?? fallback.body,
          actionLabel: defaultRow?.actionLabel ?? fallback.actionLabel,
          notice: defaultRow?.notice ?? fallback.notice,
          customized: Boolean(defaultRow),
          isActive: defaultRow?.isActive ?? true,
          updatedAt: defaultRow?.updatedAt.toISOString() ?? null,
        },
        overrides: stored
          .filter((row) => row.locale !== DEFAULT_EMAIL_TEMPLATE_LOCALE)
          .sort((a, b) => a.locale.localeCompare(b.locale))
          .map((row): AdminEmailTemplateCopy => ({
            locale: row.locale,
            subject: row.subject,
            title: row.title,
            body: row.description,
            actionLabel: row.actionLabel,
            notice: row.notice,
            customized: true,
            isActive: row.isActive,
            updatedAt: row.updatedAt.toISOString(),
          })),
        variables: entry.variables,
      };
    });
    return { templates };
  }

  async update(
    session: PlatformAdminAuthSession,
    key: string,
    input: unknown,
  ): Promise<AdminEmailTemplatesResponse> {
    const templateKey = this.key(key);
    const values = this.parse(updateAdminEmailTemplateSchema.safeParse(input));
    const now = new Date();
    await this.database.db
      .insert(emailTemplates)
      .values({
        key: templateKey,
        locale: values.locale,
        subject: values.subject,
        title: values.title,
        description: values.body,
        actionLabel: values.actionLabel || null,
        notice: values.notice || null,
        isActive: values.isActive,
        updatedByUserId: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [emailTemplates.key, emailTemplates.locale],
        set: {
          subject: values.subject,
          title: values.title,
          description: values.body,
          actionLabel: values.actionLabel || null,
          notice: values.notice || null,
          isActive: values.isActive,
          updatedByUserId: session.user.id,
          updatedAt: now,
        },
      });
    await this.audit(session, templateKey, 'email_template.updated');
    return this.list();
  }

  async reset(
    session: PlatformAdminAuthSession,
    key: string,
    input: unknown,
  ): Promise<AdminEmailTemplatesResponse> {
    const templateKey = this.key(key);
    const { locale } = this.parse(
      resetAdminEmailTemplateSchema.safeParse(input),
    );
    await this.database.db
      .delete(emailTemplates)
      .where(
        and(
          eq(emailTemplates.key, templateKey),
          eq(emailTemplates.locale, locale),
        ),
      );
    await this.audit(session, templateKey, 'email_template.reset');
    return this.list();
  }

  async resolve(
    key: EmailTemplateKey,
    variables: Record<string, string> = {},
    locale = 'es',
  ): Promise<EmailTemplateCopy> {
    const entry = EMAIL_TEMPLATE_CATALOG[key];
    const rows = await this.database.db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.key, key),
          inArray(emailTemplates.locale, [
            locale,
            DEFAULT_EMAIL_TEMPLATE_LOCALE,
          ]),
        ),
      );
    const active = rows.filter((row) => row.isActive);
    const chosen =
      active.find((row) => row.locale === locale) ??
      active.find((row) => row.locale === DEFAULT_EMAIL_TEMPLATE_LOCALE);

    const bundled =
      (entry.copy as Record<string, EmailTemplateCopy | undefined>)[locale] ??
      entry.copy.es;

    const copy: EmailTemplateCopy = chosen
      ? {
          preview: bundled.preview,
          subject: chosen.subject,
          title: chosen.title,
          body: chosen.description,
          actionLabel: chosen.actionLabel,
          notice: chosen.notice,
        }
      : bundled;

    return {
      preview: this.render(copy.preview, variables),
      subject: this.render(copy.subject, variables),
      title: this.render(copy.title, variables),
      body: this.render(copy.body, variables),
      actionLabel: copy.actionLabel
        ? this.render(copy.actionLabel, variables)
        : null,
      notice: copy.notice ? this.render(copy.notice, variables) : null,
    };
  }

  private render(value: string, variables: Record<string, string>) {
    return value.replace(/\{\{(\w+)\}\}/g, (match, token: string) =>
      token in variables ? variables[token] : match,
    );
  }

  private key(value: string): EmailTemplateKey {
    const parsed = emailTemplateKeySchema.safeParse(value);
    if (!parsed.success)
      throw new AppException('EMAIL_TEMPLATE_NOT_FOUND', HttpStatus.NOT_FOUND);
    return parsed.data;
  }

  private async audit(
    session: PlatformAdminAuthSession,
    key: EmailTemplateKey,
    event: string,
  ) {
    await this.database.db.insert(apiAuditLogs).values({
      actorUserId: session.user.id,
      event,
      subjectType: 'email_template',
      summary: key,
      metadata: { key },
    });
  }

  private parse<T>(result: { success: true; data: T } | { success: false }) {
    if (!result.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return result.data;
  }
}
