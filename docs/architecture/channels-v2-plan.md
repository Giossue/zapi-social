# Channels V2 — equivalencia operativa Laravel → Next/Nest

## Decisión

Channels no es un formulario universal de OAuth. Zapi V2 conserva el modelo funcional de Laravel:

```text
PlatformAdmin
  configura infraestructura global por proveedor
  (credenciales, versiones, scopes, callbacks y readiness)

PortalUser
  conecta y opera recursos de su workspace
  (páginas, perfiles, organizaciones o dispositivos)
```

Una **configuración de proveedor** no es una **cuenta conectada**. Un proveedor puede exponer varias capacidades de canal y cada una tiene su propio flujo de conexión, selección, persistencia, reconexión y publicación.

```text
ProviderConfig
  Meta / LinkedIn / X / TikTok / WhatsApp GOWA
      ↓ habilita una o más
ChannelCapability
  facebook_page / instagram_profile / linkedin_page / ...
      ↓ crea o reconecta
SocialAccount
  recurso externo perteneciente a un workspace
```

No implementar una UI o API genérica que reduzca todos los proveedores a `clientId` + `clientSecret`.

## Regla de migración

```text
Laravel routes + controllers + módulos + schema
→ mapa funcional por capability
→ diseño Next con fixtures/mocks y todos los estados
→ contratos REST/Zod
→ Nest + Drizzle + adapters externos + workers
```

No se copiarán secretos, tokens, cuentas ni recursos reales de Laravel a V2. Las fixtures son sintéticas y deterministas. Las llamadas a APIs externas solo se prueban cuando PlatformAdmin introduzca credenciales de sandbox o producción autorizadas.

## Separación Admin y Portal

| Área | Ruta V2 | Responsabilidad |
| --- | --- | --- |
| PlatformAdmin | `/admin/integrations` | Configuración global, readiness y diagnóstico del proveedor |
| PortalUser | `/portal/channels` | Inventario, conexión, reconexión y operación de cuentas del workspace |

La separación de identidad está definida en [platform-admin-portal-separation-plan.md](./platform-admin-portal-separation-plan.md). PlatformAdmin no posee canales ni puede iniciar conexiones de cliente.

No existe en Laravel un CRUD administrativo global de `social_accounts`; V2 tampoco lo crea sin una decisión de producto explícita.

## Referencia Laravel auditada

| Superficie | Legacy | Referencia |
| --- | --- | --- |
| Hub Admin | `/admin/integrations` | `modules/AppIntegrations/Livewire/IntegrationHub.php` |
| Registro modular | `register_channel_module()` | `modules/AppChannels/Support/helpers.php` |
| Catálogo de capacidades | `ChannelCatalog` | `modules/AppChannels/Support/ChannelCatalog.php` |
| Portal | `/portal/channels` | `modules/AppChannels/Livewire/PortalDashboard.php` |
| Cuentas conectadas | `social_accounts` | `modules/AppChannels/Models/SocialAccount.php` |
| Scope workspace | `TeamWorkspaceAccess` | `modules/AppTeams/Support/TeamWorkspaceAccess.php` |
| Límites de plan | `ChannelPlanAccess` | `modules/AppChannels/Support/ChannelPlanAccess.php` |

Laravel registra el provider desde cada módulo de canal. El Hub Admin renderiza los campos declarados por dicho módulo; no tiene una lista de inputs OAuth fija.

## Catálogo de proveedores y capabilities

### Meta

Meta agrupa dos capabilities distintas bajo la infraestructura Meta, pero cada una tiene callback, scopes y picker propios.

| Capability | Configuración global Laravel | Flujo Portal Laravel |
| --- | --- | --- |
| `facebook_page` | enabled, app ID, app secret, Graph API version, permisos, callback OAuth y callback de eliminación de datos | OAuth → lista páginas elegibles → picker → persistencia idempotente |
| `instagram_profile` | enabled, app ID, app secret, Graph API version, permisos y callback OAuth | OAuth Meta → lista perfiles Business/Creator elegibles → picker → persistencia idempotente |

