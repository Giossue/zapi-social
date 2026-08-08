# Bulk Posts V2

## Estado

El backend de lotes CSV está implementado con API, persistencia, Worker y creación durable de borradores/programaciones en Publishing. `/portal/bulk-posts` todavía cae en el placeholder genérico de rutas y debe construir su página sobre `bulkPostsApi`.

## REST

Base: `/v1/portal/bulk-posts`, con sesión Portal y scope de workspace.

| Método y ruta                   | Responsabilidad                                      |
| ------------------------------- | ---------------------------------------------------- |
| `GET /?status=&page=&limit=`    | Listar lotes paginados.                              |
| `POST /`                        | Crear y encolar un lote desde un `fileAssetId`.      |
| `GET /:id?status=&page=&limit=` | Consultar lote, filas, validaciones y posts creados. |
| `DELETE /:id`                   | Cancelar un lote `queued` o `processing`.            |

Crear/cancelar requiere rol `owner` o `admin`. El archivo debe ser CSV/TXT `ready`, del mismo workspace y de hasta 10 MB; las cuentas destino deben estar activas y pertenecer al workspace.

## Formato y procesamiento

- Máximo 5.000 filas por lote.
- Campos reconocidos: `content` o `caption`, `file_asset_ids`, `scheduled_at` y `mode` (`draft` o `scheduled`).
- `file_asset_ids` admite UUID separados por coma, punto y coma o espacios; cada archivo se revalida como `ready` y del mismo workspace.
- Sin `scheduled_at`, el Worker distribuye filas por `intervalMinutes`; los timestamps explícitos se respetan.
- Cada fila válida crea un post por cuenta destino y conserva la relación en `bulk_post_row_posts`.
- Una fila inválida registra códigos de validación y no bloquea las demás.

## Persistencia, Worker e idempotencia

- Tablas: `bulk_post_batches`, `bulk_post_batch_targets`, `bulk_post_rows` y `bulk_post_row_posts`.
- Cola `bulk-post-batches`, job estable `bulk-<batchId>`, tres intentos, backoff exponencial de 5 segundos y concurrencia uno.
- El Worker inserta filas con conflicto ignorado y verifica `(bulk_post_row_id, social_account_id)` antes de crear cada post; reintentar no duplica publicaciones.
- Estados y contadores viven en PostgreSQL. Cada post emite `post.created` para Automation.
- Files impide eliminar físicamente un CSV mientras sea `source_file_asset_id` de un lote.
- API y Worker deben compartir `FILES_STORAGE_PATH`, además de PostgreSQL y Redis.

## Evidencia y pendientes

- [x] Contratos, API, cliente, schema y Worker implementados en `0020_mushy_peter_parker`.
- [x] Migración aplicada localmente y typecheck de Database, Contracts, API Client, API y Worker.
- [ ] Sustituir el placeholder por una página conectada a `bulkPostsApi` y publicar una plantilla CSV descargable.
- [ ] Añadir prueba de integración de reintento fila/cuenta y un smoke con archivo real en el volumen compartido.
