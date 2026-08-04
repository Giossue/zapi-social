# Files V2

## Estado

REST y UI operativa implementados. La migración aditiva está aplicada; queda el smoke visual autenticado y montar el volumen de producción.

## Referencias auditadas

- Laravel solo aporta primitives de media, upload y storage; no contiene un módulo File Manager portal equivalente completo.
- Fuente visual canónica: `diseño ideal/src/app/(main)/dashboard/file-manager/` (`page`, toolbar, folders, grid, list y acciones).
- Decisión de producto: los binarios se guardan en el filesystem local y persistente del servidor de API; no se conecta MinIO, S3 ni otro proveedor externo.

## Alcance V2 confirmado

- Inventario aislado por workspace: carpetas jerárquicas y archivos con búsqueda, filtro, orden, vista grid/lista, favorito, creación/renombre de carpeta y papelera lógica. La navegación muestra breadcrumb y, dentro de una carpeta, únicamente sus subcarpetas directas.
- API autenticada bajo `/v1/portal/files`; el servidor recibe y sirve archivos desde su volumen local, persiste metadatos y registra auditoría.
- El frontend no recibe secretos ni accede a storage o PostgreSQL; consume `@workspace/api-client`.
- Cualquier miembro activo puede consultar; solo owner o `admin` de workspace puede crear, renombrar, subir o enviar a papelera. Los archivos son propiedad de su workspace, no de la cuenta individual.

## Fuera de alcance

- Compartición externa, enlaces públicos, antivirus, procesamiento de previews, cuotas, OCR y búsqueda online real.
- Migración de datos Laravel, archivos productivos o configuración de credenciales.
- Worker: el upload binario usa URL firmada; no hay trabajo lento en esta primera entrega.

## Modelo y contrato

- `file_folders`: `workspace_id`, `parent_folder_id` opcional con FK local, `name`, `created_by_user_id`, timestamps; las carpetas existentes sin padre son raíz.
- `file_assets`: `workspace_id`, `folder_id` opcional, propietario, `storage_key`, nombre, MIME, tamaño, estado (`pending|ready|trashed`), favorito, timestamps y `trashed_at`.
- Flujo: crear asset pendiente + upload binario `application/octet-stream` por stream → API guarda en su volumen local y confirma `ready`; si falla, elimina el temporal y el asset pendiente. La eliminación es papelera lógica y no borra objetos de forma inmediata.
- Endpoints implementados: listar, crear/renombrar carpeta, iniciar upload, subir binario, cambiar favorito/mover, mover a papelera y descargar autenticado.

## Orden y evidencia

`referencia auditada → plan → UI literal conectada a fixture → contratos Zod → schema/migración → Nest/S3 → api-client → Web REST → validación`.

Infraestructura de producción: el servicio API debe usar un volumen persistente y privado montado en `/var/lib/zapi/files`, con `FILES_STORAGE_PATH=/var/lib/zapi/files`, y verificar sus backups. La API debe publicarse como `https://api.zapisocial.com`; Web usa `NEXT_PUBLIC_API_ORIGIN=https://api.zapisocial.com` para evitar el proxy de Next en uploads. Para compartir la sesión, API usa `COOKIE_DOMAIN=.zapisocial.com` y `COOKIE_SECURE=true`; se requiere iniciar sesión nuevamente al activar esa variable. El proxy de Web sigue como fallback local y tiene 100 MB, pero no es la ruta de producción para archivos. La migración aditiva `0010_mighty_sprite.sql` se aplicó correctamente a PostgreSQL remoto el 2026-08-03.

## Evidencia de cierre

- `file_folders` y `file_assets` se crearon en PostgreSQL remoto mediante `0010_mighty_sprite.sql`; se verificaron ambas tablas y sus índices.
- Nest expone el inventario, carpetas, subida binaria local, actualización, papelera y descarga autenticada bajo `/v1/portal/files`; aplica ownership de workspace y sólo permite mutaciones a roles `owner`/`admin`.
- `/portal/files` consume `filesApi`, carga inventario real, crea carpetas y sube archivos directamente al endpoint autenticado; ya no utiliza el repositorio mock.
- Validación correcta: `bun --cwd apps/api typecheck`, `bun --cwd packages/contracts typecheck`, `bun --cwd apps/web typecheck`, `bun --cwd apps/web build` y `git diff --check`.