Rutas auditadas:

```text
/portal/channels/facebook/page/connect
/integrations/facebook/page
/portal/channels/facebook/page/select

/portal/channels/instagram/profile/connect
/integrations/instagram/profile
/portal/channels/instagram/profile/select
```

Laravel también tiene un callback real de eliminación de datos de Meta que verifica `signed_request`, elimina cuentas Meta asociadas y devuelve un código de confirmación:

```text
POST /integrations/facebook/data-deletion
GET  /integrations/facebook/data-deletion/status/{code}
```

V2 no considera Meta listo hasta incluir el endpoint de borrado de datos y su auditoría.

### LinkedIn

LinkedIn Profile y LinkedIn Page son capabilities separadas. Laravel actualmente permite configuración independiente para cada una.

| Capability | Configuración global Laravel | Flujo Portal Laravel |
| --- | --- | --- |
| `linkedin_profile` | enabled, app ID, app secret, scopes member, callback | OAuth → perfil del miembro → persistencia |
| `linkedin_page` | enabled, app ID, app secret, scopes de organizaciones, callback | OAuth → lista organizaciones/páginas administrables → picker → persistencia |

```text
/portal/channels/linkedin/profile/connect
/integrations/linkedin/profile

/portal/channels/linkedin/page/connect
/integrations/linkedin/page
/portal/channels/linkedin/page/select
```

### X

`x_profile` usa OAuth 2.0 con PKCE. No debe reutilizar un adapter OAuth genérico que no conserve y consuma el verifier.

```text
Configuración Admin:
  enabled, client ID, client secret, scopes, callback URL calculada

Portal:
  iniciar OAuth + state + PKCE verifier
  callback + exchange
  persistir perfil y refresh token cifrado
```

Ruta legacy:

```text
/portal/channels/x/profile/connect
/integrations/x/profile
```

### TikTok

TikTok usa `client_key`, no `client_id`, y requiere conocer las capacidades de creator antes de habilitar publicación.

```text
Configuración Admin:
  enabled, client key, client secret, scopes, callback URL calculada

Portal:
  OAuth → exchange → creator info → persistencia
  mostrar si la cuenta puede publicar y sus restricciones relevantes
```

Ruta legacy:

```text
/portal/channels/tiktok/profile/connect
/integrations/tiktok/profile
POST /portal/channels/tiktok/profile/creator-info
```

### WhatsApp Status (GOWA)

WhatsApp Status no es OAuth ni usa App ID/Secret. PlatformAdmin configura un conector GOWA compartido:

```text
enabled
connector base URL
Basic Auth username
Basic Auth password
```

Portal conecta un dispositivo por QR:

```text
crear o reutilizar device remoto
→ iniciar QR
→ servir/proxificar la imagen QR sin cache
→ polling de estado
→ detectar sesión vinculada
→ leer perfil, teléfono y avatar
→ persistir SocialAccount de WhatsApp Status
```

Para reconectar, Laravel elimina/purga primero el device remoto asociado; para borrar un canal, limpia el device remoto y la cuenta local. El canal almacena `device_id`, teléfono, `status@broadcast` y metadata operativa; no tokens OAuth ficticios.

Rutas auditadas:

```text
GET  /portal/channels/whatsapp-status/connect
POST /portal/channels/whatsapp-status/start-qr
GET  /portal/channels/whatsapp-status/qr-image
GET  /portal/channels/whatsapp-status/status
```

Referencia:

```text
modules/AppChannelWhatsAppStatus/Http/Controllers/WhatsAppStatusConnectController.php
modules/AppChannelWhatsAppStatus/Services/GoWa/GoWaApiService.php
```

## Modelo de dominio V2

### Provider definitions en código

