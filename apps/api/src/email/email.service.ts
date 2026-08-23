import {
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  emailSmtpIntegrationConfigurationSchema,
  emailSmtpIntegrationProviderKey,
  supportedLocaleSchema,
  testEmailSmtpIntegrationSchema,
  updateEmailSmtpIntegrationSchema,
  type AuthSession,
  type EmailSmtpIntegration,
  type EmailSmtpIntegrationConfiguration,
  type SupportedLocale,
  type TestEmailSmtpIntegrationResponse,
} from '@workspace/contracts';
import { providerIntegrations, users } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { render } from '@react-email/render';
import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { ReactElement } from 'react';
import { DatabaseService } from '../database/database.service';
import { EmailTemplatesService } from './email-templates.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AppException } from '../platform/errors/app-exception';
import {
  boardTaskEmail,
  passwordResetEmail,
  teamAccessUpdatedEmail,
  teamInvitationAcceptedEmail,
  teamInvitationEmail,
  teamMemberRemovedEmail,
  teamOwnershipTransferredEmail,
} from './templates';

const emailSmtpCapabilities = ['transactional_email'];

type EmailSmtpRow = Pick<
  typeof providerIntegrations.$inferSelect,
  | 'enabled'
  | 'readiness'
  | 'configurationCiphertext'
  | 'testedConfigFingerprint'
  | 'lastTestedAt'
>;

