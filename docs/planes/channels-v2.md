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

## Decisiones de producto confirmadas

- Meta comparte una configuración global, pero Facebook Page e Instagram Profile se habilitan y conectan de forma independiente. El cliente puede tener una, otra o ambas; nunca se le obliga a conectar las dos.
- Cada provider tiene un switch global y cada capability tiene su propio switch. Ambos deben estar activos para permitir una conexión.
- Un cambio de configuración activa solo puede guardarse después de una prueba satisfactoria contra el provider o conector usando los valores que están en edición. Esto incluye credenciales, scopes y switches de capability. Deshabilitar el provider global se guarda de inmediato, sin requerir prueba.
- El Portal inicia directamente desde una capability, como Laravel; no obliga al usuario a elegir primero un provider.
- Una operación conecta o elige un único recurso elegible. Los pickers solo muestran recursos devueltos por el provider para esa conexión.
- Al alcanzar un límite de plan se bloquean conexiones nuevas, pero se permite reconectar una cuenta existente.
- Un canal desconectado muestra aviso y no puede publicar hasta reconectarse. Borrarlo es una operación simple para todos los providers, incluido WhatsApp.
- Las capabilities no listas aparecen en el Portal bloqueadas con **Próximamente**. Si están listas pero el plan no las incluye, aparecen bloqueadas con **No incluido en tu plan**.
- Los errores del Portal son simples y accionables; el diagnóstico técnico queda limitado a PlatformAdmin y logs redactados.
- Prioridad de entrega: Meta, después Historias de WhatsApp; LinkedIn, X y TikTok quedan planificados sin anticipar su backend.

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

| Área          | Ruta V2               | Responsabilidad                                                       |
| ------------- | --------------------- | --------------------------------------------------------------------- |
| PlatformAdmin | `/admin/integrations` | Configuración global, readiness y diagnóstico del proveedor           |
| PortalUser    | `/portal/channels`    | Inventario, conexión, reconexión y operación de cuentas del workspace |

La separación de identidad está definida en [separacion-admin-portal.md](./separacion-admin-portal.md). PlatformAdmin no posee canales ni puede iniciar conexiones de cliente.

No existe en Laravel un CRUD administrativo global de `social_accounts`; V2 tampoco lo crea sin una decisión de producto explícita.

## Referencia Laravel auditada

| Superficie              | Legacy                      | Referencia                                            |
| ----------------------- | --------------------------- | ----------------------------------------------------- |
| Hub Admin               | `/admin/integrations`       | `modules/AppIntegrations/Livewire/IntegrationHub.php` |
| Registro modular        | `register_channel_module()` | `modules/AppChannels/Support/helpers.php`             |
| Catálogo de capacidades | `ChannelCatalog`            | `modules/AppChannels/Support/ChannelCatalog.php`      |
| Portal                  | `/portal/channels`          | `modules/AppChannels/Livewire/PortalDashboard.php`    |
| Cuentas conectadas      | `social_accounts`           | `modules/AppChannels/Models/SocialAccount.php`        |
| Scope workspace         | `TeamWorkspaceAccess`       | `modules/AppTeams/Support/TeamWorkspaceAccess.php`    |
| Límites de plan         | `ChannelPlanAccess`         | `modules/AppChannels/Support/ChannelPlanAccess.php`   |

Laravel registra el provider desde cada módulo de canal. El Hub Admin renderiza los campos declarados por dicho módulo; no tiene una lista de inputs OAuth fija.

## Catálogo de proveedores y capabilities

### Meta

Meta agrupa dos capabilities distintas bajo la infraestructura Meta, pero cada una tiene callback, scopes y picker propios.

| Capability          | Configuración global Laravel                                                                                | Flujo Portal Laravel                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `facebook_page`     | enabled, app ID, app secret, Graph API version, permisos, callback OAuth y callback de eliminación de datos | OAuth → lista páginas elegibles → picker → persistencia idempotente                        |
| `instagram_profile` | enabled, app ID, app secret, Graph API version, permisos y callback OAuth                                   | OAuth Meta → lista perfiles Business/Creator elegibles → picker → persistencia idempotente |

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

