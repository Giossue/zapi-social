# Files V2

## Estado

Inventario, carpetas jerárquicas, subida local en streaming, favorito, breadcrumb, acciones de archivo/carpeta, borrado permanente y miniaturas autenticadas están implementados. No hay papelera restaurable ni retención automática. El borrado conserva una fila tombstone cuando Publishing necesita mantener una referencia histórica.

La base local registra hasta `0015_lyrical_cargill`: `publishing_posts` y `publishing_post_media` son la referencia durable inicial para impedir enviar a papelera un archivo usado por Publishing.

No se implementa ninguna de las fases siguientes hasta aprobar explícitamente este plan.

Google Drive ya dispone de Picker oficial, importación durable mediante Worker,
destino en la carpeta abierta y reutilización desde Publishing. La configuración,
contratos, seguridad, evidencia y pendientes de smoke real se mantienen en
[`google-drive-picker-v2.md`](./google-drive-picker-v2.md).

## Fuentes de verdad

- `../ZapiV2`: destino de contrato, API, Worker, persistencia y Portal.
- `../ZapiSocial/modules/AppFiles`: referencia de lógica Laravel. Se adopta su validación de carga, ownership, preview autenticado y protección de referencias de Publishing, sin copiar su arquitectura Laravel ni proveedores externos.
- `../template-shadcn-superdashboard/src/app/(main)/dashboard/file-manager/`: fuente visual literal de Files. Grid, lista, carpetas, toolbar, tabs, diálogos, hovers, responsive y estados nuevos se crean aquí primero cuando no existan y luego se copian sin reinterpretación a V2.

## Decisiones confirmadas

- Los binarios y derivados viven en el filesystem local persistente del servicio API. No se conecta MinIO, S3 ni otro proveedor.
- Cada recurso pertenece a un workspace. Cualquier lectura, preview, descarga, mutación o derivado comprueba sesión y ownership de workspace.
- Solo `owner` y `admin` pueden subir, crear, renombrar, mover, eliminar, restaurar o purgar. Cualquier miembro activo puede listar, ver preview y descargar los recursos autorizados de su workspace.
- Ninguna URL de archivo o miniatura será pública. Todo acceso pasa por API autenticada; el volumen nunca se expone como directorio HTTP.
- Eliminar retira el recurso de la biblioteca, marca su fila como `trashed` y limpia sus binarios únicamente después de confirmar la transición en base de datos. La fila tombstone y las referencias de publicaciones ya terminadas se conservan como historial.
- Los archivos usados por publicaciones `draft`, `scheduled`, `processing` o `failed` no se pueden eliminar hasta retirar o reemplazar la media, o hasta que la publicación termine. Una referencia exclusivamente `published` no bloquea el borrado de Files.
- La selección múltiple no es una fuente de verdad de negocio. Las acciones mutan por IDs validados por API y respetan ownership para cada recurso.
- La clave de almacenamiento sigue una disposición fija por espacio, definida en `packages/file-ingestion` y compartida por API y Worker. Ninguna feature compone rutas por su cuenta.

## Estado actual comprobado