@Injectable()
export class EmailService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly templates: EmailTemplatesService,
  ) {}

  async getSmtpIntegration(): Promise<EmailSmtpIntegration> {
    return this.toIntegration(await this.row());
  }

  async testSmtpIntegration(
    input: unknown,
    session: AuthSession,
  ): Promise<TestEmailSmtpIntegrationResponse> {
    const parsed = testEmailSmtpIntegrationSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const row = await this.row();
    const configuration = this.resolveDraftConfiguration(
      parsed.data.configuration,
      row,
    );
    await this.verifyConfiguration(configuration);

    const testedAt = new Date();
    const fingerprint = this.configurationFingerprint(configuration);
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: emailSmtpIntegrationProviderKey,
        enabled: row?.enabled ?? false,
        readiness: this.readiness(
          row?.enabled ?? false,
          Boolean(row?.configurationCiphertext),
          false,
        ),
        capabilities: emailSmtpCapabilities,
        configurationCiphertext: row?.configurationCiphertext ?? null,
        testedConfigFingerprint: fingerprint,
        lastTestedAt: testedAt,
        lastTestedByPlatformAdminId: session.user.id,
        updatedByUserId: row ? undefined : session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          testedConfigFingerprint: fingerprint,
          lastTestedAt: testedAt,
          lastTestedByPlatformAdminId: session.user.id,
          updatedAt: testedAt,
        },
      });

    return { testedAt: testedAt.toISOString() };
  }

  async saveSmtpIntegration(
    input: unknown,
    session: AuthSession,
  ): Promise<EmailSmtpIntegration> {
    const parsed = updateEmailSmtpIntegrationSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const row = await this.row();
    const configuration = parsed.data.configuration
      ? this.resolveDraftConfiguration(parsed.data.configuration, row)
      : this.decryptConfiguration(row?.configurationCiphertext);
    const fingerprint = configuration
      ? this.configurationFingerprint(configuration)
      : null;
    const tested = Boolean(
      fingerprint && row?.testedConfigFingerprint === fingerprint,
    );
    if (parsed.data.enabled && !tested) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const configurationCiphertext = configuration
      ? this.encryption().encrypt(
          JSON.stringify(configuration),
          emailSmtpIntegrationProviderKey,
        )
      : (row?.configurationCiphertext ?? null);
    const readiness = this.readiness(
      parsed.data.enabled,
      Boolean(configuration),
      tested,
    );

    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: emailSmtpIntegrationProviderKey,
        enabled: parsed.data.enabled,
        readiness,
        capabilities: emailSmtpCapabilities,
        configurationCiphertext,
        readinessIssues: this.readinessIssues(
          parsed.data.enabled,
          Boolean(configuration),
          tested,
        ),
        testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
        lastTestedAt: row?.lastTestedAt ?? null,
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          enabled: parsed.data.enabled,
          readiness,
          capabilities: emailSmtpCapabilities,
          configurationCiphertext,
          readinessIssues: this.readinessIssues(
            parsed.data.enabled,
            Boolean(configuration),
            tested,
          ),
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        },
      });

    return this.toIntegration({
      enabled: parsed.data.enabled,
      readiness,
      configurationCiphertext,
      testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
      lastTestedAt: row?.lastTestedAt ?? null,
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const resetUrl = new URL(
      '/reset-password',
      this.config.getOrThrow<string>('WEB_ORIGIN'),
    );
    resetUrl.searchParams.set('token', token);
    const locale = await this.localeFor(email);
    const copy = await this.templates.resolve('password_reset', {}, locale);
    await this.sendEmail(
      email,
      copy.subject,
      passwordResetEmail(resetUrl.toString(), copy, locale),
    );
  }

  async sendTeamInvitation(input: {
    email: string;
    token: string;
    workspaceName: string;
    inviterName: string;
    role: 'admin' | 'member';
    expiresAt: Date;
  }): Promise<void> {
    const locale = await this.localeFor(input.email);
    const invitationUrl = new URL(
      '/invite',
      this.config.getOrThrow<string>('WEB_ORIGIN'),
    );
    invitationUrl.hash = new URLSearchParams({ token: input.token }).toString();
    const expiresLabel = this.dateLabel(input.expiresAt, locale);
    const copy = await this.templates.resolve(
      'team_invitation',
      {
        workspaceName: input.workspaceName,
        inviterName: input.inviterName,
        role: input.role,
        expiresLabel,
      },
      locale,
    );
    await this.sendEmail(
      input.email,
      copy.subject,
      teamInvitationEmail(
        {
          invitationUrl: invitationUrl.toString(),
          workspaceName: input.workspaceName,
          inviterName: input.inviterName,
          role: input.role,
          expiresLabel,
        },
        copy,
        locale,
      ),
    );
  }

  async sendTeamInvitationAccepted(input: {
    email: string;
    workspaceName: string;
    memberName: string;
    memberEmail: string;
    role: 'admin' | 'member';
  }): Promise<void> {
    const locale = await this.localeFor(input.email);
    const copy = await this.templates.resolve(
      'team_invitation_accepted',
      {
        workspaceName: input.workspaceName,
        memberName: input.memberName,
        memberEmail: input.memberEmail,
        role: input.role,
      },
      locale,
    );
    await this.sendEmail(
      input.email,
      copy.subject,
      teamInvitationAcceptedEmail(
        { ...input, teamsUrl: this.webUrl('/portal/teams') },
        copy,
        locale,
      ),
    );
  }

  async sendTeamAccessUpdated(input: {
    email: string;
    workspaceName: string;
    recipientName: string;
    actorName: string;
    role: 'admin' | 'member';
    accountCount: number | null;
  }): Promise<void> {
    const locale = await this.localeFor(input.email);
    const copy = await this.templates.resolve(
      'team_access_updated',
      {
        workspaceName: input.workspaceName,
        recipientName: input.recipientName,
        actorName: input.actorName,
        role: input.role,
      },
      locale,
    );
    await this.sendEmail(
      input.email,
      copy.subject,
      teamAccessUpdatedEmail(
        { ...input, teamsUrl: this.webUrl('/portal/teams') },
        copy,
        locale,
      ),
    );
  }

  async sendTeamMemberRemoved(input: {
    email: string;
    workspaceName: string;
    recipientName: string;
    actorName: string;
  }): Promise<void> {
    const locale = await this.localeFor(input.email);
    const copy = await this.templates.resolve(
      'team_member_removed',
      {
        workspaceName: input.workspaceName,
        recipientName: input.recipientName,
        actorName: input.actorName,
      },
      locale,
    );
    await this.sendEmail(
      input.email,
      copy.subject,
      teamMemberRemovedEmail(
        { ...input, portalUrl: this.webUrl('/portal/dashboard') },
        copy,
        locale,
      ),
    );
  }

  async sendBoardTaskAssigned(input: {
    email: string;
    memberName: string;
    actorName: string;
    taskTitle: string;
    workspaceName: string;
    taskUrl: string;
  }): Promise<void> {
    const locale = await this.localeFor(input.email);
    const copy = await this.templates.resolve(
      'board_task_assigned',
      {
        workspaceName: input.workspaceName,
        recipientName: input.memberName,
        actorName: input.actorName,
        taskTitle: input.taskTitle,
      },
      locale,
    );
    await this.sendEmail(
      input.email,
      copy.subject,
      boardTaskEmail(
        {
          workspaceName: input.workspaceName,
          taskTitle: input.taskTitle,
          taskUrl: this.webUrl(input.taskUrl),
        },
        copy,
        locale,
      ),
    );
  }

  async sendBoardTaskDueSoon(input: {
    email: string;
    memberName: string;
    taskTitle: string;
    workspaceName: string;
    taskUrl: string;
    dueDate: Date;
  }): Promise<void> {
    const locale = await this.localeFor(input.email);
    const dueLabel = this.dateLabel(input.dueDate, locale);
    const copy = await this.templates.resolve(
      'board_task_due_soon',
      {
        workspaceName: input.workspaceName,
        recipientName: input.memberName,
        taskTitle: input.taskTitle,
        dueLabel,
      },
      locale,
    );
    await this.sendEmail(
      input.email,
      copy.subject,
      boardTaskEmail(
        {
          workspaceName: input.workspaceName,
          taskTitle: input.taskTitle,
          taskUrl: this.webUrl(input.taskUrl),
          dueLabel,
        },
        copy,
        locale,
      ),
    );
  }

  async sendTeamOwnershipTransferred(input: {
    email: string;
    workspaceName: string;
    recipientName: string;
    counterpartName: string;
    perspective: 'new-owner' | 'previous-owner';
  }): Promise<void> {
    const locale = await this.localeFor(input.email);
    const copy = await this.templates.resolve(
      input.perspective === 'new-owner'
        ? 'team_ownership_new_owner'
        : 'team_ownership_previous_owner',
      {
        workspaceName: input.workspaceName,
        recipientName: input.recipientName,
        counterpartName: input.counterpartName,
      },
      locale,
    );
    await this.sendEmail(
      input.email,
      copy.subject,
      teamOwnershipTransferredEmail(
        { ...input, teamsUrl: this.webUrl('/portal/teams') },
        copy,
        locale,
      ),
    );
  }

  private async sendEmail(
    email: string,
    subject: string,
    template: ReactElement,
  ): Promise<void> {
    const configuration = await this.readReadyConfiguration();
    const [html, text] = await Promise.all([
      render(template),
      render(template, { plainText: true }),
    ]);
    const transporter = this.transporter(configuration);
    try {
      await transporter.sendMail({
        from: {
          name: configuration.fromName,
          address: configuration.fromEmail,
        },
        to: email,
        subject,
        html,
        text,
      });
    } finally {
      transporter.close();
    }
  }

  private webUrl(path: string) {
    return new URL(
      path,
      this.config.getOrThrow<string>('WEB_ORIGIN'),
    ).toString();
  }

  /**
   * Idioma del destinatario. Una invitación puede ir a un correo sin cuenta
   * todavía: en ese caso, y ante un valor desconocido, se usa español.
   */
  private async localeFor(email: string): Promise<SupportedLocale> {
    const [row] = await this.database.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const parsed = supportedLocaleSchema.safeParse(row?.locale);
    return parsed.success ? parsed.data : 'es';
  }

  private dateLabel(date: Date, locale: SupportedLocale) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(date);
  }

  private async readReadyConfiguration(): Promise<EmailSmtpIntegrationConfiguration> {
    const row = await this.row();
    const configuration = this.decryptConfiguration(
      row?.configurationCiphertext,
    );
    const fingerprint = configuration
      ? this.configurationFingerprint(configuration)
      : null;
    if (
      !configuration ||
      !row ||
      !row.enabled ||
      row.readiness !== 'ready' ||
      !fingerprint ||
      row.testedConfigFingerprint !== fingerprint
    ) {
      throw new AppException(
        'EMAIL_SMTP_NOT_READY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return configuration;
  }

  private async row(): Promise<EmailSmtpRow | undefined> {
    const [row] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        readiness: providerIntegrations.readiness,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
        testedConfigFingerprint: providerIntegrations.testedConfigFingerprint,
        lastTestedAt: providerIntegrations.lastTestedAt,
      })
      .from(providerIntegrations)
      .where(
        eq(providerIntegrations.providerKey, emailSmtpIntegrationProviderKey),
      )
      .limit(1);
    return row;
  }

  private toIntegration(row: EmailSmtpRow | undefined): EmailSmtpIntegration {
    const configuration = this.decryptConfiguration(
      row?.configurationCiphertext,
    );
    const fingerprint = configuration
      ? this.configurationFingerprint(configuration)
      : null;
    const tested = Boolean(
      fingerprint && row?.testedConfigFingerprint === fingerprint,
    );
    const enabled = row?.enabled ?? false;
    return {
      providerKey: emailSmtpIntegrationProviderKey,
      label: 'SMTP',
      description:
        'Entrega de correo transaccional para autenticación y espacios de trabajo.',
      enabled,
      readiness: this.readiness(enabled, Boolean(configuration), tested),
      host: configuration?.host ?? null,
      port: configuration?.port ?? null,
      secure: configuration?.secure ?? null,
      username: configuration?.username ?? null,
      passwordConfigured: Boolean(configuration),
      fromEmail: configuration?.fromEmail ?? null,
      fromName: configuration?.fromName ?? null,
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    };
  }

  private resolveDraftConfiguration(
    draft: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password?: string;
      fromEmail: string;
      fromName: string;
    },
    row: EmailSmtpRow | undefined,
  ): EmailSmtpIntegrationConfiguration {
    const stored = this.decryptConfiguration(row?.configurationCiphertext);
    const parsed = emailSmtpIntegrationConfigurationSchema.safeParse({
      ...draft,
      password: draft.password ?? stored?.password,
    });
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return parsed.data;
  }

  private decryptConfiguration(
    ciphertext: string | null | undefined,
  ): EmailSmtpIntegrationConfiguration | null {
    if (!ciphertext) return null;
    try {
      const parsed = emailSmtpIntegrationConfigurationSchema.safeParse(
        JSON.parse(
          this.encryption().decrypt(
            ciphertext,
            emailSmtpIntegrationProviderKey,
          ),
        ),
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async verifyConfiguration(
    configuration: EmailSmtpIntegrationConfiguration,
  ): Promise<void> {
    const transporter = this.transporter(configuration);
    try {
      await transporter.verify();
    } catch {
      throw new ServiceUnavailableException();
    } finally {
      transporter.close();
    }
  }

  private transporter(configuration: EmailSmtpIntegrationConfiguration) {
    return nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      auth: { user: configuration.username, pass: configuration.password },
    });
  }

  private configurationFingerprint(
    configuration: EmailSmtpIntegrationConfiguration,
  ): string {
    return createHash('sha256')
      .update(JSON.stringify(configuration))
      .digest('hex');
  }

  private readiness(enabled: boolean, configured: boolean, tested: boolean) {
    if (!enabled) return 'disabled' as const;
    if (!configured) return 'incomplete' as const;
    return tested ? ('ready' as const) : ('untested' as const);
  }

  private readinessIssues(
    enabled: boolean,
    configured: boolean,
    tested: boolean,
  ): string[] {
    if (!enabled) return [];
    if (!configured) return ['configuration_required'];
    return tested ? [] : ['configuration_requires_test'];
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
  }
}