Las definiciones de proveedor y capability son código versionado, no filas editables de base de datos. Eso evita que un Admin pueda inventar callbacks, tipos de flujo o secretos esperados.

```ts
type ProviderDefinition = {
  key: "meta" | "linkedin_profile" | "linkedin_page" | "x" | "tiktok" | "whatsapp_status"
  configSchema: ZodSchema
  secretFields: readonly string[]
  requiredFields: readonly string[]
  readiness: (config: ProviderConfigValues) => ProviderReadiness
  capabilities: readonly ChannelCapabilityDefinition[]
}

type ChannelCapabilityDefinition = {
  key: ChannelCapabilityKey
  providerKey: ProviderKey
  connectionKind: "oauth_direct" | "oauth_picker" | "qr_device"
  supportsPublishing: boolean
  requiredPlanFeature: string
}
```

Los callbacks se calculan a partir de `API_PUBLIC_ORIGIN` y no son editables desde Admin. El frontend los muestra como valores copiables junto a una explicación de dónde registrarlos en el proveedor externo.

### PostgreSQL

```text
provider_integrations
  provider_key unique
  enabled
  config_ciphertext
  config_version
  readiness_status
  readiness_issues jsonb
  updated_by_platform_admin_id
  updated_at

social_accounts
  workspace_id
  provider_key
  capability_key
  external_id
  display_name, username, avatar_url, profile_url
  connection_status
  connected_at, disconnected_at
  metadata jsonb
  unique(workspace_id, capability_key, external_id)

social_account_credentials
  social_account_id unique
  access_token_ciphertext
  refresh_token_ciphertext
  expires_at
  scopes
  rotation metadata

channel_oauth_states
  state_hash
  provider_key
  capability_key
  workspace_id
  user_id
  pkce_verifier_ciphertext nullable
  reconnect_account_id nullable
  expires_at
  consumed_at

channel_connection_sessions
  workspace_id
  capability_key
  social_account_id nullable
  status
  external_connection_id
  context_ciphertext
  expires_at

channel_sync_runs
  social_account_id
  operation
  status
  request_id, job_id
  error_code, error_detail_safe
  started_at, finished_at
```

`channel_connection_sessions` cubre el contexto efímero de QR/GOWA y sustituye cualquier estado de sesión PHP. No almacena imágenes QR ni secretos sin cifrar.

Nunca exponer `config_ciphertext`, credenciales, PKCE verifier, QR URL original ni payload técnico completo mediante REST, logs, eventos o fixtures.

## Contratos REST objetivo

Las rutas son específicas por flujo; no usar un único `POST /channels/manual` como camino principal.

### Admin

```text
GET   /v1/admin/integrations
GET   /v1/admin/integrations/:providerKey
PATCH /v1/admin/integrations/:providerKey
POST  /v1/admin/integrations/:providerKey/test
GET   /v1/admin/integrations/:providerKey/callbacks
```

`PATCH` acepta únicamente los campos de la definición de ese provider. Un secreto omitido conserva el existente; una respuesta nunca devuelve secretos. `test` verifica conectividad segura cuando la API externa lo permita y persiste un resultado seguro, no el payload remoto completo.

### Portal: inventario y operación

```text
GET    /v1/portal/channels
PATCH  /v1/portal/channels/:channelId
POST   /v1/portal/channels/:channelId/status
DELETE /v1/portal/channels/:channelId
POST   /v1/portal/channels/:channelId/reconnect
```

### Portal: OAuth

```text
POST /v1/portal/channel-connections/oauth/start
GET  /v1/oauth/channels/:providerKey/callback
GET  /v1/portal/channel-connections/:connectionId/candidates
POST /v1/portal/channel-connections/:connectionId/select
POST /v1/portal/channel-connections/:connectionId/cancel
```

`start` recibe un `capabilityKey`, no credenciales ni tokens. El callback valida y consume state antes de redirigir a Portal. El selector solo acepta candidatos emitidos para la conexión actual; no acepta IDs externos arbitrarios.

