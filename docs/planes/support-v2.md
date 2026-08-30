# Support V2

## Estado

El backend está implementado en contrato, cliente REST y Nest. La migración
aditiva `0018_gorgeous_doctor_faustus` está aplicada a `zapi_v2_local`.
`/portal/support` consume `supportApi` y se organiza como centro de ayuda con
la fuente canónica navegable
`template-shadcn-superdashboard/src/app/(main)/dashboard/support`: tabs de
preguntas frecuentes y casos propios, lista de conversaciones tipo inbox con
búsqueda, filtro de estado y paginación compacta, creación y conversación.
Las métricas y la tabla operativa quedan reservadas al backoffice
`/admin/support`.

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
5. [x] Sustituir el fixture por `supportApi` y conservar los mismos estados de
       carga, error, permisos y formulario. El fixture local
       `features/support/fixtures/support.ts` quedó huérfano tras la conexión y
       se eliminó en la iteración del 29 de agosto de 2026.
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

Sigue fuera de alcance en backend: asignación a un agente, tipos, etiquetas,
notas internas, adjuntos y aviso por correo. Las categorías se leen pero su
administración todavía no persiste; la creación de casos desde Admin y la
gestión de categorías, etiquetas y tipos existen como mock visual (ver la
ampliación del 22 de agosto de 2026).

## Ampliación mock del backoffice — 22 de agosto de 2026

Equivalencia visual de los hijos restantes del sidebar Laravel `AdminSupport`:
`New Ticket` (`SupportCreate`) y `Manage Categories` / `Manage Labels` /
`Manage Types` (`SupportTaxonomy`). Todo es mock sobre estado local y
fixtures deterministas: no cambia el contrato REST, el endpoint de la cola ni
la base de datos; las mutaciones reales quedan para la fase 7 de esta
vertical.

Fuente canónica creada primero en
`template-shadcn-superdashboard/src/app/(main)/dashboard/support-admin` y copiada a
`apps/web/features/admin-support/` (`admin-support-page.tsx`,
`admin-support-new-case-sheet.tsx`, `support-catalog-panel.tsx`).

- La superficie `/admin/support` se organiza en tabs «Casos», «Categorías»,
  «Etiquetas» y «Tipos», el mismo patrón de `/admin/manual-payments`.
- «Nuevo caso» es la acción principal del `DataTableHeader` de la cola, con
  `FloatingActionButton` en móvil. El sheet replica los campos de
  `SupportCreate`: usuario destino (obligatorio), categoría y tipo
  opcionales, etiquetas múltiples, asunto y mensaje obligatorios. Formulario
  `noValidate`, asteriscos semánticos, errores por toast y botón deshabilitado
  hasta completar los obligatorios; Cancelar sin icono.
- Crear un caso lo añade al estado local de la cola como «Abierto» y suma en
  las métricas; su botón «Ver caso» queda deshabilitado porque el detalle
  exige un caso persistido. Los casos locales desaparecen al recargar.
- Los tres catálogos usan la tabla canónica completa (búsqueda, filtro de
  estado, `TableEmptyRow` con columnas visibles y `TablePagination`), sheet de
  creación/edición con nombre obligatorio e interruptor de estado, y
  eliminación con `AlertDialog`. El catálogo de categorías se siembra con las
  categorías reales que ya devuelve la cola y después muta solo en local;
  etiquetas y tipos parten de fixtures.
- Divergencias frente a Laravel: los campos `icon` (clases FontAwesome) y
  `color` (hex libre) de la taxonomía no se replican porque V2 no admite
  iconografía externa ni colores fuera de tokens; el buscador de usuarios se
  sustituye por un select de fixtures; `status` inicial y `pin` del ticket no
  se exponen (el mock siempre abre casos en «Abierto» y el pin sigue fuera de
  alcance).

Evidencia: fuente con Biome focal sin diagnósticos y `tsc --noEmit`; ZapiV2
con `tsc --noEmit` de Web, lint sin errores nuevos en los archivos tocados y
`bun run audit:portal-admin-ui` sin hallazgos. La aprobación visual
corresponde al usuario.

## Centro de ayuda en Portal — 29 de agosto de 2026

`/portal/support` pasa de una lista de casos a un centro de ayuda con dos
pestañas, siguiendo el patrón estándar de help center (FAQ + contacto). La
fuente canónica se amplió primero en
`template-shadcn-superdashboard/src/app/(main)/dashboard/support` y se copió a
`apps/web/features/support/` (`support-tickets-page.tsx`,
`support-faq-panel.tsx`).

- La pestaña «Preguntas frecuentes» es la inicial: buscador y acordeón con las
  FAQs activas del catálogo global que se administra en `/admin/faqs`. Portal
  las lee por `GET /v1/public/site/faqs` (`publicSiteApi.faqs`, límite 48 y
  búsqueda `q` con debounce): el catálogo no tiene workspace, así que no se
  creó un endpoint de portal nuevo. A diferencia de la página pública `/faqs`,
  Portal no consulta `sections.showFaqs`: ese interruptor gobierna el sitio de
  marketing, no la ayuda dentro del producto.
- La pestaña «Mis casos» abandona la tabla operativa y las métricas: para
  quien abre los casos, el patrón estándar es una lista de conversaciones tipo
  inbox. Cada fila muestra icono, asunto, categoría con conteo de respuestas
  en plural ICU (`replyCount`), badge de estado y fecha, y toda la fila enlaza
  al detalle. Se conservan búsqueda, filtro ligero de estado,
  `TablePagination` como único footer, el sheet de nuevo caso y el
  `FloatingActionButton` móvil. La tabla con columnas y las métricas quedan
  como patrón exclusivo del backoffice `/admin/support`.
- Divergencias frente al patrón de referencia: sin chips de categoría en FAQ
  (la tabla `faqs` no tiene categorías) y sin lista de canales de contacto
  externos (el canal real de contacto es el propio ticketing). Ambas quedan
  para una solicitud de producto explícita.
- Los textos nuevos viven en el namespace `support` (`tab.*`, `tabsLabel`,
  `faq.*`, `replyCount`) en `es.json` y `en.json`; `pageDescription` se
  actualizó al alcance del centro de ayuda y la fila de la lista reutiliza
  `status.*` en lugar del rótulo local en español que tenía la tabla.

Evidencia: fuente con Biome focal sin diagnósticos y sin errores `tsc` nuevos
(los dos existentes son de charts legacy ajenos a soporte); ZapiV2 pasa
`bun run build`, `bun run typecheck`, `bun run lint`,
`bun run audit:portal-admin-ui`, `bun run audit:i18n` y
`bun run audit:i18n-hardcoded`. La aprobación visual corresponde al usuario.

### Evidencia — 21 de agosto de 2026

- `packages/contracts`, `packages/api-client`, `apps/api` y `apps/web` pasan
  `tsc --noEmit`; `bun run build` correcto en los 6 workspaces y la salida de
  Next incluye `/admin/support` y `/admin/support/[ticketId]`.
- `bun run audit:portal-admin-ui` sin hallazgos.
- No se ejecutó la suite de integración de Support: exige
  `SUPPORT_WATERMARKS_TEST_DATABASE_URL` y no cubre todavía la cola de Admin.
- Falta la aprobación visual del usuario.