| Capacidad                    | Estado actual                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jerarquía                    | `file_folders.parent_folder_id`; root, subcarpetas y breadcrumb implementados.                                                                                                                                                                                                                                     |
| Carga                        | Crea asset `pending`, recibe binario por stream, escribe al volumen local y confirma `ready`; borra temporal y pendiente si falla. Máximo actual: 100 MB.                                                                                                                                                          |
| Validación                   | La extensión y MIME declarado sólo autorizan el inicio; tras el stream se verifica una firma/magic byte compatible antes de pasar a `ready`. Incluye imágenes, media, PDF, OLE/Office, ZIP/ODF, RTF, TAR/GZip/7z/RAR y texto estructurado.                                                                         |
| Borrado                      | `DELETE` oculta el recurso mediante `status=trashed`, conserva la fila como tombstone para historial y elimina el binario después del commit. No existe todavía papelera restaurable ni retención automática.                                                                                                      |
| Seguridad de árbol           | Un movimiento de carpeta comprueba workspace, padre activo, ciclo hacia sí misma/descendientes y nombre único entre hermanos sin distinguir mayúsculas.                                                                                                                                                            |
| Derivados                    | `GET /v1/portal/files/:id/thumbnail` sirve WebP autenticado; Web usa esa URL sólo cuando el estado es `ready`, con icono como fallback.                                                                                                                                                                            |
| Despliegue                   | `infra/podman/compose.apps.yaml` declara `files-data` en el mismo `FILES_STORAGE_PATH` para API y Worker; `Dockerfile.worker` instala `ffmpeg`. Falta verificar esta configuración en Dokploy: el 2026-08-04 producción conserva 13 assets `pending`, que no se deben forzar a `ready` sin comprobar sus binarios. |
| Favorito                     | `file_assets.starred`, expuesto y conectado a Portal.                                                                                                                                                                                                                                                              |
| Movimiento                   | `PATCH /v1/portal/files/:id` ya permite cambiar `folderId`; falta UI y validación de destino más completa.                                                                                                                                                                                                         |
| Renombre                     | API de carpetas existe; no hay renombre de archivo ni UI.                                                                                                                                                                                                                                                          |
| Descarga                     | Endpoint autenticado implementado.                                                                                                                                                                                                                                                                                 |
| Preview, player y miniaturas | No implementados. El grid usa iconos de tipo.                                                                                                                                                                                                                                                                      |
| Tipos permitidos             | No hay allowlist server-side; no se debe confiar en MIME declarado por navegador.                                                                                                                                                                                                                                  |

## Alcance de cierre

### 1. Modelo, migraciones y datos

- Extender `file_assets` con metadata derivada: `extension`, `width`, `height`, `duration_seconds`, `thumbnail_key`, `thumbnail_status` (`pending|ready|failed`) y `thumbnail_error_code` opcional normalizado.
- Crear una entidad durable de papelera o ampliar `file_assets` con `purge_after` y `deleted_by_user_id`. La decisión de schema se toma al diseñar la restauración de carpetas: una carpeta eliminada debe restaurar su árbol sin perder los padres originales.
- Definir una referencia durable entre Publishing y Files antes de bloquear borrado: tabla de adjuntos/referencias o consulta canónica sobre las entidades de Publishing, nunca inspección informal de JSON desde Web.
- Añadir índices por `workspace_id + status + folder_id`, por assets pendientes de derivados y por retención de papelera.
- Todas las migraciones serán aditivas y se verifican localmente antes de aplicarlas a PostgreSQL remoto. La aplicación local/remota sigue exclusivamente la autorización y las comprobaciones de `docs/reglas/workflow.md`.

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
- Las mutaciones sin cuerpo (eliminar, restaurar y purgar) declaran `Content-Type: application/json`; Fastify las acepta antes de aplicar autorización y ownership.
- Las respuestas de error no incluyen path físico, MIME sin normalizar, stack trace ni información de otro workspace.

### 4. Worker y filesystem local

- API solo valida, persiste el asset y encola los derivados. No ejecuta generación de miniaturas o lectura costosa de media dentro del request de subida.
- Worker lee el binario desde el mismo volumen local, extrae metadata y genera derivados en un namespace interno separado del original.
- Al arrancar, Worker reencola de forma idempotente hasta 100 imágenes o vídeos `ready` sin derivado; el job conserva el ID determinista `thumbnail-<asset_id>`. Si Redis no acepta un job durante upload, el original listo se conserva y se reintenta en ese backfill.
- Imagen: dimensiones y miniatura WebP/AVIF con tamaño acotado.
- Vídeo: duración, dimensiones y frame de portada WebP; el temporal conserva extensión `.webp` para que `ffmpeg` infiera correctamente el formato. Si la herramienta de media no está disponible, estado `failed` normalizado y fallback de icono.
- Audio: duración y fallback visual; no necesita waveform en la primera entrega.
- PDF/documentos/hojas/archivos: icono de tipo como fallback; no se implementan conversiones de Office ni OCR en esta fase.
- Jobs idempotentes por `asset_id + versión de derivado`; reintentos limitados, estado durable y logs sin rutas sensibles.
- La purga manual `DELETE .../purge` elimina original y derivado sólo para elementos ya enviados a papelera. La retención automática y el job auditable de purga siguen como mejora posterior.

