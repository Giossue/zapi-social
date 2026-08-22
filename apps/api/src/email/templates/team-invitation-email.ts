import type { EmailCopyOverride } from './email-copy';
import { teamRoleLabel, zapiEmailTemplate } from './email-template';

export type TeamInvitationEmailInput = {
  invitationUrl: string;
  workspaceName: string;
  inviterName: string;
  role: 'admin' | 'member';
  expiresLabel: string;
};

export function teamInvitationEmail(
  input: TeamInvitationEmailInput,
  copy?: EmailCopyOverride,
) {
  return zapiEmailTemplate({
    preview: `${input.inviterName} te invitó a ${input.workspaceName}.`,
    title: copy?.title ?? 'Te invitaron a un espacio de trabajo',
    description:
      copy?.body ??
      `${input.inviterName} quiere que formes parte de ${input.workspaceName} en Zapi.`,
    details: [
      { label: 'Espacio', value: input.workspaceName },
      { label: 'Rol', value: teamRoleLabel(input.role) },
      { label: 'Disponible hasta', value: input.expiresLabel },
    ],
    action: {
      label: copy?.actionLabel ?? 'Revisar invitación',
      url: input.invitationUrl,
    },
    notice:
      copy?.notice ??
      'El enlace es privado, está vinculado a este correo y solo puede utilizarse una vez.',
  });
}
