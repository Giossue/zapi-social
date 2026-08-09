import { zapiEmailTemplate } from './email-template';

export type TeamMemberRemovedEmailInput = {
  workspaceName: string;
  recipientName: string;
  actorName: string;
  portalUrl: string;
};

export function teamMemberRemovedEmail(input: TeamMemberRemovedEmailInput) {
  return zapiEmailTemplate({
    preview: `Tu acceso a ${input.workspaceName} fue retirado.`,
    title: 'Ya no formas parte del espacio',
    description: `${input.actorName} retiró el acceso de ${input.recipientName} a ${input.workspaceName}.`,
    details: [{ label: 'Espacio', value: input.workspaceName }],
    action: { label: 'Abrir Zapi', url: input.portalUrl },
    notice:
      'Tus otros espacios de trabajo y tu cuenta personal no fueron modificados.',
  });
}
