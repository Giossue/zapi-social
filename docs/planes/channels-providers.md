# Plan Channels V2 - providers restantes

## Alcance

Completar los providers de Channels sin borrar fixtures aprobados. Cada provider pasa por: diseño mock aprobado → contrato → API → worker → integración Portal.

## Orden

1. Cerrar Meta: data deletion, readiness por capability y workers de token/sync.
2. WhatsApp Status: GOWA, QR real, polling, lifecycle de device y limpieza remota.
3. LinkedIn Profile: OAuth directo y persistencia de miembro.
4. LinkedIn Page: OAuth, organizaciones administradas y picker.
5. X Profile: OAuth 2.0 con PKCE, refresh token y perfil directo.
6. TikTok Profile: OAuth, creator-info y restricciones de publicación.
7. Publicación/sync/refresh por provider mediante BullMQ.

## Reglas transversales

- Configuración Admin específica por provider, cifrada y probada antes de activarse.
- Portal solo recibe estado seguro, candidatos autorizados y URLs de callback calculadas.
- OAuth state, PKCE verifier, tokens y contextos temporales se cifran y expiran.
- Reconectar no consume cupo. Los límites de plan quedan fuera de este plan hasta construir Admin Plans.
- Redis gestiona locks, rate limits y jobs; PostgreSQL conserva estado y auditoría.
- Fixtures aprobados se preservan aunque una capability pase a API real.

## Referencias Laravel

- Meta: `AppChannelFacebookPages`, `AppChannelInstagramProfiles`
- WhatsApp: `AppChannelWhatsAppStatus`
- LinkedIn: `AppChannelLinkedinProfiles`, `AppChannelLinkedinPages`
- X: `AppChannelXProfiles`
- TikTok: `AppChannelTiktokProfiles`

## Dependencias externas

- GOWA disponible para WhatsApp.
- Apps y callbacks configurados en LinkedIn, X y TikTok.
- Acceso API y scopes aprobados por cada proveedor.
- Nunca compartir credenciales por chat.