| Capability         | Configuración global Laravel                                    | Flujo Portal Laravel                                                        |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `linkedin_profile` | enabled, app ID, app secret, scopes member, callback            | OAuth → perfil del miembro → persistencia                                   |
| `linkedin_page`    | enabled, app ID, app secret, scopes de organizaciones, callback | OAuth → lista organizaciones/páginas administrables → picker → persistencia |

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
  key: "meta" | "linkedin" | "x" | "tiktok" | "whatsapp_status"
  configSchema: ZodSchema
  secretFields: readonly string[]
  requiredFields: readonly string[]
  callbacks: readonly CallbackDefinition[]
  testDraft: (config: ProviderConfigValues) => ProviderTestResult
  capabilities: readonly ChannelCapabilityDefinition[]
}

type ChannelCapabilityDefinition = {
  key: ChannelCapabilityKey
  providerKey: ProviderKey
  connectionKind: "oauth_direct" | "oauth_picker" | "qr_device"
  supportsPublishing: boolean
  requiredPlanFeature: string
}

type ProviderIntegrationState = {
  providerEnabled: boolean
  enabledCapabilityKeys: ChannelCapabilityKey[]
  readinessStatus: "incomplete" | "untested" | "ready" | "failed"
  testedConfigFingerprint: string | null
}
```

Los callbacks se calculan a partir de `API_PUBLIC_ORIGIN` y no son editables desde Admin. El frontend los muestra como valores copiables junto a una explicación de dónde registrarlos en el proveedor externo.

`providerEnabled` controla toda la infraestructura. `enabledCapabilityKeys` permite publicar solo las capabilities preparadas de un provider compartido, por ejemplo Facebook Page sin Instagram Profile. La disponibilidad efectiva requiere: configuración completa, último test correcto para la configuración exacta, provider activo y capability activa.

El test se ejecuta con el borrador en memoria, no con una configuración previamente guardada. La API devuelve un comprobante de prueba de vida corta asociado al fingerprint del borrador; `PATCH` exige ese comprobante y rechaza cualquier diferencia posterior. Así una prueba correcta no puede autorizar el guardado de valores distintos.

### PostgreSQL

```text
provider_integrations
  provider_key unique
  enabled
  enabled_capability_keys jsonb
  config_ciphertext
  config_version
  readiness_status
  readiness_issues jsonb
  tested_config_fingerprint nullable
  last_tested_at nullable
  last_tested_by_platform_admin_id nullable
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

`POST /test` recibe el borrador validado, incluidos switches y scopes, y prueba ese estado sin persistir credenciales. Devuelve solo un resultado seguro y un comprobante temporal vinculado al fingerprint del borrador. `PATCH` acepta únicamente campos de la definición y exige ese comprobante; un secreto omitido conserva el existente y una respuesta nunca devuelve secretos. No se guarda ningún cambio si el test falla, expira o corresponde a otro borrador.

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

La ruta conserva el resumen operativo de cada proveedor en su card. Toda
edición de configuración se abre en un `Sheet` lateral derecho ancho,
siguiendo el patrón de gestión de acceso de `/portal/teams`; no se usan
diálogos ni formularios completos incrustados en la página. Los grupos largos
se presentan como secciones verticales. Todos los sheets comparten encabezado
con divisor inferior y una card independiente para la disponibilidad del
proveedor. No se anidan cards de sección: en Meta, cada tipo de canal es una
card directa dentro de su sección. Sus permisos se muestran como una lista
persistente de checkboxes con etiquetas que pueden envolver varias líneas y
los obligatorios se identifican solo con un asterisco rojo; no se ocultan
dentro de dropdowns estrechos ni se usan badges de obligatoriedad.
Cerrar o cancelar el sheet descarta el borrador local. El `SheetContent`
completo usa una sola región de scroll vertical, sin contenedores desplazables
anidados, para que los formularios largos siempre permitan alcanzar todos los
campos y acciones.

La pantalla muestra instrucciones específicas de cada provider: scopes, callback(s), versión Graph para Meta y requisitos del conector GOWA para WhatsApp. No mostrará campos de OAuth para WhatsApp.

