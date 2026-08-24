import { render } from '@react-email/render';
import type { SupportedLocale } from '@workspace/contracts';
import {
  EMAIL_TEMPLATE_CATALOG,
  type EmailTemplateCopy,
} from './email-template-catalog';
import {
  passwordResetEmail,
  teamAccessUpdatedEmail,
  teamInvitationAcceptedEmail,
  teamInvitationEmail,
  teamMemberRemovedEmail,
  teamOwnershipTransferredEmail,
} from './templates';

function copyOf(
  key: keyof typeof EMAIL_TEMPLATE_CATALOG,
  locale: SupportedLocale,
  variables: Record<string, string> = {},
): EmailTemplateCopy {
  const render = (value: string) =>
    value.replace(/\{\{(\w+)\}\}/g, (match, token: string) =>
      token in variables ? variables[token] : match,
    );
  const copy = EMAIL_TEMPLATE_CATALOG[key].copy[locale];
  return {
    preview: render(copy.preview),
    subject: render(copy.subject),
    title: render(copy.title),
    body: render(copy.body),
    actionLabel: copy.actionLabel ? render(copy.actionLabel) : null,
    notice: copy.notice ? render(copy.notice) : null,
  };
}

const workspaceName = 'Equipo Naranja';
const variables = {
  workspaceName,
  inviterName: 'Ana Morales',
  memberName: 'Luis García',
  memberEmail: 'luis@example.test',
  recipientName: 'Luis García',
  actorName: 'Ana Morales',
  counterpartName: 'Ana Morales',
  role: 'member',
  expiresLabel: '16 de agosto de 2026',
};

function templatesFor(locale: SupportedLocale) {
  return [
    {
      name: 'password reset',
      key: 'password_reset' as const,
      element: passwordResetEmail(
        'https://zapi.example/reset-password?token=synthetic',
        copyOf('password_reset', locale, variables),
        locale,
      ),
    },
    {
      name: 'team invitation',
      key: 'team_invitation' as const,
      element: teamInvitationEmail(
        {
          invitationUrl: 'https://zapi.example/invite#token=synthetic',
          workspaceName,
          inviterName: 'Ana Morales',
          role: 'member',
          expiresLabel: '16 de agosto de 2026',
        },
        copyOf('team_invitation', locale, variables),
        locale,
      ),
    },
    {
      name: 'invitation accepted',
      key: 'team_invitation_accepted' as const,
      element: teamInvitationAcceptedEmail(
        {
          workspaceName,
          memberName: 'Luis García',
          memberEmail: 'luis@example.test',
          role: 'member',
          teamsUrl: 'https://zapi.example/portal/teams',
        },
        copyOf('team_invitation_accepted', locale, variables),
        locale,
      ),
    },
    {
      name: 'access updated',
      key: 'team_access_updated' as const,
      element: teamAccessUpdatedEmail(
        {
          workspaceName,
          recipientName: 'Luis García',
          actorName: 'Ana Morales',
          role: 'member',
          accountCount: 2,
          teamsUrl: 'https://zapi.example/portal/teams',
        },
        copyOf('team_access_updated', locale, variables),
        locale,
      ),
    },
    {
      name: 'member removed',
      key: 'team_member_removed' as const,
      element: teamMemberRemovedEmail(
        {
          workspaceName,
          recipientName: 'Luis García',
          actorName: 'Ana Morales',
          portalUrl: 'https://zapi.example/portal/dashboard',
        },
        copyOf('team_member_removed', locale, variables),
        locale,
      ),
    },
    {
      name: 'ownership transferred',
      key: 'team_ownership_new_owner' as const,
      element: teamOwnershipTransferredEmail(
        {
          workspaceName,
          recipientName: 'Luis García',
          counterpartName: 'Ana Morales',
          perspective: 'new-owner',
          teamsUrl: 'https://zapi.example/portal/teams',
        },
        copyOf('team_ownership_new_owner', locale, variables),
        locale,
      ),
    },
  ];
}

describe('Email templates', () => {
  for (const locale of ['es', 'en'] as const) {
    for (const template of templatesFor(locale)) {
      it(`renders ${template.name} in ${locale}`, async () => {
        const [html, text] = await Promise.all([
          render(template.element),
          render(template.element, { plainText: true }),
        ]);
        const marker = copyOf(template.key, locale, variables).title;

        expect(html).toContain(`lang="${locale}"`);
        expect(text.toLocaleLowerCase(locale)).toContain(
          marker.toLocaleLowerCase(locale),
        );
        expect(html).not.toContain('undefined');
        expect(text).not.toContain('undefined');
      });
    }
  }

  it('renders the workspace label in the recipient language', async () => {
    const [spanish, english] = await Promise.all([
      render(
        teamMemberRemovedEmail(
          {
            workspaceName,
            recipientName: 'Luis García',
            actorName: 'Ana Morales',
            portalUrl: 'https://zapi.example/portal/dashboard',
          },
          copyOf('team_member_removed', 'es', variables),
          'es',
        ),
      ),
      render(
        teamMemberRemovedEmail(
          {
            workspaceName,
            recipientName: 'Luis García',
            actorName: 'Ana Morales',
            portalUrl: 'https://zapi.example/portal/dashboard',
          },
          copyOf('team_member_removed', 'en', variables),
          'en',
        ),
      ),
    ]);

    expect(spanish).toContain('Espacio');
    expect(english).toContain('Workspace');
    expect(english).not.toContain('Espacio');
  });

  it('escapes workspace content supplied by users', async () => {
    const html = await render(
      teamInvitationEmail(
        {
          invitationUrl: 'https://zapi.example/invite#token=synthetic',
          workspaceName: '<script>alert(1)</script>',
          inviterName: 'Ana Morales',
          role: 'admin',
          expiresLabel: '16 de agosto de 2026',
        },
        copyOf('team_invitation', 'es', variables),
        'es',
      ),
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