### Portal: WhatsApp QR

```text
POST /v1/portal/channel-connections/whatsapp-status/start
GET  /v1/portal/channel-connections/:connectionId/qr
GET  /v1/portal/channel-connections/:connectionId/status
POST /v1/portal/channel-connections/:connectionId/cancel
```

El endpoint QR se entrega con `Cache-Control: no-store`. `status` es idempotente: al detectar conexión persiste una única cuenta por `workspace + capability + device/external id` y devuelve el canal creado o actualizado.

## Estados de UI obligatorios

### Admin integrations

Para cada provider:

```text
loading
sin acceso
provider disabled
provider incomplete con campos faltantes
provider listo
validando conexión
error de validación local
error de conectividad remoto seguro
guardando
secreto existente no revelado / secreto reemplazado
```

La pantalla muestra instrucciones específicas de cada provider: scopes, callback(s), versión Graph para Meta y requisitos del conector GOWA para WhatsApp. No mostrará campos de OAuth para WhatsApp.

### Portal Channels

```text
loading
sin canales
sin resultados por búsqueda/filtros
sin permiso
límite de plan alcanzado
provider disabled o incompleto
iniciando OAuth
callback inválido o expirado
picker cargando
picker sin recursos elegibles
picker con recursos elegibles
selección guardando
canal conectado
reconexión en curso
error recuperable
```

### Portal WhatsApp Status

```text
conector no listo
creando device
QR disponible con expiración
esperando escaneo
conectando
conectado
QR expirado / reiniciar
cancelado
error del conector seguro
reconectando y purgando device previo
```

Todos los estados se diseñan primero con fixtures/mock sintéticos, en claro/oscuro, escritorio/móvil y sin reproducir primitives fuera de `packages/ui`.

## Seguridad, permisos e idempotencia

```text
/admin/integrations/*
  requiere PlatformAdmin + integrations.manage

/portal/channels/*
  requiere PortalUser + workspace membership activa
  requiere channels.view o channels.manage según acción
```

Cada conexión comprueba:

1. sesión Portal y workspace activo;
2. permiso de gestión;
3. feature y límite de plan de la capability;
4. provider enabled y ready;
5. ownership del `reconnect_account_id` o `channelId`;
6. state/conexión sin expirar ni consumir;
7. clave idempotente al persistir recursos externos.

Los errores públicos usan `code` + `requestId`; los detalles técnicos quedan en logs redactados. Nunca registrar query strings OAuth con `code` o `state`.

## Orden de implementación

### Fase 0 — Corrección del alcance actual

- [x] Auditar el Hub Admin y los módulos Laravel por provider.
- [x] Identificar que WhatsApp Status es QR/GOWA, no OAuth.
- [x] Identificar pickers Meta y LinkedIn Page.
- [x] Identificar X PKCE y TikTok creator info.
- [ ] Sustituir la simplificación de provider genérico en el plan, contratos y UI pendiente por definitions/capabilities específicas.
- [ ] No presentar el OAuth actual de Meta/LinkedIn como conexión funcional: falta exchange, picker y persistencia.

### Fase A — Diseño mock y contrato, sin backend nuevo

- [ ] Crear fixture `ProviderDefinition` con Meta, LinkedIn Profile/Page, X, TikTok y WhatsApp Status.
- [ ] Rediseñar `/admin/integrations` desde schemas específicos de provider y primitives de `packages/ui`.
- [ ] Diseñar el wizard reusable de conexión por capability en `features/channels`.
- [ ] Diseñar pickers mock para Facebook Page, Instagram Profile y LinkedIn Page.
- [ ] Diseñar flujo mock de QR/polling/reconexión de WhatsApp Status.
- [ ] Validar normal/loading/empty/error/permisos/móvil/claro/oscuro.
- [ ] Acordar contratos Zod antes de Nest.

### Fase B — Base de datos, seguridad y API Admin

