# Plan — cierre de sincronización de perfil Meta

## Objetivo

Cerrar y verificar la sincronización de perfil para Meta sin reconectar el canal ni exponer tokens. Incluye Facebook Pages e Instagram Profiles cuando exista una cuenta activa de cada capability.

## Estado — Facebook Profile Sync cerrado el 2026-08-02

| Capability | Cuenta | Datos actuales | Auditoría de sync | Estado |
| --- | --- | --- | --- | --- |
| `facebook_page` | activa | nombre y avatar presentes; `external_id` y token cifrado existen | `meta_profile_sync` terminó `succeeded` a las 02:38 Ecuador; próximo vencimiento 2026-08-03 02:38 Ecuador | cerrado |
| `instagram_profile` | no hay cuenta conectada en la BD consultada | — | — | fuera de prueba actual |
| `whatsapp_status` | activa | perfil y avatar actualizados | último run `succeeded` | cerrado, fuera de alcance |

La cuenta Facebook Meta cumplió condiciones del selector y produjo un run `succeeded`. Worker, BullMQ, cifrado y acceso Graph quedaron verificados para esta cuenta.

## Referencia Laravel auditada

### Módulos y permisos

- Facebook: `AppChannelFacebookPages`.
- Instagram: `AppChannelInstagramProfiles`.
- Laravel valida capacidad de plan antes de conectar o reconectar: `facebook_page` / `instagram_profile`.
- Laravel valida propietario al reconectar por `created_by_user_id`, provider y capability.
- V2 conserva equivalente de ownership por workspace y limita sync manual a roles `owner` y `admin`.

### Flujo Facebook Page

Archivo: `ZapiSocial/modules/AppChannelFacebookPages/Services/Facebook/FacebookApiService.php`.

```text
OAuth: https://www.facebook.com/{graph_version}/dialog/oauth
Token: GET https://graph.facebook.com/{graph_version}/oauth/access_token
Páginas: GET /{graph_version}/me/accounts
fields: id,name,access_token,category,link,picture{url},tasks
Perfil de página: GET /{page-id}
fields: id,name,picture{url}
```

Archivo: `ZapiSocial/modules/AppChannelFacebookPages/Http/Controllers/FacebookPageConnectController.php`.

- `state` queda ligado a usuario y sesión.
- Callback valida usuario, `state`, cancelación, código OAuth, capacidad y límite de plan.
- Selección posterior conserva token y candidato de página.

### Flujo Instagram Profile

Archivo: `ZapiSocial/modules/AppChannelInstagramProfiles/Services/Instagram/InstagramApiService.php`.

```text
OAuth: https://www.facebook.com/{graph_version}/dialog/oauth
Token: GET https://graph.facebook.com/{graph_version}/oauth/access_token
Páginas candidatas: GET /{graph_version}/me/accounts
fields: instagram_business_account,id,name,username,fan_count,link,is_verified,picture{url},access_token,category
Perfil Instagram: GET /{instagram-business-account-id}
fields: id,name,username,profile_picture_url,ig_id
```

## Equivalencia V2 existente

### Portal/API

```text
POST /v1/portal/channels/:id/profile-sync
```

- Autorización: sesión Portal, ownership de workspace y rol `owner` o `admin`.
- Respuesta: `202 Accepted`; API encola, no llama Graph directamente.
- Cooldown: 15 min por cuenta con `metadata.profileManualRefreshRequestedAt`.
- Provider aceptado: `meta` o `whatsapp-status`.

### Worker Meta

```text
meta-profile-schedule      → cada 5 min busca hasta 25 cuentas vencidas
meta-profile-sync          → concurrencia 2, timeout Graph 10 s, 1 reintento
```

| Capability | Endpoint V2 actual | Fields | Campos V2 actualizados |
| --- | --- | --- | --- |
| `facebook_page` | `GET https://graph.facebook.com/v22.0/{external_id}` | `id,name,picture{url}` | `display_name`, `avatar_url`, `profile_url`, `profileSyncDueAt` |
| `instagram_profile` | `GET https://graph.facebook.com/v22.0/{external_id}` | `id,username,profile_picture_url` | `display_name`, `handle`, `avatar_url`, `profile_url`, `profileSyncDueAt` |

Credencial se descifra solo dentro del Worker con contexto `meta:account:<account-id>`. Logs y auditoría guardan códigos seguros, no tokens ni payloads Graph.

## Riesgo a resolver antes de declarar cerrado

Laravel toma versión Graph configurable y usa `v25.0` como fallback. Worker V2 tiene `v22.0` fijo. Antes de ampliar o actualizar adapter, confirmar versión Graph soportada por app Meta y ajustar una única fuente de configuración; no inferir que `v22.0` siga disponible.

## Plan de ejecución

1. **Comprobar despliegue Worker.** Confirmar que imagen desplegada contiene `MetaProfileSyncScheduler`, `MetaProfileScheduleProcessor` y `MetaProfileSyncProcessor`, y que usa mismo Redis y PostgreSQL que API.
2. **Instrumentar mínimamente.** Añadir logs estructurados seguros para scheduler Meta: cuentas seleccionadas, job encolado, inicio/fin del processor y código de error. Nunca loguear token, URL con query ni payload Graph.
3. [x] **Probar manual.** Portal encoló sync Meta y `channel_sync_runs.metadata.operation = meta_profile_sync` terminó `succeeded`.
4. [x] **Verificar persistencia.** BD confirmó avatar y `profileSyncDueAt` avanzado 24 h.
5. **Probar scheduler.** Esperar máximo 5 min con `profileSyncDueAt` vencido o ausente. Confirmar que no duplica jobs y que no vuelve a consultar hasta vencimiento.
6. **Manejar errores.** Validar respuestas `401/403 → GRAPH_UNAUTHORIZED`, `429 → GRAPH_RATE_LIMITED`, timeout y respuesta inválida. Reconexión solo si token no autorizado; nunca borrar canal por error de perfil.
7. [x] **Cerrar Facebook Profile Sync.** Evidencia `succeeded` registrada. Instagram se prueba cuando exista una cuenta conectada; no bloquea este cierre.

## Validación requerida

```text
bun run --filter worker typecheck
bun run --filter worker build
podman build --file Dockerfile.worker --tag zapi-worker:local .
```

Además, lectura BD posterior al deploy:

```text
social_accounts.metadata.profileSyncDueAt presente
channel_sync_runs.metadata.operation = meta_profile_sync
channel_sync_runs.status = succeeded
```

## Documentación externa pendiente

No hace falta documentación adicional para reproducir endpoints: Laravel deja campos y flujo claros. Antes de cambiar versión Graph, scopes, endpoints o habilitar Instagram en producción, hace falta confirmar en documentación oficial de Meta:

- versión Graph soportada por app;
- permisos concedidos para Page e Instagram Business;
- vigencia/renovación de token y límites de rate;
- disponibilidad de `profile_picture_url` para tipo de cuenta conectado.

## Evidencia recibida de Meta

- La aplicación Meta declara Graph API `v25`.
- Pruebas completadas para `pages_read_engagement`, `instagram_content_publish`, `instagram_basic`, `business_management` y `pages_manage_posts`.
- La pantalla muestra llamadas de prueba para `pages_show_list` y ninguna para `public_profile`; no muestra por sí sola nivel Standard/Advanced ni los scopes emitidos en token.

Decisión: no mantener `v22.0` fijo como supuesto de producción. Antes de siguiente release del adapter Meta, usar versión configurada y compatible con aplicación Meta; prueba manual actual también debe confirmar que endpoint v25 responde para token existente.
