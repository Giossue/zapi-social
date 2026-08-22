# Support V2

## Estado

El backend está implementado en contrato, cliente REST y Nest. La migración
aditiva `0018_gorgeous_doctor_faustus` está aplicada a `zapi_v2_local`.
El fixture funcional de `/portal/support` usa la fuente canónica navegable
`diseño ideal/src/app/(main)/dashboard/support`: métricas, tabla, búsqueda,
filtro adaptable, paginación compacta, creación y conversación. V2 conserva
el fixture local hasta conectar `supportApi`.
Las métricas de abiertos, resueltos y cerrados usan el `MetricCard` compartido
en ambos repositorios, con icono y contexto propios para cada estado.

## Referencia Laravel

`AppSupport` permite a una persona crear tickets, buscar y filtrar los suyos,
ver la conversación, responder mientras el ticket está abierto y marcarlo como
resuelto. Las categorías las administra `AdminSupport`; tipos, etiquetas,
asignación interna, pin y cierre son herramientas de soporte, no acciones de
Portal.

## Decisiones V2

- Cada ticket pertenece al workspace activo y a la persona que lo creó. En
  Portal sólo esa persona puede listarlo, leerlo, responderlo o resolverlo;
  cambiar de workspace no concede acceso a tickets ajenos.
- El texto de la descripción y las respuestas se almacena como texto plano,
  no como HTML. Es una divergencia deliberada frente al editor HTML Laravel
  para eliminar la superficie XSS de conversaciones de soporte.
- Las categorías son un catálogo global activo/inactivo. La migración crea un
  conjunto inicial neutro para que Support sea utilizable desde el primer
  despliegue. Su administración por Platform Admin se deja para el módulo
  Admin, sin exponerla como una acción de Portal.
- Resuelto impide nuevas respuestas; el historial queda inmutable. `closed`,
  etiquetas, tipos y notas internas se reservan para el futuro backoffice de
  soporte, sin falsear que ya exista atención administrativa en V2.
- No hay adjuntos, email saliente ni Worker en esta fase: Laravel tampoco
  adjunta archivos desde este flujo y no existe todavía un adaptador de mesa de
  ayuda o notificaciones en V2.

## Modelo durable propuesto

1. `support_categories`: catálogo global con nombre, slug, descripción,
   estado y timestamps.
2. `support_tickets`: workspace, solicitante, categoría, asunto,
   descripción, estado `open|resolved|closed`, actividad y lecturas de cada
   lado de la conversación.
3. `support_ticket_comments`: ticket, autor, rol
   `requester|support`, cuerpo de texto plano y timestamps.

Toda escritura genera un evento en `api_audit_logs`. Las FKs e índices aseguran
ownership, conversaciones en cascada y listado por solicitante/actividad.

## Contrato REST propuesto

- `GET /v1/portal/support/categories` — categorías disponibles.
- `GET /v1/portal/support` — tickets propios, búsqueda, estado y paginación.
- `POST /v1/portal/support` — abrir ticket.
- `GET /v1/portal/support/:id` — ticket propio con conversación.
- `POST /v1/portal/support/:id/comments` — responder un ticket abierto.
- `POST /v1/portal/support/:id/resolve` — marcarlo como resuelto.

### Backoffice de soporte (Platform Admin)

- `GET /v1/admin/support` — cola global con búsqueda, estado, categoría y
  filtro «sin responder»; devuelve además métricas y catálogo de categorías.
- `GET /v1/admin/support/:id` — caso con conversación; abrirlo marca
  `support_last_read_at`.
- `POST /v1/admin/support/:id/comments` — responder como `support`.
- `PATCH /v1/admin/support/:id/status` — abrir, resolver o cerrar.

## Orden de implementación

1. [x] Añadir contrato, schema y migración aditiva con categorías iniciales.
2. [x] Implementar API Nest, ownership por solicitante y auditoría.
3. [x] Añadir cliente REST tipado y prueba focal preparada para PostgreSQL
       local.
