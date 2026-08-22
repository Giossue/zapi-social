import { HttpStatus, Injectable } from '@nestjs/common';
import { apiAuditLogs, emailTemplates } from '@workspace/database';
import { eq } from '@workspace/database/query';
import {
  emailTemplateKeySchema,
  updateAdminEmailTemplateSchema,
  type AdminEmailTemplate,
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
    const overrides = new Map(rows.map((row) => [row.key, row]));
    const templates = (
      Object.keys(EMAIL_TEMPLATE_CATALOG) as EmailTemplateKey[]
    ).map((key): AdminEmailTemplate => {
      const entry = EMAIL_TEMPLATE_CATALOG[key];
      const override = overrides.get(key);
      return {
        key,
        name: entry.name,
        description: entry.description,
        subject: override?.subject ?? entry.copy.subject,
        title: override?.title ?? entry.copy.title,
        body: override?.description ?? entry.copy.body,
        actionLabel: override?.actionLabel ?? entry.copy.actionLabel,
        notice: override?.notice ?? entry.copy.notice,
        customized: Boolean(override),
        variables: entry.variables,
        updatedAt: override?.updatedAt.toISOString() ?? null,
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
    const values = this.parse(
      updateAdminEmailTemplateSchema.safeParse(input),
    );
    const now = new Date();
    await this.database.db
      .insert(emailTemplates)
      .values({
        key: templateKey,
        subject: values.subject,
        title: values.title,
        description: values.body,
        actionLabel: values.actionLabel || null,
        notice: values.notice || null,
        updatedByUserId: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: emailTemplates.key,
        set: {
          subject: values.subject,
          title: values.title,
          description: values.body,
          actionLabel: values.actionLabel || null,
          notice: values.notice || null,
          updatedByUserId: session.user.id,
          updatedAt: now,
        },
      });
    await this.audit(session, templateKey, 'email_template.updated');
    return this.list();
  }

  /** Restablecer borra la personalización: el correo vuelve al texto del código. */
  async reset(
    session: PlatformAdminAuthSession,
    key: string,
  ): Promise<AdminEmailTemplatesResponse> {
    const templateKey = this.key(key);
    await this.database.db
      .delete(emailTemplates)
      .where(eq(emailTemplates.key, templateKey));
    await this.audit(session, templateKey, 'email_template.reset');
    return this.list();
  }

  /**
   * Resuelve los textos de un correo aplicando la personalización guardada y
   * sustituyendo las variables declaradas en el catálogo.
   */
  async resolve(
    key: EmailTemplateKey,
    variables: Record<string, string> = {},
  ): Promise<EmailTemplateCopy> {
    const entry = EMAIL_TEMPLATE_CATALOG[key];
    const [override] = await this.database.db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, key))
      .limit(1);
    const copy: EmailTemplateCopy = override
      ? {
          subject: override.subject,
          title: override.title,
          body: override.description,
          actionLabel: override.actionLabel,
          notice: override.notice,
        }
      : entry.copy;
    return {
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
      token in variables ? variables[token]! : match,
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
