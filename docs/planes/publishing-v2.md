# Publishing V2

## Estado

El flujo operativo de borradores, publicación inmediata, programación, media, reintentos y entrega por Worker está implementado. Calendario, cola y borradores de Web ya consumen REST; falta un smoke autenticado con credenciales reales de cada proveedor.

Adapters actuales: Facebook Page, Instagram Profile y WhatsApp Status. Aprobaciones, campañas, labels, cuotas y permisos granulares por cuenta siguen pendientes.

## Decisión de dominio

Publishing es la fuente única de publicaciones. Una selección de varias cuentas crea un `publishing_post` por destino. Bulk Posts, RSS, AI y Automation producen posts hacia este dominio y conservan su referencia de origen; no publican directamente en un request HTTP.

Estados actuales: `draft`, `scheduled`, `processing`, `published` y `failed`.

## REST Portal

Base: `/v1/portal/publishing`, con sesión Portal y scope de workspace.

| Método y ruta     | Responsabilidad                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| `GET /`           | Cargar cuentas publicables y posts/media acotados por rango, página y límite. |
| `POST /`          | Crear borradores, programaciones o entregas inmediatas con `idempotencyKey`.  |
| `PATCH /:id`      | Editar un post `draft`, `scheduled` o `failed`.                               |
| `DELETE /:id`     | Eliminar únicamente un borrador.                                              |
| `POST /:id/retry` | Reencolar un fallo recuperable.                                               |

Sólo `owner` y `admin` mutan. La API verifica que cuentas estén activas/no desconectadas, tengan capability soportada y que cada archivo sea imagen/vídeo `ready` del mismo workspace. Instagram y WhatsApp exigen media.

### Media pública temporal

`GET /v1/public/publishing-media/:id?expires=&signature=&variant=` sirve a Instagram el original o una variante temporal con watermark. La firma HMAC-SHA256 incluye asset, variante y expiración; se compara en tiempo constante, vence en un máximo de 20 minutos y la variante sólo existe para un post `processing` relacionado con ese asset.

## Persistencia

- `publishing_posts`: workspace, autor, cuenta destino, contenido, estado, fecha, origen, referencia externa, opciones, resultado, fallo y timestamps.
- `publishing_post_media`: assets ordenados y protegidos contra eliminación mientras el post exista.
- `publishing_post_attempts`: intento durable, job, estado, ID del proveedor, resultado seguro, error y tiempos.
- `publishing_watermarks`: regla global o específica por cuenta; texto o imagen, posición, tamaño y opacidad.
- `api_audit_logs` y `worker_audit_logs`: creación/edición/borrado/reintento y resultado de entrega.

La migración `0020_mushy_peter_parker` añade intentos, procedencia/resultados del post e índices de idempotencia. `0021_pale_thor` añade FKs compuestas para obligar que cuenta, post y media pertenezcan al mismo workspace. Las tablas base de posts, media y watermarks provienen de migraciones anteriores.

## Worker, reintentos e idempotencia

- Cola `publishing-delivery`, concurrencia tres.
- Un dispatcher global revisa cada 30 segundos posts `scheduled` vencidos y recupera posts `processing` después de un reinicio.
- Job estable `publishing-<postId>-<updatedAt>`; tres intentos con backoff exponencial de 10 segundos.
- El claim bloquea el post, cambia `scheduled` a `processing` condicionalmente y crea/reutiliza `publishing_post_attempts` por `jobId` único.
- Un intento ya `succeeded` no se entrega de nuevo. Errores permanentes terminan inmediatamente; los transitorios reintentan y sólo el último marca el post `failed`.
- Éxito y fallo definitivo persisten `post.published`/`post.failed` para Automation dentro de la misma transacción de negocio; auditoría posterior nunca convierte una publicación confirmada en fallo.
- Una respuesta remota ambigua queda como `PUBLISHING_PROVIDER_OUTCOME_UNKNOWN` y no habilita reintento automático ni manual: exige conciliación con el proveedor para evitar duplicados.

