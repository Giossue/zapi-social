# Google Drive Picker para Files y Publishing V2

## Estado

Implementación funcional terminada en código y persistencia. Existen
configuración Admin, Google Picker, contratos, endpoints, migración, Worker,
progreso en Files y selección automática en Publishing.

Pendiente operativo: configurar un proyecto real de Google Cloud, aprobar
visualmente las tres superficies y ejecutar los smokes OAuth/Picker con cuentas
Google personales, Workspace y Shared Drives. Sin esas credenciales no se afirma
un smoke externo real.

Esta vertical extiende Files y Publishing sin convertir Drive en almacenamiento
primario. Todo archivo seleccionado se copia primero a `file_assets`; Publishing
continúa guardando únicamente referencias durables a assets del workspace.

## Objetivo

Permitir que un `owner` o `admin` de Portal elija imágenes o vídeos desde una
cuenta propia de Google Drive mediante la interfaz oficial de Google Picker:

```text
Files
  → Google Picker
  → selección múltiple
  → carpeta abierta
  → importación durable en Files

Publishing
  → Google Picker desde el selector de media
  → selección de un archivo
  → raíz de Files
  → esperar asset ready
  → seleccionar automáticamente el asset importado
  → publishing_post_media referencia file_assets.id
```

No se publica desde una URL de Google ni se conserva una dependencia remota.
Una revocación, movimiento o eliminación posterior en Drive no rompe un post de
Zapi ya creado o programado.

## Decisiones confirmadas

- Google Picker es la superficie de selección. Es un overlay alojado por Google,
  no un `Dialog`, `Sheet` ni explorador de Drive reconstruido por Zapi.
- La primera versión usa OAuth temporal al abrir Picker. No persiste cuentas de
  Google, refresh tokens ni sincronización continua.
- El scope es `https://www.googleapis.com/auth/drive.file`. No se solicita
  `drive`, `drive.readonly` ni acceso general al inventario del usuario.
- Desde `/portal/files`, el destino es la carpeta abierta.
- Desde `/portal/publishing/calendar`, el destino es la raíz de Files porque el
  compositor no tiene una carpeta de navegación activa.
- Files y Publishing abren Picker en selección simple. La multiselección queda
  como mejora posterior a la estabilización del flujo productivo.
- Solo assets `ready`, validados y del mismo workspace pueden seleccionarse en
  Publishing. Un import pendiente nunca se relaciona con un post.
- Cerrar el compositor no cancela una importación ya aceptada. El archivo queda
  disponible en Files cuando el Worker termine.
- El límite inicial sigue siendo 100 MB por archivo y se reutiliza la allowlist,
  inspección binaria, miniaturas y protección de referencias de Files.
- La Browser API Key, OAuth Client ID y App ID son identificadores usados en el
  navegador. No son un OAuth Client Secret. La API key debe estar restringida
  por HTTP referrer y por API en Google Cloud.
- Estas tres credenciales identifican a la aplicación Zapi y se configuran una
  sola vez por el administrador. Los usuarios de Portal no crean llaves: eligen
  su cuenta, conceden `drive.file` y reciben un access token temporal.
- Web usa el componente oficial `@googleworkspace/drive-picker-element` para
  cargar Google Picker y Google Identity Services. Con `drive.file`, la vista
  usa `DocsViewMode.LIST`, tal como recomienda Google al no existir permiso
  general para miniaturas.
- El selector privado se abre con OAuth Client ID, App ID y el token temporal,
  como en los ejemplos Web y React del componente oficial. La Browser API Key
  se conserva en la configuración por compatibilidad, pero no se entrega al
  `drive-picker`: Google la rechazaba en Portal como `API developer key is
invalid` aun cuando su huella coincidía con la configuración probada y
  guardada por Admin.
- Tokens OAuth, resource keys y credenciales transitorias nunca se escriben en
  logs, auditoría, respuestas de error ni payloads BullMQ.

## Referencia Laravel auditada

Laravel ya implementa el flujo en `modules/AppFiles`:

