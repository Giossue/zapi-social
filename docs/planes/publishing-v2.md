# Plan — Publishing V2

## Estado

**Investigación Laravel completada; UI mock implementada. Permisos de Teams y contrato/backend pendientes.**

No implementar persistencia, adapters de providers ni workers hasta aprobar el MVP, permisos y transición de estados descritos aquí.

## Objetivo

Construir el dominio que crea, valida, agenda, aprueba y entrega publicaciones por canal y workspace. `Publishing` es la fuente única de posts: Captions, AI, Bulk Posts y RSS producen solicitudes tipadas hacia Publishing; no crean filas de publicación por su cuenta.

## Referencia Laravel auditada

### Superficie principal

| Superficie              | Ruta Laravel                   | Referencia                                              |
| ----------------------- | ------------------------------ | ------------------------------------------------------- |
| Calendario y compositor | `/portal/publishing`           | `modules/AppPublishing/Livewire/PublishingCalendar.php` |
| Borradores              | `/portal/publishing/drafts`    | `PublishingDrafts.php`                                  |
| Cola                    | `/portal/publishing/queue`     | `PublishingQueue.php`                                   |
| Aprobaciones            | `/portal/publishing/approvals` | `PublishingApprovals.php`                               |
| Campañas                | `/portal/publishing/campaigns` | `PublishingCampaigns.php`                               |
| Etiquetas               | `/portal/publishing/labels`    | `PublishingLabels.php`                                  |

Laravel soporta crear, editar, duplicar, borrar y programar posts; selección de una o varias cuentas; repetición; borradores; aprobaciones; campañas/labels; medios; captions; watermark; validación por provider; y publicación inmediata o programada.

### Dependencias de origen

| Origen        | Referencia Laravel | Equivalencia V2 propuesta                                            |
| ------------- | ------------------ | -------------------------------------------------------------------- |
| Caption       | `AppCaptions`      | inserta una copia de texto en el compositor; sin FK viva al caption. |
| AI Publishing | `AppAiPublishing`  | productor posterior de solicitudes tipadas.                          |
| CSV / Bulk    | `AppBulkPosts`     | productor posterior mediante lote/filas tipados.                     |
| RSS           | `AppRssSchedules`  | productor posterior con historial idempotente por item/cuenta.       |
| Archivo/media | `AppFiles`         | media perteneciente al workspace, resuelta y autorizada por ID.      |
| Watermark     | `AppWatermark`     | transformación efímera por adapter, nunca sobre el original.         |
| Canales       | `AppChannels`      | solo cuentas activas, accesibles y con capability publicable.        |

## Hallazgos Laravel que V2 no debe replicar

1. El scheduler y los componentes ejecutan publicación, AI, RSS y Bulk de forma síncrona aunque las clases declaran cola. Esto bloquea requests/cron y hace inefectivos los reintentos.
2. El job de publicación cambia `scheduled` a `processing` antes de capturar una excepción; los intentos posteriores ignoran el post porque ya no está `scheduled`.
3. Límites de plan como posts mensuales y tamaño de lote se muestran/configuran, pero no se fuerzan de manera uniforme al crear o ejecutar.
4. Los distintos productores escriben formas incompatibles en la tabla legacy `posts` (`custom_data_*`, `method`, `query_id` y JSON libres).
5. El job remoto no revalida por completo estado activo de canal, permisos, límite ni ownership de la cuenta al momento de entrega.
6. Laravel permite resolver media por ID sin scope de workspace en la capa de publicación. El acceso a media debe verificarse tanto al crear como al ejecutar.
7. Respuestas crudas de provider se persisten; en X se puede incluir refresh token dentro del resultado. V2 nunca persiste ni devuelve tokens, payloads OAuth completos, QR ni respuestas remotas sin redacción.
8. RSS y descargas remotas necesitan una política común contra SSRF, redirecciones inseguras, MIME incorrecto y archivos excesivos.

## Decisiones propuestas para V2

### Modelo de publicación

```text
publishing_posts
  id
  workspace_id
  author_user_id
  source_type            manual | ai_run | bulk_batch | rss_schedule
  source_id nullable
  source_item_id nullable
  social_account_id
  status                 draft | pending_approval | scheduled | processing | published | failed | cancelled
  scheduled_at UTC nullable
  content
  provider_options jsonb
  result_safe jsonb
  idempotency_key
  published_at / failed_at / timestamps

publishing_post_media
  publishing_post_id
  file_id
  position
  transform_options jsonb

publishing_campaigns
  id, workspace_id, name, color, timestamps

publishing_labels
  id, workspace_id, name, color, timestamps

publishing_post_labels
  publishing_post_id, label_id

publishing_reviews
  publishing_post_id unique
  submitted_by_user_id
  decided_by_user_id nullable
  state pending | approved | rejected
  note nullable

publishing_runs
  id, source_type, workspace_id, requested_by_user_id
  status, idempotency_key, counters, error_code_safe, timestamps
```

Constraints mínimos:

- `unique(workspace_id, idempotency_key)` para acciones reintentables.
- `unique(publishing_post_id)` para una revisión activa.
- índices de entrega por `status + scheduled_at` y por `workspace_id + scheduled_at`.
- FK de workspace, autor, cuenta, archivos, campaña y labels.
- una publicación queda vinculada a **una cuenta destino**; publicar a varias cuentas crea varios posts con una misma operación/run trazable.