### 5. Portal y UX

La implementación visual se hace primero en `template-shadcn-superdashboard` y se copia literalmente a `apps/web/features/files`.

- Menú contextual de archivo: vista previa, información, descargar, renombrar, mover y enviar a papelera. Favorito permanece únicamente en la estrella de la tarjeta.
- Información abre un diálogo de solo lectura con nombre, tipo, MIME, tamaño, fecha de actualización y propietario, sin exponer IDs ni rutas internas.
- La tarjeta de carpeta abre su contenido con clic o teclado y da feedback al pasar el cursor; su menú contextual solo contiene renombrar, mover y enviar a papelera.
- La selección múltiple permite mover todos los archivos elegidos a una carpeta o a raíz, además de enviarlos a papelera; cada ID sigue validándose por API.
- Diálogo de renombre: texto actual preseleccionado, error inline y extensión bloqueada/visible en archivos.
- Diálogo “Mover a carpeta”: árbol navegable con breadcrumb, opción raíz, carpeta actual marcada y descendientes inválidos deshabilitados.
- Papelera: confirmación contextual, feedback con toast y ruta/tabla de restauración; no usar toast como único mensaje cuando una acción esté bloqueada por Publishing.
- Preview en Dialog/Sheet canónico: imagen con `img`, vídeo con controles nativos, audio con controles nativos y PDF inline. Tipos sin preview muestran metadata y descarga.
- Las tarjetas y la lista muestran miniatura WebP si `thumbnail_status=ready`; imágenes y vídeos se encajan sin recorte dentro de su contenedor. Mientras está pendiente, falta en un asset histórico o falla, las imágenes usan el preview autenticado original y los vídeos el icono de tipo. Solo muestran el icono de tipo si ese preview también falla.
- Las tarjetas muestran los metadatos de tipo y tamaño debajo de la línea de actualización y propietario, no superpuestos sobre la miniatura; sus casillas de selección mantienen contraste sobre cualquier contenido visual.
- El grid y lista conservan loading, vacío inicial, vacío filtrado, error, permisos, responsive, foco y teclado.

### 6. Integración con Publishing

- El selector de media no muestra `trashed`, `pending` ni archivos fuera del workspace.
- Google Drive importa primero a `file_assets`: Files usa la carpeta abierta y
  Publishing usa raíz. Ningún post conserva URLs ni tokens de Google.
- Publicar o programar conserva una referencia durable al asset, no una URL local.
- Antes de enviar a papelera, API consulta referencias activas de Publishing y devuelve un error de dominio explicable al usuario.
- La restauración deja el archivo disponible otra vez sin cambiar IDs ni romper publicaciones existentes.

### 7. Ciclo de vida Files ↔ Publishing — 24 de agosto de 2026

`publishing_post_media` es la fuente durable de dependencia. El estado del post decide si la referencia sigue necesitando el binario; la mera existencia de una referencia histórica no basta para bloquear el borrado.

| Estado de Publishing | ¿Permite borrar en Files? | Motivo                                                                                                   |
| -------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `draft`              | No                        | El usuario aún puede publicar o programar el borrador.                                                   |
| `scheduled`          | No                        | Worker necesitará el binario en la fecha programada.                                                     |
| `processing`         | No                        | El proveedor o Worker puede estar leyendo o subiendo la media.                                           |
| `failed`             | No                        | El post puede editarse o reintentarse; también cubre resultados desconocidos que requieren conciliación. |
| `published`          | Sí                        | El envío terminó. Se conserva la relación y la fila tombstone para historial, no el binario local.       |

Invariantes de implementación:

