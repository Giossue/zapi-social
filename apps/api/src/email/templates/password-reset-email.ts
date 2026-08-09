import { zapiEmailTemplate } from './email-template';

export function passwordResetEmail(resetUrl: string) {
  return zapiEmailTemplate({
    preview: 'Usa este enlace para restablecer tu contraseña de Zapi.',
    title: 'Restablece tu contraseña',
    description:
      'Recibimos una solicitud para cambiar la contraseña de tu cuenta Zapi.',
    action: { label: 'Restablecer contraseña', url: resetUrl },
    notice:
      'Este enlace vence en 60 minutos y solo puede usarse una vez. Si no solicitaste el cambio, ignora este correo.',
  });
}
