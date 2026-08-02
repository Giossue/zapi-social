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

## Sincronización global de perfiles

La sincronización de foto, nombre y handle es un proceso global del worker; nunca exige reconectar un canal solo para actualizar su presentación.

### Política base

| Parámetro | Valor inicial | Razón |
| --- | ---: | --- |
| Sweep global | cada 5 min | Busca trabajo vencido sin polling por navegador. |
| Batch máximo | 25 cuentas | Limita CPU, memoria, Redis y tráfico externo. |
| Concurrencia | 2 por provider worker | Evita ráfagas y facilita respetar rate limits. |
| Perfil normal | cada 24 h | Avatar/nombre cambian poco. |
| Timeout externo | 10 s | Evita workers bloqueados por providers lentos. |
| Reintento | 1 con backoff exponencial | Recupera fallos transitorios sin loops. |

Cada cuenta guarda en `social_accounts.metadata.profileSyncDueAt` su próxima revisión. El worker actualiza ese vencimiento después de un sync correcto y conserva `channel_sync_runs` como auditoría segura. No guarda tokens ni payloads completos en logs o metadata de runs.

### Meta implementado

Meta usa el page access token cifrado de `social_account_credentials` y actualiza únicamente campos que hayan cambiado:

| Capability | Consulta Graph | Campos actualizados |
| --- | --- | --- |
| `facebook_page` | `id,name,picture{url}` | nombre, avatar, URL de página |
| `instagram_profile` | `id,username,profile_picture_url` | nombre, handle, avatar, URL de perfil |

Una respuesta `401`/`403` deja un run seguro con `GRAPH_UNAUTHORIZED`; una reconexión posterior renueva el token según el flujo existente. El worker no desconecta ni reemplaza la cuenta por un cambio de perfil.

### WhatsApp Status implementado

WhatsApp Status usa adapter GOWA independiente del token Graph, aunque Portal lo agrupe visualmente bajo Meta. El Worker solo procesa cuentas activas si la integración GOWA está habilitada y `ready`; descifra su configuración con el mismo contexto seguro de API.

```text
metadata.deviceId (fallback external_id)
→ GET /user/info
→ GET /devices/:id solo si falta identidad
→ GET /user/avatar solo si existe teléfono/JID
→ actualizar nombre, teléfono/JID, avatar y profileSyncDueAt
```

No crea QR, no crea devices y no reconecta WhatsApp. Errores de conector quedan como códigos seguros `GOWA_*` en `channel_sync_runs` con operación `whatsapp_profile_sync`.

### Adaptación futura por provider

LinkedIn, X y TikTok reutilizan la cola, batch, auditoría y el vencimiento por cuenta; solo cambia el adapter del provider:

```text
credencial cifrada + endpoint de perfil + límites del provider
→ snapshot tipado
→ actualizar únicamente display_name / handle / avatar_url / profile_url
→ profileSyncDueAt + channel_sync_runs
```

Antes de habilitar cada adapter se debe confirmar su modelo de token, refresh, scopes, endpoint de perfil, rate limit y formato de avatar. No se asume que sus frecuencias o mecanismos sean iguales a Meta.

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
