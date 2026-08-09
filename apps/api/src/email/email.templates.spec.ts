import { render } from '@react-email/render';
import {
  passwordResetEmail,
  teamAccessUpdatedEmail,
  teamInvitationAcceptedEmail,
  teamInvitationEmail,
  teamMemberRemovedEmail,
  teamOwnershipTransferredEmail,
} from './templates';

const templates = [
  {
    name: 'password reset',
    marker: 'Restablece tu contraseña',
    element: passwordResetEmail(
      'https://zapi.example/reset-password?token=synthetic',
    ),
  },
  {
    name: 'team invitation',
    marker: 'Te invitaron a un espacio de trabajo',
    element: teamInvitationEmail({
      invitationUrl: 'https://zapi.example/invite#token=synthetic',
      workspaceName: 'Equipo Naranja',
      inviterName: 'Ana Morales',
      role: 'member',
      expiresLabel: '16 de agosto de 2026',
    }),
  },
  {
    name: 'invitation accepted',
    marker: 'Invitación aceptada',
    element: teamInvitationAcceptedEmail({
      workspaceName: 'Equipo Naranja',
      memberName: 'Luis García',
      memberEmail: 'luis@example.test',
      role: 'member',
      teamsUrl: 'https://zapi.example/portal/teams',
    }),
  },
  {
    name: 'access updated',
    marker: 'Tu acceso al equipo cambió',
    element: teamAccessUpdatedEmail({
      workspaceName: 'Equipo Naranja',
      recipientName: 'Luis García',
      actorName: 'Ana Morales',
      role: 'member',
      accountCount: 2,
      teamsUrl: 'https://zapi.example/portal/teams',
    }),
  },
  {
    name: 'member removed',
    marker: 'Ya no formas parte del espacio',
    element: teamMemberRemovedEmail({
      workspaceName: 'Equipo Naranja',
      recipientName: 'Luis García',
      actorName: 'Ana Morales',
      portalUrl: 'https://zapi.example/portal/dashboard',
    }),
  },
  {
    name: 'ownership transferred',
    marker: 'Ahora eres propietario del espacio',
    element: teamOwnershipTransferredEmail({
      workspaceName: 'Equipo Naranja',
      recipientName: 'Luis García',
      counterpartName: 'Ana Morales',
      perspective: 'new-owner',
      teamsUrl: 'https://zapi.example/portal/teams',
    }),
  },
] as const;

describe('Email templates', () => {
  for (const template of templates) {
    it(`renders ${template.name} as HTML and plain text`, async () => {
      const [html, text] = await Promise.all([
        render(template.element),
        render(template.element, { plainText: true }),
      ]);

      expect(html).toContain(template.marker);
      expect(text.toLocaleLowerCase('es')).toContain(
        template.marker.toLocaleLowerCase('es'),
      );
      expect(html).not.toContain('undefined');
      expect(text).not.toContain('undefined');
    });
  }

  it('escapes workspace content supplied by users', async () => {
    const html = await render(
      teamInvitationEmail({
        invitationUrl: 'https://zapi.example/invite#token=synthetic',
        workspaceName: '<script>alert(1)</script>',
        inviterName: 'Ana Morales',
        role: 'admin',
        expiresLabel: '16 de agosto de 2026',
      }),
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
