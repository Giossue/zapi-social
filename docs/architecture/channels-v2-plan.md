# Channels V2 — plan de equivalencia Laravel → Next/Nest

## Regla de migración

Laravel ya contiene comportamiento de producto. V2 lo traduce a Next/Nest/Drizzle/BullMQ:

```text
Laravel routes + controllers + Livewire + schema
→ contrato REST + schema V2 + UI Next
→ adapters OAuth/QR + workers
→ configuración manual por Admin Integrations
```

Credenciales externas no bloquean implementación. El sistema debe quedar listo para que Admin introduzca/configure providers localmente; la única validación diferida es llamada real a cada sandbox externo. `API_PUBLIC_ORIGIN` es una URL pública no secreta y obligatoria: construye el callback registrado en Meta y LinkedIn; las credenciales de cada provider siguen exclusivamente cifradas en `provider_integrations`.

## Decisión de arquitectura

Laravel separa dos superficies que V2 conservará:

```text
Portal /portal/channels
  Inventario y operación de canales del workspace activo.

Admin /admin/integrations
  Configuración global de proveedores, readiness y capabilities.
```

**No existe** en Laravel un CRUD administrativo global de filas `social_accounts`. V2 no creará uno sin una regla de producto adicional.

## Referencia Laravel

| Superficie         | Ruta legacy                                    | Implementación                                                                                             |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Portal channels    | `/portal/channels`                             | `modules/AppChannels/Livewire/PortalDashboard.php` + `Resources/views/livewire/portal-dashboard.blade.php` |
| Admin integrations | `/admin/integrations`                          | `modules/AppIntegrations/Livewire/IntegrationHub.php`                                                      |
| Modelo de canal    | `social_accounts`                              | `modules/AppChannels/Models/SocialAccount.php`                                                             |
| Scope workspace    | `TeamWorkspaceAccess::accessibleAccountsQuery` | `modules/AppTeams/Support/TeamWorkspaceAccess.php`                                                         |
| Plan/permisos      | `ChannelPlanAccess`                            | `modules/AppChannels/Support/ChannelPlanAccess.php`                                                        |

## Equivalencia V2

### Rutas

```text
/portal/channels                 # inventario del workspace
/admin/integrations              # readiness/configuración de providers
```

Portal y Admin comparten `packages/ui`, tokens y primitives. Diferencias: permisos, composición y datos; no tema paralelo.

### Datos PostgreSQL V2

```text
provider_integrations
  configuración global cifrada por provider
  enabled, readiness, capabilities, updated_by_user_id

social_accounts
  workspace_id, provider_key, capability_key
  identidad pública, estado, timestamps
  tokens cifrados y metadata técnica separada

social_account_credentials
  social_account_id, access_token_ciphertext, refresh_token_ciphertext
  expires_at, scopes, rotation metadata

social_account_memberships
  social_account_id, workspace_membership_id
  scope de acceso granular para miembros no owner

channel_oauth_states
  state hash, provider, user_id, workspace_id, PKCE verifier cifrado
  expires_at, reconnect_account_id

channel_sync_runs
  social_account_id, status, started_at, finished_at, error_code
```

No almacenar tokens en claro ni exponerlos en REST, UI, logs o fixtures.

### Permisos V2

```text
channels.view
channels.manage
integrations.manage
```

Toda mutación comprueba sesión, membership activa, workspace, role/permission, ownership y capability habilitada.

## Auditoría de acciones legacy

`PortalDashboard` no es solo un CRUD manual. Sus acciones auditadas son:

- Filtros y vista: `switchProvider`, `clearFilters`, búsqueda, estado, orden y selección visible.
- Operación: editar nombre, activar, pausar, borrar y reconectar cuentas accesibles.
- Alta: `createAccount(capabilityKey)` valida plan, capability, cuota y readiness; luego redirige a OAuth/QR o abre el flujo manual legacy.
- Pickers: Facebook Page, Instagram Profile y LinkedIn Page permiten seleccionar resultados OAuth y persisten de forma idempotente por cuenta externa.
- Directos: LinkedIn Profile, TikTok y X persisten el perfil tras callback OAuth; X exige PKCE.
- WhatsApp Status: QR GOWA, polling, cleanup de device remoto antes de reconnect o borrado local.
- Bulk: existen métodos de activar, pausar y borrar, pero la vista legacy actual no los expone; V2 no los replica hasta solicitud explícita.

Regla V2: la alta no expone tokens ni JSON técnico. Solo providers `ready` y habilitados pueden iniciar una conexión. La alta manual actual es un soporte temporal de fase D, no el flujo principal final.

## Traducción por provider

| Provider        | Laravel                           | Traducción V2                                                       |
| --------------- | --------------------------------- | ------------------------------------------------------------------- |
| Meta            | Facebook Pages + Instagram picker | Adapter OAuth Meta, state, picker, `updateOrCreate` por external id |
| LinkedIn        | Profile directo + Page picker     | Adapter OAuth y selector de organizaciones                          |
| TikTok          | OAuth perfil + creator info       | Adapter OAuth, refresh token y capability check                     |
| X               | OAuth 2.0 PKCE                    | Adapter PKCE, state/verifier cifrado y refresh token                |
| WhatsApp Status | GOWA QR/polling                   | Adapter QR, worker/polling de device y cleanup remoto               |

## Estados UI obligatorios

### Portal

```text
loading
sin canales
sin resultados por filtros
provider no configurado
límite alcanzado
sin permiso
OAuth/reconexión en curso
error recuperable
```

