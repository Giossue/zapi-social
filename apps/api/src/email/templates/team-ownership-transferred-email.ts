import type { EmailCopyOverride } from './email-copy';
import { zapiEmailTemplate } from './email-template';

export type TeamOwnershipTransferredEmailInput = {
  workspaceName: string;
  recipientName: string;
  counterpartName: string;
  perspective: 'new-owner' | 'previous-owner';
  teamsUrl: string;
};

export function teamOwnershipTransferredEmail(
  input: TeamOwnershipTransferredEmailInput,
  copy?: EmailCopyOverride,
) {
  const isNewOwner = input.perspective === 'new-owner';
  return zapiEmailTemplate({
    preview: isNewOwner
      ? `Ahora eres propietario de ${input.workspaceName}.`
      : `La propiedad de ${input.workspaceName} fue transferida.`,
    title:
      copy?.title ??
      (isNewOwner
        ? 'Ahora eres propietario del espacio'
        : 'Propiedad transferida correctamente'),
    description:
      copy?.body ??
      (isNewOwner
        ? `${input.counterpartName} te transfirió la propiedad de ${input.workspaceName}.`
        : `Transferiste la propiedad de ${input.workspaceName} a ${input.counterpartName}. Tu rol ahora es Administrador.`),
    details: [
      { label: 'Espacio', value: input.workspaceName },
      {
        label: isNewOwner ? 'Rol nuevo' : 'Tu rol nuevo',
        value: isNewOwner ? 'Propietario' : 'Administrador',
      },
    ],
    action: {
      label: copy?.actionLabel ?? 'Abrir Teams',
      url: input.teamsUrl,
    },
    notice: copy?.notice ?? undefined,
  });
}
