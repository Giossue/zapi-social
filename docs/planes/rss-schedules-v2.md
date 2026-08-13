# RSS Schedules V2

## Estado

**Fases 1 a 7 completadas.** La superficie canónica existe en `../diseño ideal/src/app/(main)/dashboard/rss-schedules/` y fue copiada a Portal V2 en `apps/web/features/rss-schedules/`. El listado, búsqueda/filtro/estados y wizard de cuatro pasos conservan la composición canónica, pero ahora consumen REST: la tabla filtra y pagina en servidor, el wizard resuelve canales conectados y zona horaria de perfil, y crear, pausar, reactivar, eliminar y ejecutar ya son acciones durables. La tabla conserva el mismo avatar, menú contextual compacto y footer de paginación de Channels/Captions, también cuando no hay resultados. El Worker revisa las programaciones cada minuto y transforma cada artículo nuevo en un borrador por canal, sin publicar automáticamente. La migración `0017` está aplicada tanto localmente como en la base remota; queda como validación operativa posterior crear una programación real y observar su primer borrador.

## Hechos observados en Laravel

Laravel expone listado, creación y edición bajo `/portal/rss-schedules`. El acceso depende de Publishing, del permiso `rss_schedules.view` y de la capacidad de plan `rss_schedules`.

Un schedule pertenece al usuario dueño y equipo activo; contiene URL del feed, destinos (social accounts), horarios, días, ventana opcional de inicio/fin, estado activo/pausado y reglas de contenido. El scheduler lo evalúa cada minuto, obtiene RSS o Atom, deduplica por `schedule + account + content_hash`, crea una publicación por destino y guarda historial enlazado a la publicación.

Laravel también ofrece ejecución manual, búsqueda, filtro por estado, pausar/reactivar y borrar. Sus extras actuales son campañas/etiquetas, URL shortener, referral code y reescritura AI con créditos/límites. No se consideran parte del núcleo hasta que V2 disponga de sus entidades equivalentes.

## Decisiones V2 confirmadas

- Ruta Portal: `/portal/rss-schedules`; requiere módulo Publishing y permiso específico `rss_schedules.view`. Crear, editar, ejecutar, pausar y eliminar requieren `rss_schedules.manage`. Ambos IDs están definidos en `@workspace/contracts` y disponibles en el fixture administrativo de planes; la autorización efectiva se implementará junto con API.
- La primera entrega no migra datos de Laravel ni almacena XML crudo, tokens ni HTML remoto sin limpiar.
- API ofrece una prevalidación acotada de feed mediante timeout, límite de respuesta y allowlist de protocolos `https`/`http`; el Worker repite su propia descarga segura, parsing y creación de borradores. Ningún request de Portal publica contenido.
- RSS y Atom son válidos. Cada item se identifica por GUID/link/hash normalizado y la deduplicación es durable por schedule y cuenta destino; no es una preferencia configurable. El wizard lo comunica como una garantía, no como un switch que el usuario pueda desactivar.
- **Decisión de producto:** la primera entrega crea un post `draft` por cada cuenta destino para que el equipo lo revise y lo publique desde Publishing. No programa ni publica automáticamente y no inventa campañas, etiquetas, shortener ni reescritura AI.
- La zona horaria del workspace determina próximos slots. Una ejecución manual usa el mismo flujo idempotente con `ignoreHistory` explícito solo para el operador autorizado.
- Mientras `workspaces` no tenga una zona horaria propia, el wizard usa la zona horaria configurada en el perfil del operador y la persiste en cada programación. No se infiere desde el navegador si el perfil ya tiene una zona válida; convertirla en una preferencia de workspace queda pendiente de su modelo y UI explícitos.

## Modelo de datos implementado

1. `rss_schedules`: `workspace_id`, `created_by_user_id`, nombre, feed URL, descripción, estado, zona horaria, `time_slots`, `weekdays`, ventana por fechas locales opcional, último check, última cola, próximo run, reglas de contenido y timestamps.
2. `rss_schedule_targets`: `rss_schedule_id + social_account_id`; reemplaza el JSON `account_ids` de Laravel. Su FK compuesta exige que schedule, target y social account correspondan al mismo workspace.
3. `rss_schedule_histories`: schedule, target, `publishing_post_id` nullable, GUID/link, hash, título redactado, resultado (`queued|skipped|failed|published`), código de error seguro y timestamps. Unique durable en `schedule + target + content_hash`; una FK compuesta impide asociar un target de otro schedule o workspace.
4. `rss_schedule_runs`: evidencia de cada ejecución Worker/manual: disparador, actor opcional, job id, inicio/fin, feeds leídos, queued/skipped/failed y error normalizado. Es la fuente para diagnóstico y auditoría; no se depende de logs del contenedor.

