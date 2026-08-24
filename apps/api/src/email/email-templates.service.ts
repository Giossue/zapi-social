import { HttpStatus, Injectable } from '@nestjs/common';
import { apiAuditLogs, emailTemplates } from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import {
  emailTemplateKeySchema,
  resetAdminEmailTemplateSchema,
  supportedLocaleSchema,
  updateAdminEmailTemplateSchema,
  type AdminEmailTemplate,
  type AdminEmailTemplateCopy,
  type AdminEmailTemplatesResponse,
  type EmailTemplateKey,
  type PlatformAdminAuthSession,
  type SupportedLocale,
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
    const overrides = new Map(
      rows.map((row) => [`${row.key}:${row.locale}`, row]),
    );
    const templates = (
      Object.keys(EMAIL_TEMPLATE_CATALOG) as EmailTemplateKey[]
    ).map((key): AdminEmailTemplate => {
      const entry = EMAIL_TEMPLATE_CATALOG[key];
      return {
        key,
        name: entry.name,
        description: entry.description,
        copies: supportedLocaleSchema.options.map(
          (locale): AdminEmailTemplateCopy => {
            const override = overrides.get(`${key}:${locale}`);
            const fallback = entry.copy[locale];
            return {
              locale,
              subject: override?.subject ?? fallback.subject,
              title: override?.title ?? fallback.title,
              body: override?.description ?? fallback.body,
              actionLabel: override?.actionLabel ?? fallback.actionLabel,
              notice: override?.notice ?? fallback.notice,
              customized: Boolean(override),
              isActive: override?.isActive ?? true,
              updatedAt: override?.updatedAt.toISOString() ?? null,
            };
          },
        ),
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
    locale: SupportedLocale = 'es',
  ): Promise<EmailTemplateCopy> {
    const entry = EMAIL_TEMPLATE_CATALOG[key];
    const [override] = await this.database.db
      .select()
      .from(emailTemplates)
      .where(
        and(eq(emailTemplates.key, key), eq(emailTemplates.locale, locale)),
      )
      .limit(1);
    const active = override?.isActive ? override : undefined;
    const copy: EmailTemplateCopy = active
      ? {
          preview: entry.copy[locale].preview,
          subject: active.subject,
          title: active.title,
          body: active.description,
          actionLabel: active.actionLabel,
          notice: active.notice,
        }
      : entry.copy[locale];
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