- El borrado de un archivo o árbol de carpetas es todo-o-nada: si un descendiente tiene una referencia bloqueante, no se modifica ninguno.
- La comprobación de dependencias y la transición `ready → trashed` ocurren en una misma transacción y con bloqueo de las filas de assets.
- Crear o cambiar media de una publicación vuelve a validar y bloquea esos mismos assets dentro de su transacción. Así, borrar y programar concurrentemente se serializan: solo una operación puede ganar y nunca queda un post activo apuntando a un asset `trashed`.
- El filesystem nunca se modifica antes del commit. Original, miniatura y derivados se eliminan después; si esa limpieza falla, se registra un fallo normalizado para reconciliación sin devolver el asset a la biblioteca ni exponer rutas físicas.
- La relación de un post `published` no se elimina. Las métricas e historial pueden seguir afirmando que la publicación tuvo media aunque el archivo ya no sea descargable desde Files.
- Watermarks y lotes masivos mantienen sus bloqueos actuales hasta que cada vertical defina de forma explícita cuándo deja de requerir el binario.
- API devuelve `FILE_IN_USE_BY_PUBLISHING` solo por dependencias bloqueantes. Portal mantiene abierto el diálogo de confirmación y sustituye su contenido por una explicación accionable; un toast no es el único feedback.

Casos de prueba obligatorios:

1. Sin referencias: borra, desaparece de la biblioteca y limpia binarios después del commit.
2. `draft`, `scheduled`, `processing` o `failed`: responde conflicto y conserva fila y binarios.
3. Solo `published`: permite borrar, conserva tombstone y relación histórica, y limpia binarios.
4. Referencias mixtas `published + scheduled`: bloquea.
5. Carpeta con un descendiente bloqueado: no borra parcialmente el árbol.
6. Carrera borrar/programar: nunca confirma ambas operaciones dejando una dependencia activa sobre un asset `trashed`.
7. Fallo de limpieza física: la respuesta no filtra paths y el estado lógico permanece coherente.

Evidencia de cierre:

- `apps/api/src/files/files-publishing-lifecycle.integration.spec.ts`: 9/9 casos en PostgreSQL local, incluidos los cuatro estados bloqueantes, asset libre, historial `published`, fallo de limpieza física, atomicidad de carpeta y carrera borrar/programar.
- API: `typecheck`, `lint`, `build` y suite completa con 95/95 pruebas ejecutadas.
- Web: `typecheck`, `lint` y build de producción con 90 rutas.
- i18n: 4485 claves sincronizadas en español e inglés, sin texto de interfaz hardcodeado; declaración tipada regenerada.

## Orden de implementación

1. Diseñar en `template-shadcn-superdashboard` los menús, renombre, mover, papelera y preview; aprobar estados visuales y responsive.
2. Copiar literalmente la superficie aprobada a V2, inicialmente con adapters/fixtures coherentes.
3. Actualizar plan, contratos Zod y cliente REST.
4. Crear migraciones aditivas y aplicarlas en local/remoto siguiendo `docs/reglas/workflow.md`.
5. Implementar API: ownership, validación de tipos, renombre, movimiento seguro, papelera/restauración y preview autenticado.
6. Implementar referencias de Publishing y reglas de bloqueo de borrado.
7. Implementar Worker de metadata, thumbnails y purga.
8. Conectar Portal REST real, eliminar todos los fallbacks mock de Files y validar estados de error.
9. Ejecutar typecheck, tests focales de API/Worker, build Web, `git diff --check`, revisión de migración y smoke visual autenticado.

## Fuera de alcance de este cierre

- Enlaces públicos, compartición externa, búsquedas online, Dropbox/OneDrive,
  S3/MinIO, antivirus, OCR, edición de imágenes, edición de vídeo,
  transcodificación y conversión de Office. Google Drive tiene un plan separado
  y no forma parte del cierre base de Files.
- Migración de archivos históricos desde Laravel.
- Cuotas por plan, salvo que producto lo solicite en un plan separado.

## Criterios de aceptación