| Superficie    | Comportamiento observado                                                        |
| ------------- | ------------------------------------------------------------------------------- |
| Ajustes       | Activa Google Drive y guarda OAuth Client ID + Browser API Key.                 |
| Navegador     | Carga Google API y Google Identity Services bajo demanda.                       |
| Picker        | Abre `DocsView`, filtra MIME cuando aplica y soporta multiselección.            |
| Portal Files  | Envía cada ID seleccionado al endpoint de importación y refresca la biblioteca. |
| Backend       | Consulta metadata en Drive API, descarga el binario y crea un archivo local.    |
| Shared Drives | Envía `supportsAllDrives` y conserva `resourceKey` cuando existe.               |
| Google Docs   | Exporta Document, Spreadsheet y Presentation a formatos Office.                 |
| Planes        | Puede ocultar Drive mediante la feature `file_google_drive`.                    |

Referencias principales:

- `../ZapiSocial/modules/AppFiles/Resources/views/partials/google-picker-script.blade.php`
- `../ZapiSocial/modules/AppFiles/Support/FileManager.php`
- `../ZapiSocial/modules/AppFiles/Http/Controllers/PortalFileController.php`
- `../ZapiSocial/modules/AppFiles/Resources/views/settings.blade.php`

## Divergencias y mejoras V2

No se copia literalmente la implementación Laravel:

- Laravel pide `drive.readonly`, scope restringido con acceso a todos los
  archivos. V2 usa `drive.file`, acceso por archivo seleccionado y no sensible.
- Laravel deja depuración activa y registra objetos que contienen access tokens.
  V2 redacta los campos sensibles desde la entrada HTTP hasta Worker.
- Laravel descarga el cuerpo completo en memoria. V2 transmite Google → temporal
  → volumen persistente con límite de bytes durante el stream.
- Laravel ejecuta la descarga dentro del request y procesa archivos de forma
  secuencial. V2 crea un lote durable y descarga mediante Worker.
- Laravel repite el access token por cada archivo. V2 lo cifra una vez por lote,
  encola solo el ID del lote y lo elimina al llegar a estado terminal.
- Laravel no modela progreso, reintentos ni idempotencia. V2 persiste cada item,
  sus intentos, resultado seguro y asset final.
- Laravel no llama `setAppId`. V2 configura el número del proyecto de Google y
  exige que Client ID, API Key y App ID pertenezcan al mismo proyecto.
- Laravel denomina `client_secret` a una Browser API Key. V2 usa nombres de
  contrato correctos y nunca solicita un OAuth Client Secret para este flujo.

## Requisitos de Google Cloud

El administrador configura un único proyecto de Google para la plataforma:

1. Activar Google Picker API.
2. Activar Google Drive API.
3. Configurar OAuth consent para audiencia externa.
4. Declarar únicamente el scope `drive.file`.
5. Añadir dominio autorizado `zapisocial.com`.
6. Crear OAuth Client ID tipo Web con origen JavaScript
   `https://app.zapisocial.com`.
7. Crear una Browser API Key restringida al referrer de producción y a Google
   Picker API. Desarrollo usa credencial separada o referrers locales explícitos.
8. Obtener el project number para usarlo como App ID.
9. Completar publicación y verificación de marca antes del uso público.

Fuentes oficiales:

- <https://developers.google.com/workspace/drive/api/guides/picker>
- <https://developers.google.com/workspace/drive/picker/guides/web-picker-sample>
- <https://developers.google.com/workspace/drive/picker/guides/web-component>
- <https://developers.google.com/workspace/drive/picker/reference/picker.docsviewmode>
- <https://developers.google.com/workspace/drive/api/guides/api-specific-auth>

## Superficies y UX

### Admin Integraciones

Crear primero la fuente canónica en
`../diseño ideal/src/app/(main)/dashboard/platform/integrations` y copiarla a
`/admin/integrations`.

La card `Google Drive` sigue el patrón aprobado del resto de proveedores:

- icono, nombre, estado y acción `Ver y configurar`;
- resumen de disponibilidad, scope y entorno autorizado;
- configuración en `Sheet`, nunca modal;
- switch de disponibilidad dentro de su sección compacta;
- campos obligatorios con asterisco rojo: OAuth Client ID, Browser API Key y
  App ID;
