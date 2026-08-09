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
) {
  return zapiEmailTemplate({
    preview: `${input.memberName} aceptó tu invitación a ${input.workspaceName}.`,
    title: 'Invitación aceptada',
    description: `${input.memberName} ya forma parte de ${input.workspaceName}.`,
    details: [
      { label: 'Correo', value: input.memberEmail },
      { label: 'Rol', value: teamRoleLabel(input.role) },
    ],
    action: { label: 'Administrar equipo', url: input.teamsUrl },
  });
}
