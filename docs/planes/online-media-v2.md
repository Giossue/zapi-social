# Online Media V2

## Estado

El backend de búsqueda e importación desde Unsplash/Pexels está implementado. La superficie Web todavía debe conectar `onlineMediaApi` y presentar atribución/enlaces del proveedor.

## REST

Base: `/v1/portal/online-media`, con sesión Portal.

| Método y ruta                                   | Responsabilidad                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `GET /search?q=&provider=&type=&page=&perPage=` | Buscar imágenes/vídeos en proveedores configurados.                   |
| `POST /imports`                                 | Descargar el resultado seleccionado y convertirlo en un `file_asset`. |

`provider=auto` consulta todos los proveedores configurados. Unsplash sólo aporta imágenes; Pexels aporta imágenes y vídeos. Importar requiere `owner` o `admin` y una carpeta activa opcional del mismo workspace.

## Seguridad de importación

- Sólo HTTPS y hosts de media declarados por proveedor (`images.unsplash.com`, `images.pexels.com`, `videos.pexels.com`).
- Máximo tres redirecciones y cada destino se vuelve a validar; no se aceptan URLs arbitrarias entregadas por el cliente.
- Timeout de búsqueda 12 segundos y de descarga 30 segundos.
- Streaming a archivo temporal con límite de 25 MB, comprobación de `Content-Type` y validación de firma real del binario.
- Escritura atómica, limpieza del temporal/original ante error y path resuelto dentro de `FILES_STORAGE_PATH`.
- El archivo guarda proveedor, ID, URL de origen y autor en `file_assets.metadata`; una auditoría `online_media.imported` registra la operación.

## Integración con Files y despliegue

- La importación devuelve `fileAssetId`, marca el archivo `ready` y encola `generate-thumbnail` en `file-derivatives` con job estable `thumbnail-<assetId>`.
- API y Worker deben montar el mismo volumen en la misma ruta `FILES_STORAGE_PATH`.
- API: `UNSPLASH_ACCESS_KEY` y/o `PEXELS_API_KEY`. Si ninguno está configurado, búsqueda responde con error público de proveedor no configurado.
- Nunca enviar estas claves al navegador ni versionarlas.

## Evidencia y pendientes

- [x] Contratos, API, cliente y metadata Drizzle incluidos en `0020_mushy_peter_parker`.
- [x] Migración local aplicada; existe `file_assets.metadata` y pasan typechecks de Database, Contracts, API Client y API.
- [ ] Conectar Web a `onlineMediaApi`, mostrar atribución y retirar fixtures.
- [ ] Añadir pruebas de proveedor simulado para redirecciones, límite, firma MIME y limpieza ante fallo.
- [ ] Definir idempotencia/deduplicación si el mismo resultado se importa más de una vez.