- botón primario con icono izquierdo;
- al cambiar configuración, primero se ejecuta `Probar selector`; guardar solo
  se habilita cuando el fingerprint del borrador probado coincide;
- una prueba correcta habilita `Guardar y habilitar` aunque los campos ya
  estuvieran persistidos; probar otro borrador no desactiva la configuración
  actualmente vigente si el administrador cancela;
- el Sheet se oculta mientras Google Picker toma el foco y vuelve a abrirse al
  seleccionar o cancelar; así Google conserva interacción completa sin que el
  borrador ni su estado de prueba se pierdan;
- la prueba abre Picker en el navegador del administrador y no importa el
  archivo elegido;
- Cancelar y cerrar quedan bloqueados durante una operación pendiente.

Estados: loading con `PageLoading`, sin configurar, configurada/deshabilitada,
configurada/habilitada, prueba fallida, origen no autorizado y permiso OAuth
cancelado. Los errores de formulario usan toast.

### Portal Files

Crear la composición nueva primero en
`../diseño ideal/src/app/(main)/dashboard/file-manager`.

- Mantener `Subir archivos` como acción principal.
- Añadir `Google Drive` como acción secundaria con icono a la izquierda.
- Ocultar la acción cuando Admin deshabilita la integración o el rol no puede
  gestionar Files.
- El clic carga Google API/GIS bajo demanda y abre Picker oficial.
- Antes de abrir Picker, Portal vuelve a consultar la configuración efectiva del
  proveedor; Files y Publishing no reutilizan credenciales mantenidas en memoria
  desde una carga anterior de la página.
- Esa lectura usa `no-store` en cliente y servidor. La API audita únicamente una
  huella SHA-256 de la configuración entregada para poder compararla con la
  versión probada sin registrar Client ID, API key ni App ID.
- Web responde con `Cross-Origin-Opener-Policy: same-origin-allow-popups` para
  conservar la comunicación entre la ventana principal y el popup OAuth de
  Google Identity Services.
- Picker filtra únicamente imágenes y vídeos admitidos por Files y permite
  seleccionar un archivo por importación.
- Al confirmar, se crea un lote cuyo `folderId` es la carpeta abierta.
- Mostrar estado persistente compacto del lote mientras procesa: cantidad,
  completados, fallidos y acción de reintentar autenticación cuando corresponda.
- Cada asset terminado aparece mediante refresco/polling de la biblioteca; un
  fallo parcial no oculta los imports correctos.
- Cancelar Picker no crea lote ni muestra error.

### Publishing Calendar

La fuente canónica se amplía primero en
`../diseño ideal/src/app/(main)/dashboard/publishing`.

`PublishingMediaPicker` sigue mostrando Files como fuente única durable, pero
añade una acción `Importar desde Google Drive`:

- abre Picker oficial en selección simple;
- crea el lote con `folderId=null` y `sourceContext=publishing`;
- conserva el compositor abierto mientras se importa, sin bloquear texto,
  cuentas ni fecha;
- muestra una tarjeta compacta `Importando desde Google Drive` dentro del
  selector de media;
- deshabilita guardar/publicar si la cuenta exige media y el import aún no está
  `ready`;
- al terminar, inserta el nuevo asset en la lista y lo selecciona
  automáticamente;
- si falla, conserva el resto del formulario y ofrece `Intentar de nuevo` o
  `Elegir otro archivo`;
- si el usuario cierra el compositor, el lote continúa y no crea un post por sí
  solo;
- al reabrir, el asset terminado aparece como cualquier otro elemento de Files.

El compositor no recibe ni conserva URLs Google, access tokens o provider file
IDs. `mediaAssetIds` continúa siendo el único input de Publishing.

## Contratos REST propuestos

Los nombres se fijan al implementar el mock aprobado, pero el contrato objetivo
es:

| Método y ruta                                 | Responsabilidad                                                 |
| --------------------------------------------- | --------------------------------------------------------------- |
| `GET /v1/admin/integrations/google-drive`     | Leer estado Admin sin devolver secretos inexistentes ni tokens. |
| `PATCH /v1/admin/integrations/google-drive`   | Guardar enabled, Client ID, Browser API Key y App ID.           |
| `GET /v1/portal/files/providers/google-drive` | Entregar configuración pública efectiva al Portal autenticado.  |
| `POST /v1/portal/files/imports/google-drive`  | Crear lote idempotente desde selección Picker.                  |
| `GET /v1/portal/files/imports/:id`            | Consultar progreso del lote del mismo workspace.                |

Input de creación de lote:

```ts
{
  accessToken: string
  credentialExpiresAt: string
  destinationFolderId?: string | null
  idempotencyKey: string
  sourceContext: "files" | "publishing"
  files: Array<{
    providerFileId: string
    resourceKey?: string
  }>
}
```

Reglas:

- máximo 20 items desde Files y uno desde Publishing;
- `destinationFolderId` debe pertenecer al workspace y estar activo;
- el body no es autoridad para nombre, MIME, tamaño o categoría;
- API consulta metadata desde Worker antes de crear/finalizar el asset;
- `accessToken`, `providerFileId` y `resourceKey` son campos redactados;
- la idempotency key evita duplicados por reintento de red, pero una nueva
  selección explícita puede crear otra copia;
- un usuario solo consulta lotes de su workspace.

Errores públicos normalizados:

```text
GOOGLE_DRIVE_DISABLED
GOOGLE_DRIVE_AUTH_REQUIRED
GOOGLE_DRIVE_PERMISSION_DENIED
GOOGLE_DRIVE_FILE_NOT_FOUND
GOOGLE_DRIVE_UNSUPPORTED_FILE
GOOGLE_DRIVE_FILE_TOO_LARGE
GOOGLE_DRIVE_IMPORT_EXPIRED
GOOGLE_DRIVE_IMPORT_FAILED
```

No se devuelve cuerpo, URL remota, provider payload ni diagnóstico interno.

## Persistencia propuesta

### Configuración global

Reutilizar `provider_integrations` con `provider_key=google-drive`:

```text
enabled
readiness
configuration_ciphertext
tested_config_fingerprint
last_tested_at
last_tested_by_platform_admin_id
```

Configuración cifrada:

```text
oauthClientId
browserApiKey
appId
```

Aunque estos valores llegan al navegador, mantener el almacenamiento Admin
uniforme evita configuración dispersa. La API solo los expone a un Portal
autenticado cuando la integración está habilitada y lista.

### Lotes

Crear migración aditiva:

```text
file_import_batches
  id
  workspace_id
  requested_by_user_id
  provider_key
  source_context
  destination_folder_id nullable
  status pending|processing|completed|partial|failed|expired
  encrypted_access_token nullable
  credential_expires_at
  idempotency_key
  total_items
  completed_items
  failed_items
  timestamps

file_import_items
  id
  batch_id
  provider_file_id_ciphertext nullable
  provider_file_id_hash
  resource_key_ciphertext nullable
  status pending|processing|completed|failed
  file_asset_id nullable
  attempt_count
  error_code nullable
  timestamps
```

Constraints:

- FK workspace/usuario/carpeta coherentes;
- unique por `workspace_id + requested_by_user_id + idempotency_key`;
- unique por `batch_id + provider_file_id_hash`;
- `file_asset_id` debe pertenecer al mismo workspace mediante FK compuesta;
- token e identificadores cifrados se ponen en `null` al completar, fallar de
  forma terminal o expirar;
- no guardar correo, avatar ni nombre de la cuenta Google en esta fase.

Metadata segura del asset final:

```json
{
  "source": "google_drive",
  "importBatchId": "uuid"
}
```

No guardar token, resource key, URL compartida ni payload Picker.

## Worker y almacenamiento

Crear cola `file-imports`; el job contiene solo `batchId`.

Por item:

1. Claim transaccional e idempotente.
2. Descifrar credencial temporal.
3. Consultar `files.get` con `supportsAllDrives=true` y campos mínimos.
4. Rechazar tamaño, MIME o tipo no permitido antes de descargar cuando sea
   posible.
