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

## Orden de implementación

1. [x] Añadir contrato, schema y migración aditiva con categorías iniciales.
2. [x] Implementar API Nest, ownership por solicitante y auditoría.
3. [x] Añadir cliente REST tipado y prueba focal preparada para PostgreSQL
       local.
4. [x] Crear primero la fuente canónica y copiar al Portal V2 la tabla,
       búsqueda, filtros, paginación, creación y detalle con conversación.
5. [ ] Sustituir el fixture por `supportApi` y conservar los mismos estados de
       carga, error, permisos y formulario.
6. [ ] Implementar el backoffice de soporte, asignaciones y notificaciones
       cuando exista el alcance de Admin.

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