### Portal Channels

Regla de bloqueo de conexión nueva:

El inventario de `/portal/channels` se presenta como una rejilla de cards,
no como tabla: dos columnas en móvil y cuatro columnas fijas desde `xl`, aun
cuando existan menos de cuatro canales. La búsqueda, los filtros de proveedor,
tipo y estado, la paginación y la acción de conexión permanecen visibles. Cada
card conserva identidad, estado, capability, proveedor, fecha de conexión y
todas las acciones operativas. La composición canónica vive en
`template-shadcn-superdashboard/src/app/(main)/dashboard/channels` y V2 adapta
únicamente datos, traducciones, permisos y handlers reales.

**Implementado el 23 de agosto de 2026.** `ChannelsService.portalCapabilities()`
deriva la disponibilidad de la integración de Admin de cada proveedor: hace
falta que esté encendida, con `readiness` en `ready` —lo que ya exige
credenciales guardadas y una prueba que coincida con ellas— y con la capability
concreta activada. Un proveedor que todavía no tiene pantalla de Admin nunca
está listo. Cubierto por `channel-availability.spec.ts`.

El catálogo dejó de devolver rótulo y descripción: la API no traduce y la
interfaz los resuelve desde `key` con `useChannelLabels` y
`channels.capabilityDescription`.

| Estado efectivo                                                     | Acción y etiqueta Portal                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| Provider incompleto, sin test vigente, apagado o capability apagada | Bloqueado · **Próximamente**                              |
| Provider listo + capability activa + feature de plan permitida      | **Conectar**                                              |
| Feature de plan ausente o límite de una conexión nueva alcanzado    | Bloqueado · **No incluido en tu plan** o límite alcanzado |
| Cuenta existente desconectada                                       | **Reconectar**, incluso si el límite ya está alcanzado    |

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

## Plan de ejecución y checklist de progreso

**Estado del plan:** diseño Admin parcialmente aprobado. No se implementará una conexión externa real ni persistencia nueva hasta cerrar los estados mock de Admin y Portal y aprobar sus contratos.

### Fase 0 — Referencia Laravel y alcance `[en curso]`

- [x] Auditar Hub Admin, catálogo, Portal, límites y scope de workspace de Laravel.
- [x] Separar configuración global, capability de canal y cuenta conectada.
- [x] Identificar Meta con picker, LinkedIn Page con picker, X con PKCE y TikTok con creator info.
- [x] Identificar Historias de WhatsApp como flujo QR/GOWA, no OAuth.
- [x] Registrar las decisiones de producto confirmadas en este documento.
- [ ] Cerrar la equivalencia exacta por capability para cualquier permiso o acción Laravel aún no descrito durante la implementación.

### Fase A — Mock de administración `[en curso]`

**Qué se hará:** terminar `/admin/integrations` usando fixtures, sin almacenar secretos ni llamar a providers.

- [x] Crear catálogo mock de Meta, LinkedIn Profile/Page, X, TikTok y Historias de WhatsApp.
- [x] Mostrar configuración específica, scopes de selección múltiple y callbacks calculados/copiables.
- [x] Mantener el selector de scopes abierto al marcar o desmarcar opciones.
- [x] Documentar que no se usarán hero cards ni logos externos como dependencia UI.
- [x] Añadir switch global por provider.
- [x] Añadir switch independiente por capability; Meta debe permitir activar solo Facebook Page o solo Instagram Profile.
- [x] Añadir estado `incompleto`, `sin probar`, `probando`, `prueba correcta` y `prueba fallida`.
- [x] Modelar el botón **Probar configuración** con valores draft y bloquear **Guardar** hasta éxito.
- [x] Invalidar la prueba mock cuando cambia cualquier campo, scope o switch.
- [ ] Diseñar permisos, loading, error seguro, secreto existente write-only y responsive claro/oscuro.
- [ ] Obtener aprobación visual explícita del mock Admin.

**Criterio de salida:** el Admin puede representar de forma inequívoca qué capability está disponible, qué cambio requiere prueba y por qué un provider no está listo, sin guardar ni exponer valores sensibles.