5. Descargar `alt=media` por stream hacia temporal con límite de bytes.
6. Verificar tamaño real, extensión normalizada, MIME y firma binaria usando la
   misma política de la subida directa.
7. Mover el temporal al volumen, finalizar `file_assets` y encolar miniatura.
8. Vincular item → asset y actualizar contadores del lote.
9. Limpiar temporales y credenciales al terminar.

Google Docs, Sheets y Slides quedan fuera de la primera entrega orientada a
media. No se ejecuta `files.export` hasta definir formatos, límites y UX para
documentos.

Reintentos:

- máximo tres para timeout, 429 y 5xx, con backoff;
- 401/403 por token revocado o vencido termina como `AUTH_REQUIRED`/`EXPIRED`;
- 404, formato inválido y tamaño excesivo son permanentes;
- si Redis falla tras crear el lote, un scheduler recupera lotes `pending`;
- jobs estables por `google-drive-import-<batchId>`;
- nunca reintentar después de crear el asset sin detectar primero el vínculo
  durable del item.

La política pura de tipos/firma debe extraerse de `FilesService` a una unidad
compartida por API y Worker; no se mantienen dos allowlists divergentes.

## Seguridad, permisos y privacidad

- PlatformAdmin configura el provider; nunca accede al Drive de clientes.
- `owner` y `admin` pueden importar; `member` conserva lectura de Files.
- Google OAuth se inicia por gesto explícito para evitar bloqueadores de popup.
- Scope mínimo `drive.file`; no pedir perfil, email ni refresh token.
- Configuración de producción y desarrollo usa credenciales/referrers separados.
- CSP permite únicamente los hosts oficiales necesarios de Google.
- Los scripts se cargan desde Google, sin proxy ni caché local.
- Campos redactados se añaden al interceptor/logger global y a auditorías.
- BullMQ, logs, toasts y errores nunca contienen access token ni IDs remotos.
- El Worker borra temporales ante éxito, error, reinicio recuperado o expiración.
- Revocar Google afecta imports futuros, no assets ya copiados.
- La copia consume la cuota normal del workspace y respeta límites del plan
  cuando esa capacidad exista.

## Estados de UI obligatorios

```text
provider deshabilitado
provider incompleto
scripts cargando
popup bloqueado
OAuth cancelado
Picker cancelado
selección vacía
import pending
import processing
import completed
import partial
import failed
credencial expirada
archivo no permitido
archivo demasiado grande
sin permiso de workspace
sin resultados en Files
responsive + claro/oscuro + teclado
```

Cancelar OAuth o Picker es una salida normal, no un toast de error.

## Estado de implementación

- [x] Mock source-first en `diseño ideal` para Admin, Files y Publishing.
- [ ] Aprobación visual del usuario sobre los tres entrypoints.
- [x] Contratos Zod y cliente REST.
- [x] Configuración Admin cifrada en `provider_integrations`, con prueba real
      del Picker y fingerprint obligatorio antes de habilitar.
- [x] Migración `0030_boring_xavin` con lotes/items aplicada y verificada en
      `zapi_v2_local` y en la base remota `zapi_v2`.
- [x] Política binaria compartida en `packages/file-ingestion` y Worker
      `file-imports` con streaming, reintentos, recuperación y limpieza.
- [x] Endpoints Portal con ownership, cifrado, idempotencia y polling.
- [x] Files conectado con multiselección y destino en carpeta abierta.
- [x] Publishing conectado con selección simple, raíz y auto-selección.
- [ ] Google Cloud Testing con cuentas autorizadas y Shared Drives.
- [ ] OAuth publicado/verificado y smoke en producción.

## Evidencia de implementación

- Migración local/remota: ambas bases registran 31 migraciones, timestamp
  `1786634864084`, tablas `file_import_batches`/`file_import_items` y cuatro
  constraints críticos comprobados.
- API focal: `google-drive-imports.integration.spec.ts`, 2 pruebas y 13
  aserciones; cubre cifrado, idempotencia,
  workspace, rol, fingerprint Admin y preservación de la configuración activa
  mientras se prueba otra.
- Worker focal: `google-drive-import.processor.spec.ts` y
  `google-drive-import.integration.spec.ts`, 3 pruebas y 13 aserciones; cubre
  retries, límites, streaming, firma, asset final, limpieza y miniatura.
