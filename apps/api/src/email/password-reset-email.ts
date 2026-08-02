import { createElement } from 'react';

export function passwordResetEmail(resetUrl: string) {
  return createElement(
    'html',
    { lang: 'es' },
    createElement(
      'body',
      {
        style: {
          fontFamily: 'Arial, sans-serif',
          color: '#171717',
          lineHeight: '1.5',
        },
      },
      createElement('h1', null, 'Restablece tu contraseña'),
      createElement(
        'p',
        null,
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta Zapi.',
      ),
      createElement(
        'p',
        null,
        createElement(
          'a',
          { href: resetUrl, style: { color: '#1d4ed8' } },
          'Restablecer contraseña',
        ),
      ),
      createElement(
        'p',
        null,
        'Este enlace vence en 60 minutos y solo puede usarse una vez.',
      ),
      createElement(
        'p',
        null,
        'Si no solicitaste este cambio, puedes ignorar este correo.',
      ),
    ),
  );
}