### Autorización

| Acción                              | Permiso propuesto                         |
| ----------------------------------- | ----------------------------------------- |
| Ver calendario, drafts y cola       | `publishing.view`                         |
| Crear/editar/borrar drafts          | `publishing.create` / `publishing.manage` |
| Enviar a revisión                   | `publishing.submit_review`                |
| Aprobar/rechazar                    | `publishing.approve`                      |
| Publicar inmediatamente o programar | `publishing.publish`                      |

En creación y ejecución se comprueba: sesión Portal, membership activa, permiso, ownership de campaña/label/media, cuenta accesible por `managed_account_ids`, capability publicable, canal activo y cuota vigente.

### Worker y entrega

```text
API: valida → reserva cuota → persiste post/run + outbox en transacción
Worker: claim atómico → revalida acceso/canal/cuota → transforma media → adapter provider → persiste resultado seguro
Scheduler: solo encola IDs vencidos; no llama proveedores directamente
```

- Retry real con backoff y máximo definido por provider/error.
- Lock o claim condicional para evitar doble entrega.
- Estados terminales explícitos y acción de reintento manual para fallos recuperables.
- Webhooks de Automation mediante outbox/evento durable, no dentro de la publicación remota.

## Decisiones confirmadas

- El MVP incluye **borradores**, **publicación inmediata** y **publicación programada**.
- Los adapters iniciales son **Facebook Page**, **Instagram Profile** y **WhatsApp Status**.
- La autorización de miembros, invitaciones, roles y `managed_account_ids` se define junto al módulo Teams; no se inferirá desde Laravel ni se implementará una política provisional en Publishing.

## MVP recomendado

### Incluido

1. Calendario semanal/mensual y listado de cola.
2. Composer para texto + media desde Files + una o varias cuentas elegibles.
3. Borrador, publicación inmediata y programación de una fecha/hora.
4. Validación y adapters iniciales para Facebook Page, Instagram Profile y WhatsApp Status.
5. Estados `draft`, `scheduled`, `processing`, `published`, `failed` y reintento manual.
6. Campañas y labels básicos.
7. Auditoría y trazabilidad de operación/run.
8. Worker BullMQ idempotente con resultados seguros.

### Posterior al MVP

- Aprobaciones de equipo.
- Recurrencias, slots y mejor horario.
- Watermarks y transformaciones de imagen/video.
- LinkedIn, X y TikTok como adapters publicables.
- Bulk CSV, RSS y AI Publishing como productores hacia el contrato central.
- Analytics, A/B testing, URL shorteners y automatizaciones salientes.

## Experiencia de usuario propuesta

1. **Composer contextual:** elegir cuentas primero mediante un multiselect buscable por nombre de cuenta o alias asignado; los filtros de red son botones interactivos y las cuentas ya elegidas se muestran como badges removibles. El formulario muestra solo campos, límites y preview compatibles con la selección.
2. **Preflight visible:** antes de programar, mostrar validación por destino: media faltante, límite de texto, cuenta desconectada, capacidad no soportada o permiso ausente.
3. **Publicación multicanal transparente:** una operación puede producir varios posts; mostrar progreso individual por cuenta, no un éxito/fallo global ambiguo.
4. **Cola accionable:** separar `Programadas`, `En proceso`, `Fallidas`, `Publicadas`; permitir reintentar solo fallos seguros y explicar la causa sin filtraciones técnicas.
5. **Sugerencias, no automatismos opacos:** mejor horario, caption y transformaciones AI como propuestas editables, con coste/cuota visibles antes de confirmar.
6. **Previas por provider:** preview representativo del formato de cada red sin prometer una réplica pixel-perfect de la app externa.
7. **Protección contra errores:** advertir de cambios incompatibles al añadir/quitar cuentas, preservar borradores y permitir deshacer antes de encolar.
8. **Fecha y hora accesibles:** el compositor usa el `Calendar` y `Popover` compartidos de `packages/ui` para elegir fecha, y controles separados de hora/minuto; no usa `input type="datetime-local"`. El calendario se apoya en `react-day-picker` dentro de `@workspace/ui`.

## Secuencia de ejecución

1. [x] Auditar Laravel, dependencias, proveedores y extensiones de origen.
2. [ ] Aprobar alcance MVP, permisos y estados de transición.
3. [x] Diseñar UI mock: calendar, composer, cola, empty/loading/error/permisos y preview/preflight. Evidencia: `apps/web/features/publishing/` y rutas `apps/web/app/portal/publishing/`.
4. [ ] Definir contrato Zod + REST + errores públicos.
5. [ ] Añadir schema/migración Drizzle y pruebas de constraints.
6. [ ] Implementar API, ownership, cuotas y auditoría.
7. [ ] Implementar Worker, outbox, locks, reintentos y adapters autorizados de Facebook Page, Instagram Profile y WhatsApp Status.
8. [ ] Sustituir mock por API y validar flujo end-to-end.
9. [ ] Añadir aprobaciones, nuevos providers y productores AI/Bulk/RSS por fases.