## Adapters

### Facebook Page e Instagram

- Meta Graph API `v22.0` con credenciales de cuenta descifradas sólo en Worker.
- Facebook soporta texto, una imagen/vídeo o carrusel de imágenes.
- Instagram crea contenedor, espera `FINISHED` y luego publica; obtiene la media mediante URL firmada temporal de la API.
- HTTP 4xx, salvo 408/429, se considera permanente; timeouts/5xx son reintentables.

### WhatsApp Status

- Usa la integración `whatsapp-status` configurada con endpoint GOWA, basic auth y `deviceId` de la cuenta.
- La configuración cifrada nunca se devuelve a Web ni se persiste dentro del resultado del post.

## Watermarks y almacenamiento

- Antes de enviar, el Worker elige primero una regla específica de la cuenta y después la global.
- Imágenes se transforman con `sharp`; vídeos con `ffprobe` + `ffmpeg`.
- La transformación usa un archivo efímero `<storageKey>.publish-<postId>` y nunca modifica el original. El archivo se limpia tras éxito o fallo.
- API y Worker deben montar el mismo volumen en la misma ruta `FILES_STORAGE_PATH`; el entrypoint compartido corrige la propiedad inicial del volumen y ejecuta ambos servicios como `bun`, porque watermarks y derivados requieren escritura además de lectura.
- Worker requiere `ffmpeg` y `ffprobe`. Instagram requiere `API_PUBLIC_ORIGIN` accesible por Meta.
- API y Worker comparten `PROVIDER_INTEGRATIONS_ENCRYPTION_KEY`; no cambiarla sin rotar/re-encriptar credenciales existentes.

## Productores conectados

- Portal Publishing: `source=portal`.
- Bulk Posts: relación durable fila/cuenta/post y evento `post.created`.
- RSS: genera primero borradores para revisión del usuario.
- AI y AI Publishing: resultados y programaciones generan borradores editables.
- Automation: `externalReference` evita duplicar un post por cuenta.

## Web

- `/portal/publishing` conserva Calendario como vista principal y ofrece accesos a `/portal/publishing/activity` y `/portal/publishing/bulk-posts`. Actividad reúne cola y borradores en una tabla filtrable sin métricas; Calendario y Actividad consumen `publishingApi` y el lote conserva `bulkPostsApi`.
- Calendario fuente-canónica usa FullCalendar con vistas mes/semana/día y compositor contextual.
- API conserva instantes en UTC y convierte `date`, `time` y `focusDate` a la zona IANA del usuario autenticado antes de responder. Una publicación completada muestra `publishedAt`; las pendientes conservan su fecha programada y los borradores su creación. Web trata `date` como fecha de calendario estable; los logs operativos permanecen en UTC.
- Las mutaciones confirman con toast y preservan estados loading/empty/error.
- El compositor usa `noValidate`, marca campos obligatorios, bloquea el submit incompleto y muestra `Spinner` durante la mutación; eliminar un borrador exige confirmación con `AlertDialog`.
- El compositor usa el espacio de escritorio como editor: cuentas arriba, bloque de texto principal, cinta de herramientas y programación debajo. La cinta sólo expone capacidades reales y abre diálogos, sin expandir paneles dentro del editor: Media abre el selector existente de Files/Google Drive; Captions carga los captions activos del workspace y añade el elegido al texto; Notas internas abre su diálogo de notas reutilizables. Emoji, ubicación, enlaces y otros controles de referencias externas no se simulan porque Publishing todavía no los soporta.
- El selector de cuentas muestra el avatar sincronizado de cada cuenta social en el desplegable y en las cuentas ya elegidas; si el proveedor aún no dispone de imagen, conserva el fallback de iniciales. `avatarUrl` viaja en el contrato de Publishing sin duplicar ni transformar la URL almacenada por Channels.
- `publishing_notes` guarda notas internas por workspace y autor. `GET/POST/PATCH/DELETE /v1/portal/publishing/notes` las lista o gestiona con la sesión Portal; las mutaciones requieren `publishing.manage` y cada update/delete incluye el `workspaceId` en la consulta. El diálogo permite guardar una nota y reutilizarla añadiéndola al editor.
- El pie del compositor agrupa la acción elegida y un menú de alternativas reales: guardar borrador, programar o publicar ahora. Antes de habilitar esa acción muestra los errores de cuentas, texto, media obligatoria y fecha/hora inválida o pasada; la API mantiene la validación autoritativa.
- Validación del 30 de agosto de 2026: typecheck completo del monorepo, build API y Web, auditorías i18n y Portal/UI, prueba focal de horario (6 casos) y `git diff --check` correctos. La integración de Publishing detectó que no hay una base `zapi_v2_local` configurada y se omitieron sus 4 casos por su guardia de seguridad; la migración se validó con rollback y quedó aplicada en remoto. El build completo de la fuente visual continúa bloqueado por dos errores TypeScript preexistentes en `default-v1/chart-area-interactive.tsx` y `ecommerce/store-traffic.tsx`; el chequeo Biome focal del compositor sí pasa.
- Google Drive está integrado como origen de importación dentro del selector de
  media. El compositor recibe únicamente assets `ready` de Files, importa a raíz
  y selecciona automáticamente el asset final. El flujo durable y sus pendientes
  de configuración/smoke se especifican en
  [`google-drive-picker-v2.md`](./google-drive-picker-v2.md).