- Un usuario nunca puede inferir, previsualizar, descargar ni mutar un asset de otro workspace.
- Un archivo no permitido se rechaza por API aunque el navegador altere nombre o MIME.
- La subida no bufferiza el archivo entero en Web ni API.
- Mover un archivo o carpeta no permite cruces de workspace ni ciclos.
- Enviar a papelera no rompe publicaciones activas; restaurar recupera la ubicación cuando sea posible.
- Preview y descarga son autenticados, no URLs estáticas del volumen. Preview y miniatura declaran caché privada de 24 horas para evitar repetir la descarga al volver a la biblioteca.
- Las miniaturas no bloquean la subida ni hacen que un archivo listo desaparezca si fallan.
- La UI Portal es copia literal de la superficie aprobada en `template-shadcn-superdashboard`; solo datos, texto y handlers difieren.

## Disposición del almacenamiento — 22 de agosto de 2026

```text
$FILES_STORAGE_PATH/
├── ws/<shard>/<workspaceId>/
│   ├── orig/<yyyy>/<mm>/<assetId>[.ext]
│   └── drv/<assetId>/{thumb.webp, publish-<postId>[.ext]}
├── avatars/users/<userId>/<version8>.<ext>
└── tmp/<uploadId>
```

El árbol `avatars/` no pertenece a Files: es la foto de perfil por usuario
(29 de agosto de 2026), sin fila en `file_assets` y sin contar en la cuota del
plan. Su diseño y endpoints viven en
[`perfil-basico-v2.md`](./perfil-basico-v2.md).

Sustituye a la disposición plana anterior (`<workspaceId>/<uuid>` con derivados
como hermanos por sufijo). Cada nivel resuelve un límite concreto:

- **`ws/<shard>/`** — los dos primeros caracteres del identificador del espacio
  acotan la raíz a 256 entradas. Sin shard, la raíz crecía una carpeta por
  cliente.
- **`<workspaceId>/`** — sigue siendo la unidad de borrado, cuota y copia: dar
  de baja una cuenta es retirar una carpeta, y medir su consumo es un `du`.
- **`orig/` frente a `drv/`** — el original es irreemplazable y el derivado se
  regenera. Separarlos permite excluir derivados de la copia de seguridad,
  borrarlos en bloque y reconstruirlos. El plan ya exigía ese namespace
  separado; la implementación anterior no lo cumplía.
- **`<yyyy>/<mm>/`** — acota el crecimiento dentro de un espacio activo y abre
  la puerta a retención y copias incrementales por periodo.
- **`drv/<assetId>/`** — todos los derivados de un archivo en una carpeta: al
  eliminarlo se retira entera, sin rastrear sufijos.
- **`tmp/`** — una subida interrumpida ya no deja restos dentro de la carpeta
  del cliente. Vive en el mismo volumen, así que el `rename` final sigue siendo
  atómico.

Decisiones asociadas:

- **La cuenta social no entra en la ruta.** Un archivo pertenece al espacio y
  puede publicarse en varias cuentas; colgarlo de una obligaría a duplicarlo.
- **Las claves anteriores siguen siendo válidas.** La ruta sale siempre de
  `file_assets.storage_key`, nunca se recalcula, así que los archivos ya
  guardados se resuelven sin migración. Solo cambió el generador.
- La clave es también válida como key de almacenamiento de objetos, de modo que
  un traslado futuro a S3/R2 sería una copia y no un rediseño.

### Evidencia — 22 de agosto de 2026

- Cinco generadores actualizados: subida de Files, importación online, variante
  de Publishing, importación de Google Drive y media generada por IA.
- `apps/api/src/files/file-storage-layout.spec.ts`: 7 pruebas sobre shard,
  partición por fecha, agrupación de derivados, aislamiento de temporales y
  nombres hostiles.
- `tsc --noEmit` en `file-ingestion`, `apps/api` y `apps/worker`;
  `bun run build` 6/6; suites de API 12/12 y de Worker 31/31.
- Producción conserva dos assets con clave antigua; se resuelven con normalidad
  y no requieren traslado. El volumen vive en el servidor de Dokploy, fuera del
  alcance de este cambio.
