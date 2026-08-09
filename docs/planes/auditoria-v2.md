# Auditoría operativa V2

## Objetivo

Persistir evidencia de la aplicación para que Admin consulte auditoría sin depender de los logs efímeros de Dokploy. No reemplaza observabilidad de infraestructura: un proceso que no alcanza a iniciar no puede escribir en PostgreSQL.

## Decisión de modelo

La auditoría se separa primero por el proceso que generó el evento, porque Web, API y Worker tienen contexto, ciclos de vida y campos propios:

1. `web_audit_logs`: interacción y errores vistos por la aplicación Next. Web reporta a la API autenticada; nunca accede a PostgreSQL.
2. `api_audit_logs`: mutaciones y respuestas HTTP de Nest/Fastify. Es el renombre seguro de la tabla histórica `audit_logs`, por lo que sus datos existentes se conservan.
3. `worker_audit_logs`: ejecución de BullMQ, con cola, job e intento además del actor/workspace de origen cuando exista.

`audit_releases` es una tabla auxiliar normalizada. Cada proceso puede referenciar una versión desplegada (`web`, `api` o `worker`) con commit SHA, referencia y fecha, sin repetir esos valores en cada fila de log.

La severidad vive en cada tabla como `success`, `warning` o `error`; no se crean tablas por severidad. Toda fila conserva fecha, evento, resultado, cuenta/actor y workspace cuando el proceso puede conocerlos.

## Alcance inicial

- API registra mutaciones exitosas y respuestas `4xx`/`5xx`; no guarda `GET` exitosos para evitar ruido.
- Web reporta errores de interfaz y acciones de producto relevantes mediante API autenticada.
- Worker registra finalizaciones, advertencias y fallos de jobs relevantes de forma idempotente y redactada.
- Admin de plataforma consulta una línea temporal unificada, con filtros por origen, severidad, fecha, cuenta, workspace, acción, servicio y commit.
- Portal no expone auditoría de otros workspaces.
- No se persisten cookies, tokens, headers de autorización, cuerpos completos, binarios, rutas físicas, prompts sensibles ni stacks completos.

## Contrato y superficie pendientes

- `POST /v1/portal/audit/web-events`: recepción autenticada y validada de eventos Web, siempre etiquetados como fuente Web.
- `GET /v1/admin/audit-events`: timeline unificado de las tres tablas; solo Platform Admin.
- UI Admin: tabla de auditoría con detalle redactado, no un visor de logs crudos de contenedor.
- `RELEASE_COMMIT_SHA` en Web/API/Worker identifica el release si está configurado. Si falta, el evento conserva el proceso y release desconocido; nunca se inventa un commit.

## Seguridad y retención

- Inserciones append-only; no habrá endpoint de edición o borrado de logs.
- Las FKs a actor, workspace y release usan `set null` para preservar historia.
- Retención automática, exportación y alertas se definen después con política explícita antes de borrar evidencia.

## Estado y validación

- [x] Migración segura: `audit_logs` pasó a `api_audit_logs`, se añadieron sus campos y se crearon Web/Worker/Releases. Aplicada y verificada en `zapi_v2_local`; no se aplicó en remoto.
- [ ] Contratos, redacción y escritura completa de Web/API/Worker. Base disponible: API registra automáticamente mutaciones y respuestas `4xx`/`5xx`; Web tiene endpoint autenticado; Worker registra el resultado de thumbnails. Faltan los demás jobs y eventos de interfaz relevantes.
- [x] Consulta y permisos Platform Admin: `GET /v1/admin/audit-events` unifica los tres orígenes y exige Platform Admin.
- [x] UI Admin inicial: `/admin/audit` incluye carga, vacío, error/reintento y tabla de línea temporal. El detalle redactado y filtros quedan pendientes.
- [x] Typechecks de Database, Contracts, API, Worker, API Client y Web pasan. La migración remota y el despliegue siguen pendientes de ejecución y verificación según `docs/reglas/workflow.md`.