- `/portal/ai-publishing` ya tiene un mockup source-first con métricas, búsqueda, filtros, listado y sheet de automatización. Conserva fixtures hasta conectarse a los endpoints `aiApi.*PublishingSchedule`.
- Las métricas de AI Publishing siguen el patrón de `/admin/users`: cards `subtle` individuales con etiqueta e icono en el header, valor y contexto breve en el contenido. La tabla de automatizaciones sigue siendo la superficie principal; no cambia sus acciones mock ni el pendiente REST.

## Evidencia y pendientes

- [x] CRUD REST, cliente, Web calendar/activity y protección de Files.
- [x] Worker con scheduler, claim, intentos y adapters Facebook/Instagram/WhatsApp Status.
- [x] Watermarks efímeros de imagen/vídeo y endpoint temporal firmado.
- [x] Productores Bulk, RSS, AI y Automation conectados.
- [x] Compositor y confirmación de borrado validados con Biome + TypeScript en `template-shadcn-superdashboard` y ESLint + typecheck de Web en V2.
- [x] Mockup source-first navegable para AI Publishing, copiado desde `template-shadcn-superdashboard/src/app/(main)/dashboard/portal-modules`.
- [ ] Conectar AI Publishing a los endpoints de schedules sin cambiar la composición aprobada.
- [x] `0020_mushy_peter_parker` y `0021_pale_thor` aplicadas localmente; existen `publishing_post_attempts`, FKs compuestas y pasan typechecks de Database, Contracts, API Client, API y Worker.
- [x] Pruebas locales RSS 2/2 y Support/Watermarks 2/2; lint focalizado del código nuevo API/Worker sin errores.
- [ ] Smoke real por provider y verificación de scopes/tokens en entorno de prueba.
- [x] Google Picker conectado a Files y al compositor, con importación durable,
      polling, destino raíz y auto-selección; typecheck/build V2 aprobados.
- [x] Fechas de Publishing serializadas con la zona IANA del usuario; pruebas cubren Guayaquil, cruce de día, fallback UTC y selección de la hora real de publicación. Lint y typecheck de API/Web aprobados.
- [x] Permisos del volumen Files corregidos al arrancar API/Worker antes de bajar privilegios a `bun`; ambas imágenes construyen con Podman y el smoke con volumen nuevo confirma proceso `uid=1000`, directorio `bun:bun` y escritura efectiva.
- [ ] Aprobaciones, campañas, labels, cuotas y autorización por `managed_account_ids`.
- [ ] LinkedIn, X y TikTok sólo después de aprobar contratos y credenciales correspondientes.