### Fase B — Mock del Portal `[aprobado; estados complementarios pendientes]`

**Qué se hará:** construir `/portal/channels` con repositorio mock y fixtures sintéticas; el usuario inicia por capability, como en Laravel.

- [x] Crear inventario mock de cuentas conectadas y desconectadas, limitado a las cuentas accesibles del workspace.
- [x] Crear selector directo de capabilities, no selector previo de provider.
- [x] Representar capacidades no listas como bloqueadas con **Próximamente**.
- [x] Representar bloqueo de plan separado como **No incluido en tu plan**.
- [x] Permitir **Reconectar** una cuenta existente aunque el límite de altas nuevas esté alcanzado.
- [ ] Diseñar OAuth mock para conexión directa, callback válido/expirado, cancelación y error recuperable.
- [x] Diseñar pickers mock de un recurso por operación para Facebook Page e Instagram Profile.
- [x] Diseñar mock de Historias de WhatsApp: generar QR, espera, expiración, regeneración y conexión.
- [x] Bloquear publicación de canales desconectados y mostrar aviso de reconexión.
- [ ] Diseñar estados empty, búsqueda vacía, permisos, móvil, claro y oscuro.
- [x] Obtener aprobación visual y funcional de los flujos mock del Portal.

**Evidencia del inventario en cards — 29 de agosto de 2026:** `bun run
typecheck`, `bun run lint`, `bun run build`, `bun run audit:portal-admin-ui`,
`bun run audit:i18n` y `bun run audit:i18n-hardcoded` completaron sin
hallazgos en V2. La fuente visual nueva del template pasó Biome y compiló con
Next; su build global conserva dos errores TypeScript ajenos a Channels en
`chart-area-interactive.tsx` y `store-traffic.tsx`. La aprobación visual de la
rejilla nueva sigue a cargo del usuario.

**Criterio de salida:** cada botón del Portal tiene un estado, permiso, resultado y mensaje mock definido antes de crear endpoints o adapters.

### Fase C — Contratos y persistencia `[pendiente; después de aprobar A y B]`

**Cómo se hará:** contratos Zod específicos por provider/capability compartidos entre `packages/contracts`, API y cliente; Nest no expondrá entidades ni secretos.

- [ ] Versionar `ProviderDefinition`, schemas de configuración y schemas de respuestas públicas.
- [ ] Definir `ProviderIntegrationState` con provider activo, capabilities activas, readiness y test vigente.
- [ ] Definir el contrato de prueba draft: request validado → resultado seguro + comprobante temporal por fingerprint.
- [ ] Hacer que el contrato de guardado exija el comprobante; rechazar prueba vencida, fallida o de otro borrador.
- [ ] Añadir migraciones necesarias: capabilities activas, fingerprint/fecha/autor de prueba y sesiones efímeras de conexión.
- [ ] Cifrar configuraciones y credenciales; conservar secretos omitidos y devolverlos siempre redactados.
- [ ] Definir códigos de error públicos y `requestId`; prohibir payload OAuth/QR técnico en respuestas y logs.
- [ ] Revisar y aprobar OpenAPI/REST antes de implementar llamadas externas.

**Criterio de salida:** el frontend mock puede cambiar al API client sin reescribir sus componentes, y el API conoce el estado de readiness exacto por capability.

### Fase D — Administración real y seguridad `[pendiente]`

- [ ] Implementar autorización `PlatformAdmin + integrations.manage`.
- [ ] Implementar `GET/PATCH /v1/admin/integrations/:providerKey` mediante definitions versionadas.
- [ ] Implementar `POST /test` por provider sin persistir el borrador durante la prueba.
- [ ] Persistir solo cambios asociados a una prueba vigente y correcta.
- [ ] Calcular callbacks desde origen público seguro y exponerlos en lectura sin permitir edición.
- [ ] Auditar cambios de configuración sin registrar secretos.
- [ ] Probar validación local, fallo remoto seguro, comprobante expirado, modificación posterior a prueba y autorización.

