import type { EmailCopyOverride } from './email-copy';
import { zapiEmailTemplate } from './email-template';

export function passwordResetEmail(resetUrl: string, copy?: EmailCopyOverride) {
  return zapiEmailTemplate({
    preview: 'Usa este enlace para restablecer tu contraseña de Zapi.',
    title: copy?.title ?? 'Restablece tu contraseña',
    description:
      copy?.body ??
      'Recibimos una solicitud para cambiar la contraseña de tu cuenta Zapi.',
    action: {
      label: copy?.actionLabel ?? 'Restablecer contraseña',
      url: resetUrl,
    },
    notice:
      copy?.notice ??
      'Este enlace vence en 60 minutos y solo puede usarse una vez. Si no solicitaste el cambio, ignora este correo.',
  });
}
