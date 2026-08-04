# Files V2

## Estado

Inventario, carpetas jerárquicas, subida local en streaming, favorito, breadcrumb, acciones de archivo/carpeta, papelera y miniaturas autenticadas están implementados. Quedan fuera de este cierre la retención automática y la purga diferida por Worker.

La base local registra hasta `0015_lyrical_cargill`: `publishing_posts` y `publishing_post_media` son la referencia durable inicial para impedir enviar a papelera un archivo usado por Publishing.

No se implementa ninguna de las fases siguientes hasta aprobar explícitamente este plan.

## Fuentes de verdad

- `../ZapiV2`: destino de contrato, API, Worker, persistencia y Portal.
- `../ZapiSocial/modules/AppFiles`: referencia de lógica Laravel. Se adopta su validación de carga, ownership, preview autenticado y protección de referencias de Publishing, sin copiar su arquitectura Laravel ni proveedores externos.
- `../diseño ideal/src/app/(main)/dashboard/file-manager/`: fuente visual literal de Files. Grid, lista, carpetas, toolbar, tabs, diálogos, hovers, responsive y estados nuevos se crean aquí primero cuando no existan y luego se copian sin reinterpretación a V2.

## Decisiones confirmadas

- Los binarios y derivados viven en el filesystem local persistente del servicio API. No se conecta MinIO, S3 ni otro proveedor.
- Cada recurso pertenece a un workspace. Cualquier lectura, preview, descarga, mutación o derivado comprueba sesión y ownership de workspace.
- Solo `owner` y `admin` pueden subir, crear, renombrar, mover, eliminar, restaurar o purgar. Cualquier miembro activo puede listar, ver preview y descargar los recursos autorizados de su workspace.
- Ninguna URL de archivo o miniatura será pública. Todo acceso pasa por API autenticada; el volumen nunca se expone como directorio HTTP.
- La papelera es lógica. El archivo queda inaccesible desde biblioteca, preview, descarga y compositor mientras está en `trashed`; la purga física se ejecuta solo después de retención y verificación de referencias.
- Los archivos usados por publicaciones `draft`, `processing` o `scheduled` no se pueden enviar a papelera ni purgar hasta retirar su referencia. Esta es una mejora necesaria para que Files no rompa Publishing.
- La selección múltiple no es una fuente de verdad de negocio. Las acciones mutan por IDs validados por API y respetan ownership para cada recurso.

## Estado actual comprobado

| Capacidad                    | Estado actual                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jerarquía                    | `file_folders.parent_folder_id`; root, subcarpetas y breadcrumb implementados.                                                                                                                                                             |
| Carga                        | Crea asset `pending`, recibe binario por stream, escribe al volumen local y confirma `ready`; borra temporal y pendiente si falla. Máximo actual: 100 MB.                                                                                  |
| Validación                   | La extensión y MIME declarado sólo autorizan el inicio; tras el stream se verifica una firma/magic byte compatible antes de pasar a `ready`. Incluye imágenes, media, PDF, OLE/Office, ZIP/ODF, RTF, TAR/GZip/7z/RAR y texto estructurado. |
| Papelera                     | `DELETE` lógico, `POST restore` y `DELETE purge` para archivos y carpetas. Las carpetas operan sobre todo el descendiente; restore conserva el padre cuando sigue activo o vuelve a raíz.                                                  |
| Seguridad de árbol           | Un movimiento de carpeta comprueba workspace, padre activo, ciclo hacia sí misma/descendientes y nombre único entre hermanos sin distinguir mayúsculas.                                                                                    |
| Derivados                    | `GET /v1/portal/files/:id/thumbnail` sirve WebP autenticado; Web usa esa URL sólo cuando el estado es `ready`, con icono como fallback.                                                                                                    |
| Despliegue                   | `infra/podman/compose.apps.yaml` monta `files-data` en el mismo `FILES_STORAGE_PATH` para API y Worker; `Dockerfile.worker` instala `ffmpeg`.                                                                                              |
| Favorito                     | `file_assets.starred`, expuesto y conectado a Portal.                                                                                                                                                                                      |
| Movimiento                   | `PATCH /v1/portal/files/:id` ya permite cambiar `folderId`; falta UI y validación de destino más completa.                                                                                                                                 |
| Papelera                     | `DELETE /v1/portal/files/:id` marca archivo como `trashed`; falta UI, restauración, purga y carpetas.                                                                                                                                      |
| Renombre                     | API de carpetas existe; no hay renombre de archivo ni UI.                                                                                                                                                                                  |
| Descarga                     | Endpoint autenticado implementado.                                                                                                                                                                                                         |
| Preview, player y miniaturas | No implementados. El grid usa iconos de tipo.                                                                                                                                                                                              |
| Tipos permitidos             | No hay allowlist server-side; no se debe confiar en MIME declarado por navegador.                                                                                                                                                          |

