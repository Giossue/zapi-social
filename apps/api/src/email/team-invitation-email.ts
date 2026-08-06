import { createElement } from 'react';

export function teamInvitationEmail(invitationUrl: string) {
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
      createElement('h1', null, 'Te invitaron a Zapi'),
      createElement(
        'p',
        null,
        'Acepta la invitación con la cuenta asociada a este correo para unirte al espacio de trabajo.',
      ),
      createElement(
        'p',
        null,
        createElement(
          'a',
          { href: invitationUrl, style: { color: '#1d4ed8' } },
          'Aceptar invitación',
        ),
      ),
      createElement(
        'p',
        null,
        'El enlace vence en 7 días y solo se puede usar una vez.',
      ),
    ),
  );
}