Los eventos relevantes también escriben en `api_audit_logs` o `worker_audit_logs` existentes.

## Procesamiento Worker implementado

- Al arrancar, el Worker registra un job repetible por minuto y recupera ejecuciones manuales que quedaron en `queued`. Los IDs de jobs usan guiones; no contienen `:`.
- Una programación nueva se inicializa con su próximo slot, sin ejecutar antes de la hora elegida. Cuando vence, el dispatcher reserva el siguiente slot y crea un `rss_schedule_run` durable antes de encolar el procesamiento.
- El processor vuelve a resolver el host antes de conectar, rechaza redes privadas, redirects, respuestas no exitosas y feeds mayores de 1 MB; no almacena XML ni HTML remoto. Cada ejecución admite reintentos BullMQ limitados.
- Por cada cuenta destino activa y compatible, crea como máximo un borrador con el artículo nuevo más reciente que aún no tiene historial. Los siguientes artículos se procesan en ejecuciones posteriores; esto conserva la protección de Laravel frente a una avalancha inicial de borradores.
- `rss_schedule_histories` y `publishing_posts` se insertan dentro de la misma transacción. La clave única `schedule + target + content_hash` protege los reintentos. Una ejecución manual con `ignoreHistory: true` usa un hash derivado del run para permitir un nuevo borrador explícitamente.
- La plantilla reemplaza `{title}`, `{summary}` y `{url}` respetando las reglas guardadas. El resultado es un post de Publishing con estado `draft`, nunca `scheduled` ni `processing`.

## Propuesta de UI canónica — Diseño Ideal

No existe una pantalla RSS equivalente en `diseño ideal`; por tanto se creará primero, desde cero, en `../diseño ideal/src/app/(main)/dashboard/rss-schedules/`, usando exclusivamente sus componentes ya instalados:

- **Listado:** una `Card` operativa con `DataTableHeader`,
  `DataTableToolbar`, `DataTableFilter`, `Table`, `Badge`, `DropdownMenu`,
  `Empty`, `Dialog`/`AlertDialog` y `TablePagination`. La cabecera agrupa
  nombre, descripción, búsqueda y `Crear programación`; los filtros van en una
  fila propia adaptable. Columnas: feed (nombre + URL), destinos (canal
  principal + cantidad adicional), próxima ejecución, actividad (último run +
  cola), estado y acciones. No hay switch duplicando el estado: ejecutar,
  pausar/reactivar y eliminar viven en el menú contextual.