### Fase E — Meta: Facebook Page e Instagram Profile `[prioridad 1]`

- [ ] Implementar inicio OAuth por capability con state de un uso y expiración.
- [ ] Intercambiar código de forma segura y consultar exclusivamente recursos elegibles.
- [ ] Persistir candidatos efímeros de la conexión y permitir seleccionar una sola página o perfil.
- [ ] Crear/actualizar `social_accounts` de forma idempotente por workspace, capability y external ID.
- [ ] Implementar reconnect sin consumir cupo de plan; validar ownership y limpiar credenciales obsoletas de forma segura.
- [ ] Implementar callback Meta de eliminación de datos y estado de confirmación auditado.
- [ ] Probar sandbox: scopes insuficientes, picker vacío, callback expirado, selección duplicada, disconnect y reconnect.

### Fase F — Historias de WhatsApp `[prioridad 2]`

- [ ] Implementar adapter del conector con configuración cifrada y prueba de conectividad Admin.
- [ ] Crear una sesión QR efímera cifrada y un lock por workspace/dispositivo.
- [ ] Proxificar QR con `Cache-Control: no-store`; nunca persistir imagen, URL original ni contenido QR en logs.
- [ ] Hacer polling idempotente hasta conectar, cancelar, vencer o fallar con mensaje seguro.
- [ ] Resolver perfil/dispositivo y persistir la cuenta con `device_id` y metadata mínima necesaria.
- [ ] En reconnect/delete, purgar de forma segura el dispositivo remoto y la cuenta/credenciales locales según corresponda.
- [ ] Probar con entorno autorizado sin registrar número, QR o credenciales.

### Fase G — Providers restantes `[pendiente]`

- [ ] LinkedIn Profile: OAuth, perfil, credenciales cifradas y reconnect.
- [ ] LinkedIn Page: discovery y picker solo de organizaciones administrables devueltas por LinkedIn.
- [ ] X: OAuth 2.0 PKCE, verifier cifrado, refresh y revocación segura.
- [ ] TikTok: OAuth, creator info, persistencia de restricciones y conexión permitida aunque publicar no esté habilitado.
- [ ] Mantener para todos los estados de bloqueo, plan, permisos, delete y reconnect definidos en A/B.

### Fase H — Workers, consumidores y validación final `[pendiente]`

- [ ] Añadir BullMQ para refresh, sincronización y operaciones largas después de cada adapter aprobado.
- [ ] Usar locks e idempotencia por cuenta/dispositivo; registrar operaciones seguras en `channel_sync_runs`.
- [ ] Entregar a Publishing, AI, RSS, Groups y Automation solo canales activos y accesibles por membership.
- [ ] Tests de autorización PlatformAdmin/Portal, scope por `managed_account_ids` y límites de plan.
- [ ] Tests de schemas, redacción de secretos, state OAuth, PKCE, pickers y comprobantes de prueba.
- [ ] Tests QR/polling/cancel/reconnect/delete con conector mock.
- [ ] Ejecutar typecheck, lint/build disponibles y revisión responsive/visual.
- [ ] Ejecutar pruebas sandbox por provider solo con credenciales autorizadas.

## Reglas de implementación permanentes

- Mantener registro modular: provider global + capability de canal; no convertirlo en un formulario OAuth universal.
- No implementar backend ni llamadas reales de una capability mientras su mock, estados y contrato no estén aprobados.
- El Portal no ve capabilities operables si falta configuración o prueba: las ve bloqueadas como **Próximamente**. El bloqueo de plan no se disfraza como disponibilidad técnica.
- Owner conserva acceso total según el modelo Laravel; miembros solo ven/gestionan canales dentro de sus permisos y `managed_account_ids`.
- `channel.view` permite inventario; `channel.manage` permite conectar, reconectar, editar o borrar. Toda acción verifica workspace, plan, readiness y ownership.
- Nunca exponer `config_ciphertext`, secretos, access/refresh tokens, PKCE verifier, QR o query strings OAuth con `code`/`state`.
- No crear inventario global Admin de cuentas de clientes sin decisión de producto explícita.