- `bun run audit:portal-admin-ui`: sin hallazgos.
- `bun run typecheck`: 8 tareas aprobadas.
- `bun run build`: Contracts, Database, File Ingestion, API, Worker y Web
  aprobados; el build fuente de `diseño ideal` también aprobó.
- Lint focal Web/API/Worker: cero errores; Web conserva seis advertencias del
  patrón actual de efectos/`img`. El lint raíz sigue bloqueado por configuración ESLint faltante
  en paquetes compartidos, no por diagnósticos de esta vertical.

## Pruebas y evidencia requerida

### Contratos/API

- rechaza member, carpeta ajena y lote de otro workspace;
- rechaza más de 20 items y más de uno desde Publishing;
- misma idempotency key devuelve el mismo lote;
- configuración deshabilitada no expone claves ni acepta imports;
- respuestas y logs no contienen token/resource key/provider file ID;
- Admin requiere configuración completa y prueba del fingerprint actual.

### Worker

- stream correcto sin buffer completo;
- tamaño declarado y real limitado a 100 MB;
- MIME/extensión/firma inválida no crea asset ready;
- retries 429/5xx, no retry 401/403/404/formato;
- recuperación tras caída antes y después de finalizar asset;
- éxito parcial conserva assets correctos;
- token e identificadores cifrados se limpian en estado terminal;
- miniatura se encola y un fallo de derivados no elimina el original.

### Web

- Picker solo carga tras acción del usuario;
- cancelación no crea registros ni muestra error;
- Files envía la carpeta abierta y refresca assets completados;
- Publishing usa raíz, espera `ready` y auto-selecciona el asset;
- cerrar compositor no cancela import ni crea post;
- provider deshabilitado oculta acciones;
- pending usa `Spinner`, carga de región usa `PageLoading`;
- botones principales conservan icono izquierdo;
- build, typecheck, lint focal, `audit:portal-admin-ui` y `git diff --check`.

### Smoke Google

- cuenta personal y Google Workspace;
- usuario con varias cuentas Google abiertas;
- Shared Drive con resource key;
- imagen válida, vídeo válido, archivo excesivo y tipo no soportado;
- revocación de permiso durante un lote;
- referrer producción correcto y referrer no autorizado rechazado;
- asset importado permanece publicable después de revocar Google.

## Criterios de aceptación

- El usuario reconoce la ventana oficial de Google y no entrega credenciales a
  Zapi.
- Zapi accede solamente a archivos seleccionados mediante `drive.file`.
- Toda selección aceptada produce un lote durable con progreso honesto.
- Un archivo no aparece seleccionable en Publishing antes de estar `ready`.
- Files y Publishing terminan usando el mismo asset durable y las mismas reglas
  de ownership, validación, miniaturas y borrado.
- Programar o publicar no depende de Google Drive ni de un token vigente.
- Ningún secreto temporal aparece en logs, Redis, auditoría o respuestas.
- Los imports son idempotentes, reintentables dentro de la vigencia del token y
  recuperables después de reinicio.

## Fuera de alcance

- Cuentas Google conectadas permanentemente y refresh tokens.
- Sincronización bidireccional o automática con carpetas Drive.
- Publicar directamente desde una URL de Drive.
- Escribir, mover o eliminar archivos en el Drive del usuario.
- Google Docs, Sheets, Slides, Forms y exportaciones Office.
- Dropbox, OneDrive, Google Photos API y navegación construida por Zapi.
- Multiselección nueva dentro del compositor Publishing; permanece en un asset
  hasta que producto apruebe carruseles desde esa UI.

## Fase posterior opcional

Si producto necesita cuentas permanentes:

- OAuth Authorization Code + PKCE server-side;
- refresh tokens cifrados por usuario/workspace;
- lista de cuentas conectadas, reconectar, desconectar y revocar;
- selector de cuenta antes de Picker;
- auditoría de consentimiento y rotación/revocación;
- revisión adicional de política y privacidad.

Esa fase no es necesaria para seleccionar e importar media bajo demanda.