- [x] Base inicial de `provider_integrations`, `social_accounts`, credenciales y OAuth states creada.
- [ ] Añadir `config_version`, `readiness_issues` y `channel_connection_sessions` si aún no existen.
- [ ] Definir y versionar schemas Zod por provider/capability.
- [ ] Validar y cifrar configuración por schema.
- [ ] Mantener secretos write-only en DTOs y UI.
- [ ] Implementar diagnóstico/test seguro por provider.

### Fase C — Meta: Facebook Page e Instagram Profile

- [ ] Implementar exchange de código Meta y validación de state.
- [ ] Consultar páginas y perfiles elegibles con scopes aprobados.
- [ ] Persistir candidatos efímeros para picker, no confiar en IDs enviados por el navegador.
- [ ] Confirmar selección con `updateOrCreate` idempotente.
- [ ] Implementar callback de eliminación de datos Meta y auditoría.
- [ ] Probar sandbox Meta y casos de scopes insuficientes, lista vacía y reconnect.

### Fase D — LinkedIn

- [ ] Implementar exchange/profile para `linkedin_profile`.
- [ ] Implementar discovery + picker de organizaciones para `linkedin_page`.
- [ ] Persistir credenciales cifradas, expiración y scopes.
- [ ] Probar límites, permisos organizacionales y reconnect.

### Fase E — X y TikTok

- [ ] Implementar X OAuth 2.0 PKCE, exchange, refresh y revocación segura.
- [ ] Implementar TikTok OAuth, creator info y persistencia de capacidades de publicación.
- [ ] Bloquear en UI las opciones no permitidas por cada creator/profile.
- [ ] Probar callbacks, state expirado, refresh y errores de provider.

### Fase F — WhatsApp Status GOWA

- [ ] Implementar adapter GOWA con URL base y Basic Auth cifrados.
- [ ] Crear sesión de conexión QR efímera cifrada.
- [ ] Proxificar QR sin cache y polling idempotente.
- [ ] Resolver perfil/dispositivo al conectar y persistir SocialAccount.
- [ ] Purgar device remoto de manera segura en reconnect/delete.
- [ ] Añadir lock, timeout, reintentos y observabilidad con `channel_sync_runs`.
- [ ] Probar con un conector sandbox sin registrar QR, número o credenciales en logs.

### Fase G — Workers y consumidores

- [ ] BullMQ para refresh de tokens, sync de perfiles y operaciones largas.
- [ ] Locks por cuenta/dispositivo y claves de idempotencia.
- [ ] Propagar solo canales activos/accesibles a Publishing, AI, RSS, Groups y Automation.
- [ ] Registrar run seguro con `requestId`, `jobId`, código de error y timestamps.

### Fase H — Validación final

- [ ] Tests de autorización Admin/Portal.
- [ ] Tests de schemas y redacción de secretos.
- [ ] Tests OAuth state, callback, PKCE y selector con providers mock.
- [ ] Tests QR/polling/cancel/reconnect de WhatsApp con GOWA mock.
- [ ] Tests de idempotencia por external ID/device ID.
- [ ] Typecheck, lint/build disponibles, revisión responsive y visual.
- [ ] Prueba sandbox por proveedor tras configurar credenciales autorizadas.

## Decisiones explícitas respecto a Laravel

- Mantener la arquitectura de registro modular: provider global + capability de canal.
- Mantener campos y flujos específicos; no transformar WhatsApp en OAuth ni Meta en un formulario mínimo.
- No replicar el alta manual de tokens en claro.
- No usar `created_by_user_id` como scope: V2 usa `workspace_id` explícito.
- No usar sesiones PHP para OAuth/QR: V2 usa estados y sesiones efímeras cifradas, consumibles e idempotentes.
- No implementar un inventario global Admin de cuentas de clientes.
- No introducir workers o llamadas externas antes de aprobar los mocks y contratos de la capability correspondiente.
