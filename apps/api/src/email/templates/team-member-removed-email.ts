import type { EmailCopyOverride } from './email-copy';
import { zapiEmailTemplate } from './email-template';

export type TeamMemberRemovedEmailInput = {
  workspaceName: string;
  recipientName: string;
  actorName: string;
  portalUrl: string;
};

export function teamMemberRemovedEmail(
  input: TeamMemberRemovedEmailInput,
  copy?: EmailCopyOverride,
) {
  return zapiEmailTemplate({
    preview: `Tu acceso a ${input.workspaceName} fue retirado.`,
    title: copy?.title ?? 'Ya no formas parte del espacio',
    description:
      copy?.body ??
      `${input.actorName} retiró el acceso de ${input.recipientName} a ${input.workspaceName}.`,
    details: [{ label: 'Espacio', value: input.workspaceName }],
    action: {
      label: copy?.actionLabel ?? 'Abrir Zapi',
      url: input.portalUrl,
    },
    notice:
      copy?.notice ??
      'Tus otros espacios de trabajo y tu cuenta personal no fueron modificados.',
  });
}