4. [x] Crear primero la fuente canónica y copiar al Portal V2 la tabla,
       búsqueda, filtros, paginación, creación y detalle con conversación.
5. [ ] Sustituir el fixture por `supportApi` y conservar los mismos estados de
       carga, error, permisos y formulario.
6. [x] Implementar la cola de soporte de Platform Admin: listado global,
       detalle, respuesta y cambio de estado.
7. [ ] Asignaciones, tipos, etiquetas, notas internas y notificaciones por
       correo del backoffice.

## Fuera de alcance inicial

- Importar tickets, usuarios, categorías o comentarios de Laravel.
- Mostrar o mutar tickets de terceros desde Portal.
- Adjuntos, HTML enriquecido, correo, SLA o integración externa de help desk.

## Evidencia de validación

- `packages/database`, `packages/contracts`, `packages/api-client` y
  `apps/api` pasan typecheck; Database, Contracts y API también pasan build.
  `packages/api-client` no declara un script de build.
- La migración se validó primero dentro de `BEGIN … ROLLBACK` y luego se aplicó
  a `zapi_v2_local` con el rol `zapi_social`: el historial pasó de 18 a 19,
  creó las cuatro tablas y las cuatro categorías iniciales, y verificó tres
  constraints/FKs críticos y tres índices.
- `apps/api/src/support-watermarks.integration.spec.ts` comprueba aislamiento
  entre workspaces y constraints de Watermarks. Exige explícitamente
  `SUPPORT_WATERMARKS_TEST_DATABASE_URL` apuntando sólo a
  `zapi_v2_local`. Tras aplicar `0018`, pasó 2/2 y confirmó que la transacción
  revierte sus fixtures: tickets, comentarios y reglas terminan en cero.
- `apps/web` pasa `typecheck` y `build`; la salida de Next incluye
  `/portal/support` y `/portal/support/[ticketId]`.

## Backoffice de soporte — 21 de agosto de 2026

Equivalencia del módulo Laravel `AdminSupport`. Reutiliza las tablas existentes:
no hubo migración.

- La cola de Admin es deliberadamente global: `AdminSupportService` no filtra
  por workspace porque el operador de plataforma atiende a todos los espacios.
  El ownership por workspace sigue vigente en el lado Portal, donde cada
  consulta filtra por `workspaceId` y solicitante.
- «Sin responder» se deriva del estado ya existente, sin columna nueva: un caso
  espera al equipo cuando está abierto y `support_last_read_at` es nulo o
  anterior a `last_activity_at`. Abrir el detalle en Admin lo marca como leído;
  responder desde Portal lo vuelve a poner en la cola.
- Una respuesta de soporte pone `requester_last_read_at` en nulo, de modo que
  el cliente ve el caso como no leído en Portal.
- Admin sí puede `closed` y reabrir, acciones que Portal no expone. Responder
  a un caso cerrado devuelve `SUPPORT_TICKET_NOT_OPEN`.
- Cada respuesta y cada cambio de estado escribe en `api_audit_logs` con el
  workspace del caso y el usuario administrador como actor.

Sigue fuera de alcance: asignación a un agente, tipos, etiquetas, notas
internas, adjuntos y aviso por correo. Las categorías se leen pero todavía no
se administran desde Admin.

### Evidencia — 21 de agosto de 2026

- `packages/contracts`, `packages/api-client`, `apps/api` y `apps/web` pasan
  `tsc --noEmit`; `bun run build` correcto en los 6 workspaces y la salida de
  Next incluye `/admin/support` y `/admin/support/[ticketId]`.
- `bun run audit:portal-admin-ui` sin hallazgos.
- No se ejecutó la suite de integración de Support: exige
  `SUPPORT_WATERMARKS_TEST_DATABASE_URL` y no cubre todavía la cola de Admin.
- Falta la aprobación visual del usuario.
