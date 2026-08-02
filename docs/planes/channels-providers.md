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

## WhatsApp Status — lifecycle QR GOWA

Referencia auditada: upstream `aldinokemal/go-whatsapp-web-multidevice` y `AppChannelWhatsAppStatus` de Laravel.

- GOWA devuelve `results.qr_duration`; V2 usa ese valor para `expiresAt` del QR mostrado. No usa un TTL local fijo de diez minutos.
- Un refresh de QR pendiente reutiliza la misma `channel_connection_session` y el mismo `external_connection_id`/slot GOWA. Solo rota la URL QR cifrada y su vencimiento; no crea devices remotos nuevos.
- Portal refresca antes de vencer y vuelve a cargar la imagen por el proxy interno no-cache.
- Una reconexión explícita limpia el slot previo. Si GOWA conserva el slot tras logout, se reutiliza el mismo `device_id`; si el conector debió borrarlo, se recrea únicamente ese slot.
- El `device_id` de GOWA es un slot técnico y no prueba identidad. Si al reconectar se detecta otro teléfono/JID, no se debe reemplazar silenciosamente la identidad del canal: debe fallar con una decisión explícita del usuario para crear o reemplazar el canal.

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