## Alcance de cierre

### 1. Modelo, migraciones y datos

- Extender `file_assets` con metadata derivada: `extension`, `width`, `height`, `duration_seconds`, `thumbnail_key`, `thumbnail_status` (`pending|ready|failed`) y `thumbnail_error_code` opcional normalizado.
- Crear una entidad durable de papelera o ampliar `file_assets` con `purge_after` y `deleted_by_user_id`. La decisión de schema se toma al diseñar la restauración de carpetas: una carpeta eliminada debe restaurar su árbol sin perder los padres originales.
- Definir una referencia durable entre Publishing y Files antes de bloquear borrado: tabla de adjuntos/referencias o consulta canónica sobre las entidades de Publishing, nunca inspección informal de JSON desde Web.
- Añadir índices por `workspace_id + status + folder_id`, por assets pendientes de derivados y por retención de papelera.
- Todas las migraciones serán aditivas y se verifican localmente antes de aplicarlas a PostgreSQL remoto. No se aplica una migración remota sin autorización explícita en el turno de implementación.

### 2. Política de carga y tipos permitidos

La allowlist inicial propuesta, sujeta a aprobación de producto, es:

| Grupo           | Extensiones permitidas                          |
| --------------- | ----------------------------------------------- |
| Imagen          | `jpg`, `jpeg`, `png`, `webp`, `gif`, `avif`     |
| Vídeo           | `mp4`, `webm`, `mov`                            |
| Audio           | `mp3`, `wav`, `m4a`, `ogg`                      |
| Documento       | `pdf`, `doc`, `docx`, `txt`, `rtf`, `odt`, `md` |
| Hoja de cálculo | `csv`, `xls`, `xlsx`, `ods`                     |
| Archivo         | `zip`, `7z`, `tar`, `gz`                        |
| Datos           | `json`                                          |

- API valida extensión normalizada, MIME permitido por grupo y firma/contenido cuando el formato sea detectable. El MIME y nombre enviados por cliente son informativos, no autoridad.
- Se rechazan ejecutables, scripts y tipos no permitidos con `VALIDATION_FAILED`, sin crear un asset listo.
- Mantener máximo de 100 MB por archivo solo si producto lo confirma; el cliente prevalida para UX y API lo aplica como límite final sobre stream.
- Registrar tipo normalizado, extensión y metadata tras validar la carga. Si la inspección falla, limpiar temporal y asset pendiente.

### 3. API y contratos REST

Los endpoints definitivos se fijan tras diseñar la UI, pero el contrato objetivo es:

| Acción                      | Endpoint                                                  | Regla                                                     |
| --------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Renombrar archivo           | `PATCH /v1/portal/files/:id` con `name`                   | Mantiene extensión; ownership y estado `ready`.           |
| Mover archivo               | `PATCH /v1/portal/files/:id` con `folderId`               | Destino nulo o carpeta del mismo workspace.               |
| Renombrar carpeta           | `PATCH /v1/portal/files/folders/:id`                      | Nombre único entre hermanos, case-insensitive.            |
| Mover carpeta               | `PATCH /v1/portal/files/folders/:id` con `parentFolderId` | Prohibir mover bajo sí misma o descendiente.              |
| Papelera de archivo/carpeta | `DELETE` respectivo                                       | Confirmación UI; bloquear referencias Publishing activas. |
| Restaurar                   | `POST .../:id/restore`                                    | Restaura en padre original o raíz si ya no existe.        |
| Purgar                      | `DELETE .../:id/purge`                                    | Solo tras retención y sin referencias activas.            |
| Descargar                   | `GET /:id/download`                                       | Attachment autenticado.                                   |
| Preview                     | `GET /:id/preview`                                        | Inline autenticado; soporta Range para audio/vídeo.       |
| Estado de derivados         | Incluido en listado/detalle                               | No filtrar ni inventar URLs públicas.                     |

- Listados paginados y por carpeta, con filtros de nombre, tipo, favoritos y estado. Web no carga el inventario completo para filtrar localmente.
- Los contratos Zod describen cada input y DTO; `@workspace/api-client` deriva de ellos y no contiene reglas de negocio.
- Las respuestas de error no incluyen path físico, MIME sin normalizar, stack trace ni información de otro workspace.

### 4. Worker y filesystem local

