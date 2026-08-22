import type { EmailCopyOverride } from './email-copy';
import { teamRoleLabel, zapiEmailTemplate } from './email-template';

export type TeamInvitationAcceptedEmailInput = {
  workspaceName: string;
  memberName: string;
  memberEmail: string;
  role: 'admin' | 'member';
  teamsUrl: string;
};

export function teamInvitationAcceptedEmail(
  input: TeamInvitationAcceptedEmailInput,
  copy?: EmailCopyOverride,
) {
  return zapiEmailTemplate({
    preview: `${input.memberName} aceptó tu invitación a ${input.workspaceName}.`,
    title: copy?.title ?? 'Invitación aceptada',
    description:
      copy?.body ??
      `${input.memberName} ya forma parte de ${input.workspaceName}.`,
    details: [
      { label: 'Correo', value: input.memberEmail },
      { label: 'Rol', value: teamRoleLabel(input.role) },
    ],
    action: {
      label: copy?.actionLabel ?? 'Administrar equipo',
      url: input.teamsUrl,
    },
    notice: copy?.notice ?? undefined,
  });
}
