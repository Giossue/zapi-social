import type { EmailCopyOverride } from './email-copy';
import { teamRoleLabel, zapiEmailTemplate } from './email-template';

export type TeamAccessUpdatedEmailInput = {
  workspaceName: string;
  recipientName: string;
  actorName: string;
  role: 'admin' | 'member';
  accountCount: number | null;
  teamsUrl: string;
};

export function teamAccessUpdatedEmail(
  input: TeamAccessUpdatedEmailInput,
  copy?: EmailCopyOverride,
) {
  const details = [
    { label: 'Espacio', value: input.workspaceName },
    { label: 'Rol', value: teamRoleLabel(input.role) },
  ];
  if (input.accountCount !== null) {
    details.push({
      label: 'Cuentas disponibles',
      value: String(input.accountCount),
    });
  }

  return zapiEmailTemplate({
    preview: `Tu acceso a ${input.workspaceName} fue actualizado.`,
    title: copy?.title ?? 'Tu acceso al equipo cambió',
    description:
      copy?.body ??
      `${input.actorName} actualizó el acceso de ${input.recipientName} en Zapi.`,
    details,
    action: {
      label: copy?.actionLabel ?? 'Ver mi acceso',
      url: input.teamsUrl,
    },
    notice:
      copy?.notice ??
      'Si no reconoces este cambio, contacta al propietario del espacio de trabajo.',
  });
}