- API solo valida, persiste el asset y encola los derivados. No ejecuta generación de miniaturas o lectura costosa de media dentro del request de subida.
- Worker lee el binario desde el mismo volumen local, extrae metadata y genera derivados en un namespace interno separado del original.
- Imagen: dimensiones y miniatura WebP/AVIF con tamaño acotado.
- Vídeo: duración, dimensiones y frame de portada; si la herramienta de media no está disponible, estado `failed` normalizado y fallback de icono.
- Audio: duración y fallback visual; no necesita waveform en la primera entrega.
- PDF/documentos/hojas/archivos: icono de tipo como fallback; no se implementan conversiones de Office ni OCR en esta fase.
- Jobs idempotentes por `asset_id + versión de derivado`; reintentos limitados, estado durable y logs sin rutas sensibles.
- La purga manual `DELETE .../purge` elimina original y derivado sólo para elementos ya enviados a papelera. La retención automática y el job auditable de purga siguen como mejora posterior.

### 5. Portal y UX

La implementación visual se hace primero en `diseño ideal` y se copia literalmente a `apps/web/features/files`.

- Menú contextual de archivo: descargar, renombrar, mover, enviar a papelera. Favorito permanece únicamente en la estrella de la tarjeta.
- Menú contextual de carpeta: abrir, renombrar, mover, enviar a papelera.
- Diálogo de renombre: texto actual preseleccionado, error inline y extensión bloqueada/visible en archivos.
- Diálogo “Mover a carpeta”: árbol navegable con breadcrumb, opción raíz, carpeta actual marcada y descendientes inválidos deshabilitados.
- Papelera: confirmación contextual, feedback con toast y ruta/tabla de restauración; no usar toast como único mensaje cuando una acción esté bloqueada por Publishing.
- Preview en Dialog/Sheet canónico: imagen con `img`, vídeo con controles nativos, audio con controles nativos y PDF inline. Tipos sin preview muestran metadata y descarga.
- Las tarjetas muestran miniatura si `thumbnail_status=ready`; durante `pending` conservan placeholder del diseño canónico; ante `failed` muestran icono de tipo.
- El grid y lista conservan loading, vacío inicial, vacío filtrado, error, permisos, responsive, foco y teclado.

### 6. Integración con Publishing

- El selector de media no muestra `trashed`, `pending` ni archivos fuera del workspace.
- Publicar o programar conserva una referencia durable al asset, no una URL local.
- Antes de enviar a papelera, API consulta referencias activas de Publishing y devuelve un error de dominio explicable al usuario.
- La restauración deja el archivo disponible otra vez sin cambiar IDs ni romper publicaciones existentes.

## Orden de implementación

1. Diseñar en `diseño ideal` los menús, renombre, mover, papelera y preview; aprobar estados visuales y responsive.
2. Copiar literalmente la superficie aprobada a V2, inicialmente con adapters/fixtures coherentes.
3. Actualizar plan, contratos Zod y cliente REST.
4. Crear migraciones aditivas y aplicar solamente con autorización explícita.
5. Implementar API: ownership, validación de tipos, renombre, movimiento seguro, papelera/restauración y preview autenticado.
6. Implementar referencias de Publishing y reglas de bloqueo de borrado.
7. Implementar Worker de metadata, thumbnails y purga.
8. Conectar Portal REST real, eliminar todos los fallbacks mock de Files y validar estados de error.
9. Ejecutar typecheck, tests focales de API/Worker, build Web, `git diff --check`, revisión de migración y smoke visual autenticado.

## Fuera de alcance de este cierre

- Enlaces públicos, compartición externa, búsquedas online, Drive/Dropbox/OneDrive, S3/MinIO, antivirus, OCR, edición de imágenes, edición de vídeo, transcodificación y conversión de Office.
- Migración de archivos históricos desde Laravel.
- Cuotas por plan, salvo que producto lo solicite en un plan separado.

## Criterios de aceptación

- Un usuario nunca puede inferir, previsualizar, descargar ni mutar un asset de otro workspace.
- Un archivo no permitido se rechaza por API aunque el navegador altere nombre o MIME.
- La subida no bufferiza el archivo entero en Web ni API.
- Mover un archivo o carpeta no permite cruces de workspace ni ciclos.
- Enviar a papelera no rompe publicaciones activas; restaurar recupera la ubicación cuando sea posible.
- Preview y descarga son autenticados, no URLs estáticas del volumen.
- Las miniaturas no bloquean la subida ni hacen que un archivo listo desaparezca si fallan.
- La UI Portal es copia literal de la superficie aprobada en `diseño ideal`; solo datos, texto y handlers difieren.