- **Formulario:** diálogo de cuatro pasos con indicador centrado y conectado: Feed → Destinos y horarios → Reglas → Revisión. Usa `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `TimePicker`, `Card`, `Button` y `Spinner`. El formulario usa `noValidate`: URL de feed, nombre, al menos un destino, frecuencia y hora llevan asterisco rojo y `aria-required`; la acción principal permanece bloqueada hasta completar el paso. Los errores de formato, validación del feed o guardado se comunican por toast, sin `FieldError` ni validación nativa. No se adapta un módulo existente de V2.
- **Detalle/actividad:** `Dialog` con ejecuciones e historial paginado; muestra resultado, fechas y contenido seguro, nunca XML crudo ni errores internos.

Después de aprobar la fuente, se copia literalmente a `apps/web/features/rss-schedules`; únicamente se sustituyen fixtures, handlers, rutas, permisos y datos reales.

Estados obligatorios: loading, vacío inicial sin canales, vacío filtrado, feed inválido, sin permiso, validación mediante toast, validación/creación pendiente con `Spinner`, error de Worker y confirmación de eliminación.

## Contrato REST propuesto

- `GET /v1/portal/rss-schedules` — listado paginado, búsqueda y estado.
- `POST /v1/portal/rss-schedules/validate-feed` — validación/preview redactado; rate-limited.
- `POST /v1/portal/rss-schedules` — crear.
- `GET|PATCH|DELETE /v1/portal/rss-schedules/:id` — detalle, editar, eliminar.
- `POST /v1/portal/rss-schedules/:id/toggle` — pausar/reactivar.
- `POST /v1/portal/rss-schedules/:id/run` — ejecución manual encola job idempotente.
- `GET /v1/portal/rss-schedules/:id/runs` y `.../history` — trazabilidad paginada.

## Orden de implementación

1. [x] Crear listado y wizard canónicos en Diseño Ideal con fixtures sintéticas; revisar estados y responsive.
2. [x] Copiar literalmente a Web V2 con mock repository y rutas Portal.
3. [x] Aprobar contratos Zod, permisos y modelo de los cuatro conjuntos de datos.
4. [x] Crear migración Drizzle y validarla localmente.
5. [x] Implementar API y cliente REST; después conectar el mock.
6. [x] Implementar Worker, scheduler, deduplicación, runs e integración con Publishing.
7. [x] Añadir auditoría, pruebas focales de ownership/deduplicación y documentación de cierre.

## Fuera de alcance inicial

- Migración de schedules/historial desde Laravel.
- Reescritura AI, créditos, campañas, etiquetas, URL shortener y referral links.
- RSS privado con credenciales, webhooks o feeds que requieran JavaScript.
- Publicación inmediata fuera de las reglas de Publishing V2.

## Evidencia de validación

- Fase 1: `biome check` y `next build` ejecutados en `../diseño ideal`; la ruta canónica `/dashboard/rss-schedules` compiló correctamente. Tras la iteración de tabla basada en Channels y la posterior validación del wizard, `biome check` focal de sus componentes y nuevos `next build` también pasaron. El `biome check` global continúa teniendo errores preexistentes y ajenos en Audit y File Manager.
- Fase 2: `bun run typecheck` y `bun run build` ejecutados en `apps/web`; `/portal/rss-schedules` aparece en el build. Tras copiar la nueva composición y la validación del wizard, `prettier --check` focal, `bun run typecheck` y nuevos `bun run build` también pasaron. La última iteración igualó avatar, menú y paginación de la tabla canónica, y volvió a pasar typecheck/build. `bun run lint` finalizó sin errores; mantiene warnings preexistentes ajenos a RSS Schedules.
- Fases 3 y 4: `bun run typecheck` global pasó; el parseo de contratos confirmó defaults, orden de slots/días y rechazo de FTP/horarios repetidos. Drizzle generó `0017_rss_schedules`, que se probó dentro de una transacción revertida y se aplicó a `zapi_v2_local` con el rol `zapi_social`. El 5 de agosto de 2026 se aplicó también a la base remota `zapi_v2` con Drizzle: el historial quedó en 18 migraciones, la huella coincide y las cuatro tablas RSS están vacías con sus constraints. No se modificaron filas existentes.
- Fase 5: `apps/api`, `packages/api-client` y `apps/web` pasan `bun run typecheck`; Web también pasa `bun run build`. La API expone listado paginado, detalle, creación, edición, pausa/reactivación, eliminación, historial, runs, validación y ejecución manual. Todo ID se resuelve dentro del workspace de sesión y las mutaciones exigen `owner` o `admin`. La validación limita a 10 intentos por usuario y workspace por minuto, descarga solo una URL HTTP(S) pública resuelta antes de conectar, sin redirects, con timeout de 8 s y máximo de 1 MB; devuelve únicamente metadatos y una muestra saneada. Ejecutar crea un `rss_schedule_run` y un job con ID sin `:` que la fase 6 consume. No existen pruebas API focales todavía (`jest --runInBand` no encontró archivos `*.spec.ts`).
- Fase 6: `apps/worker` pasa `bun run typecheck` y `bun run build`. La prueba focal `rss-schedule-time.spec.ts` pasa 3 casos: zona horaria persistida, siguiente día habilitado y límite de fecha final. El job repetible, la recuperación de runs en cola, la creación de borradores y sus auditorías se implementaron sin tocar la base remota.
- Fase 7: `apps/api` pasa typecheck/build y `bun run test:rss-schedules` pasa dos pruebas de integración con PostgreSQL local. La prueba solo acepta `zapi_v2_local` en loopback y cada caso revierte su transacción: confirma que una programación de otro workspace responde como no encontrada y que PostgreSQL rechaza un segundo historial con la misma programación, destino y `content_hash` (`23505`). El runner Jest existente no puede cargar el workspace ESM `@workspace/database`; esta suite usa el runner nativo de Bun de forma explícita.
- Consistencia de formulario (12 de agosto de 2026): el wizard canónico y su copia Portal eliminan validación nativa y errores inline, usan `TimePicker`, toast, `Spinner`, iconos al inicio y bloqueo por completitud/pending. Pasaron `biome check` y `tsc --noEmit` en `diseño ideal`; en V2 pasaron Prettier focal, ESLint focal, typecheck Web y `git diff --check` focal.