### Admin integrations

```text
loading
sin providers registrados
provider deshabilitado
provider incompleto
provider listo
editando
guardando
sin permiso
error recuperable
```

## Contrato REST

```text
GET    /v1/portal/channels
POST   /v1/portal/channels/manual
PATCH  /v1/portal/channels/:id
POST   /v1/portal/channels/:id/status
DELETE /v1/portal/channels/:id
POST   /v1/portal/channels/:id/reconnect

GET    /v1/admin/integrations
PATCH  /v1/admin/integrations/:provider
POST   /v1/admin/integrations/:provider/test

GET    /v1/portal/channels/:provider/connect?capabilityKey=... # sesión manager; 302 al provider
GET    /v1/oauth/channels/:provider/callback               # callback público; valida y consume state; 302 al Portal
POST   /v1/portal/channels/oauth/:provider/select
```

Todos los errores usan `code` + `requestId`; UI mapea código a mensaje humano/toast. Inicio OAuth puede devolver `OAUTH_PROVIDER_UNSUPPORTED`, `OAUTH_PROVIDER_NOT_READY` u `OAUTH_PROVIDER_CONFIGURATION_INVALID`; callback inválido devuelve `OAUTH_CALLBACK_INVALID` u `OAUTH_STATE_INVALID`. El callback no registra su URL de acceso para no incluir `code` ni `state` en logs.

## Estado actual

- A y B: implementadas.
- C: endpoints y UI conectada implementados; falta prueba de readiness por provider y validación final.
- D: listado, alta manual, edición, pausa/reanudación y borrado están implementados. No está cerrado: el listado activo devuelve `500`, falta auditoría de borrado y pruebas de autorización.
- E: redirect adapters Meta y LinkedIn implementados; siguen pendientes exchange, pickers y persistencia de cuentas.

## Checklist de implementación

### A. Diseño y contrato

- [x] Mapear Portal Channels Laravel.
- [x] Mapear Admin Integrations Laravel.
- [x] Documentar rutas, permisos, schema y providers.
- [x] Crear UI mock `/admin/integrations` compartiendo UI/tokens.
- [ ] Completar estados Portal Channels: loading, no providers, provider incompleto, límite, permisos y error.
- [x] Aprobar UI Admin/Portal antes de reemplazar mocks.
- [x] Publicar contratos Zod de Channels/Integrations.

### B. Datos y seguridad

- [x] Migración Drizzle `provider_integrations`.
- [x] Migración Drizzle `social_accounts`.
- [x] Migración Drizzle `social_account_credentials`.
- [x] Migración Drizzle `social_account_memberships`.
- [x] Migración Drizzle `channel_oauth_states`.
- [x] Migración Drizzle `channel_sync_runs`.
- [x] Servicio AES-GCM/secretbox para cifrar credenciales en reposo.
- [x] Redacción de campos sensibles en logs y DTOs.

### C. Admin Integrations real

- [x] Guard de permiso `integrations.manage`.
- [x] Listar providers/readiness desde PostgreSQL.
- [x] Guardar configuración sin devolver secretos.
- [ ] Probar readiness por provider.
- [x] Reemplazar fixture Admin por API.

### D. Portal Channels real

- [x] Guard `channels.view` / `channels.manage`.
- [x] Scope explícito por `workspace_id` y membership.
- [x] Listar, buscar, filtrar y ordenar cuentas.
- [x] Crear cuenta manual sin aceptar tokens en claro por UI.
- [x] Editar nombre y pausar/reanudar.
- [ ] Eliminar con ownership y auditoría.
- [x] Reemplazar fixture Portal por API.

### E. OAuth / QR

- [x] Redirect adapters Meta (`facebook`) y LinkedIn; estado hasheado/cifrado, readiness y callback seguro que lo consume.
- [ ] Meta Facebook Page picker.
- [ ] Meta Instagram Profile picker.
- [ ] Exchange de código y sincronización de perfil LinkedIn.
- [ ] LinkedIn Page picker.
- [ ] TikTok adapter + creator info + refresh.
- [ ] X PKCE adapter + refresh.
- [ ] WhatsApp Status GOWA QR/polling/cleanup.
- [ ] Reconnect y `updateOrCreate` idempotente por cuenta externa.

### F. Workers y consumidores

- [ ] BullMQ refresh de tokens.
- [ ] BullMQ sync de perfiles/canales.
- [ ] Rate limits, locks, reintentos e idempotencia.
- [ ] Persistir `channel_sync_runs` y observabilidad jobId/requestId.
- [ ] Publishing solo acepta cuenta activa/accesible.
- [ ] Groups, Watermarks, RSS y AI consumen scope correcto.

### G. Validación

- [ ] Tests servicio/controlador/autorización.
- [ ] Tests OAuth state/PKCE/callback con provider mock.
- [ ] Tests worker idempotencia/reintentos.
- [ ] Prueba sandbox por provider cuando Admin agregue credenciales locales.
- [ ] Typecheck, build, diff y revisión visual final.

## Decisiones V2 respecto a Laravel

- No replicar modal manual que pide tokens en claro.
- No replicar métodos bulk no expuestos en UI legacy hasta que producto los pida.
- No usar `created_by_user_id` como sustituto de workspace: V2 usa `workspace_id` explícito.
- No inferir superadmin por username; usar permiso/rol explícito.
- No implementar sync periódica como comportamiento implícito: jobs declarados y observables.
