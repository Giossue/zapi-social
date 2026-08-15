# Refactor visual V2 — base `diseño ideal`

## Decisión

`diseño ideal` es referencia visual completa de ZapiV2: tokens, primitives, densidad, shell y composición. ZapiV2 conserva producto, rutas, sesión, permisos, contratos, REST, Nest, Drizzle y Worker.

```text
diseño ideal → referencia visual
ZapiV2       → comportamiento y arquitectura reales
```

No existe ni se usa una arquitectura V3. No se importan `ThemeBootScript`, Preferences ni stores de preferencias de `diseño ideal`: configuración visual fija solicitada por producto.

## Configuración visual fija

| Opción           | Valor aplicado |
| ---------------- | -------------- |
| Theme preset     | `Default`      |
| Font             | `Inter`        |
| Theme mode       | `Dark`         |
| Page layout      | `Centered`     |
| Navbar           | `Sticky`       |
| Sidebar style    | `Inset`        |
| Sidebar collapse | `Icon`         |

No se entrega un selector de preferencias. Presets, fuentes y modos alternos de la referencia no se habilitan mientras la configuración permanezca fija.

## Alcance y límites

### Incluido

- `packages/ui`: tokens, primitives migrados y catálogo actualizado.
- Shell Portal/Admin, auth, perfil y verticales visuales.
- Estados loading, empty, error, permiso, disabled y overflow donde la feature los requiere.
- Features mock deterministas para superficies sin REST todavía.

### Excluido

- Cambiar Nest, contratos, Drizzle, Worker, API client, endpoints, permisos u ownership.
- Copiar `ThemeBootScript`, Preferences, cookies de preferencias o stores de la referencia.
- Importar `diseño ideal` como dependencia.
- Inventar integración, datos productivos, secretos o mutaciones remotas.

## Implementación

### Foundation `packages/ui`

- [x] Tokens `Default`, modo oscuro, `Inter`, radios, sombras y sidebar importados/adaptados.
- [x] Roles semánticos `success`, `warning`, `info`, `destructive` y foregrounds disponibles en claro/oscuro.
- [x] Catálogo real documentado en [`packages/ui/COMPONENTS.md`](../../packages/ui/COMPONENTS.md).
- [x] Primitives de la referencia disponibles mediante `@workspace/ui/components/*`.
- [ ] Retirar aliases de compatibilidad (`brand-secondary`, variantes antiguas y props compactas) cuando no haya consumidores. Aún existen usos reales en Portal/Admin/features; retirarlos ahora rompería UI.

### Shells y composición transversal

- [x] Portal y Admin: `SidebarProvider` + `SidebarInset`, contenido centrado, header compacto sticky, sidebar `inset` y colapso `icon`.
- [x] Navegación, sesión, permisos, estado activo y persistencia de sidebar preservados.
- [x] Marca Admin enlaza directamente a `/admin/dashboard`.
- [x] Auth: login, registro, recuperación y reset con composición nueva sin cambiar flujos de sesión.
- [x] Perfil Portal: superficies densas, validación, errores persistentes y estados pending preservados.
- [x] 404 adaptado a base visual.

### Verticales

| Vertical                | Estado visual                 | Fuente de datos                  | Notas                                                                                                                |
| ----------------------- | ----------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Dashboard Portal/Admin  | [x] Refactorizado             | Portal REST live / Admin fixture | Sin hero duplicado; métricas y paneles operativos densos.                                                            |
| Files y búsqueda online | [x] Mock nuevo                | Fixtures deterministas           | Rutas `/portal/files` y `/portal/files/search-online`; upload/búsqueda no tocan storage ni API.                      |
| Publishing              | [x] Source-first (calendario) | Mock existente                   | Calendario canónico FullCalendar; cola, borradores y compositor siguen locales.                                      |
| Channels                | [x] Refactorizado             | REST/OAuth live                  | OAuth, 403, paginación, mutaciones y errores preservados.                                                            |
| Teams                   | [x] Source-first              | REST live                        | Miembros, invitaciones, actividad y directorio usan roles y mutaciones reales.                                       |
| AI Studio               | [x] Source-first              | REST live                        | Las 13 rutas comparten composición; historial, automatizaciones y créditos operan sobre API real.                    |
| Captions                | [x] Source-first              | REST live                        | Inventario tabular canónico copiado; CRUD, filtros locales, pending, 403, error y sesión expirada preservados.       |

## Referencias adaptadas

- Shell: `diseño ideal/src/app/(main)/dashboard/layout.tsx`.
- Dashboard: `diseño ideal/src/app/(main)/dashboard/default/`.
- Files: `diseño ideal/src/app/(main)/dashboard/file-manager/`.
- Publishing: `diseño ideal/src/app/(main)/dashboard/calendar/`.
- Channels: `diseño ideal/src/app/(main)/dashboard/channels/` y `users/`.
- Teams: `diseño ideal/src/app/(main)/dashboard/teams/`.
- AI Studio: `diseño ideal/src/app/(main)/dashboard/ai-studio/`.
- Support: `diseño ideal/src/app/(main)/dashboard/support/`.
- Integraciones Admin: `diseño ideal/src/app/(main)/dashboard/platform/integrations/`.
- Captions: `diseño ideal/src/app/(main)/dashboard/captions/_components/caption-library.tsx` y `caption-types.ts`.

Los componentes compartidos de Preferences/layout controls de la referencia se excluyen deliberadamente: son controles para configuración mutable y contradicen la configuración fija aprobada. `date-range-picker` y `simple-icon` no se copian por anticipación: no tienen consumidor V2 actual.

## Validación ejecutada — 2026-08-03

- [x] `bun run typecheck` — 7 workspaces correctos.
- [x] `bun --filter web build` — build Next correcto, rutas nuevas incluidas.
- [x] `git diff --check` — sin errores de whitespace.
- [x] `bun --filter web lint` — 0 errores; 23 warnings existentes/no bloqueantes.
- [x] `bun --filter @workspace/ui lint` — 0 errores; 3 warnings `react-hooks/set-state-in-effect` en hooks migrados.
- [ ] Browser smoke manual: desktop, móvil, dark, teclado, overflow, loading/empty/error/permiso. No había navegador disponible en esta iteración.
- [ ] `bun run lint` raíz: bloqueado fuera de esta migración porque `packages/database` y `packages/contracts` no contienen `eslint.config.*` compatible con ESLint 9.

## Pendientes reales

1. Ejecutar browser smoke sobre `/portal/dashboard`, `/admin/dashboard`, `/portal/files`, `/portal/files/search-online`, `/portal/publishing/calendar`, `/portal/channels`, `/portal/teams`, `/portal/captions`, `/portal/ai-studio/ai-content`, auth y 404.
2. Conectar los módulos Portal todavía declarados como mock a sus contratos REST aprobados en los planes de cada vertical; Commerce no vuelve a exponerse hasta definir su alcance de producto.
3. Resolver warnings de hooks migrados y configuración lint de `database`/`contracts` en una tarea de calidad separada.
4. Retirar compatibilidad UI antigua cuando todos sus consumidores usen contratos finales nuevos.

## Corrección source-first — Dashboard Portal

- La composición previa específica de V2 fue sustituida por la jerarquía de `diseño ideal/src/app/(main)/dashboard/default/`: `MetricCards`, `PerformanceOverview` y `SubscriberOverview` con tabla anidada.
- El dashboard conserva `portalApi.dashboard()`, manejo de sesión expirada, error/retry, rutas y contrato `PortalDashboard`.
- Métricas usan `workspace`; la gráfica usa una fila real por `tools[].uses`; tabla usa `attention`, `publishing` y `library`. No se añadieron clientes, fechas, tendencias o valores ficticios.
- `recharts` se declara explícitamente en `apps/web` para usar la misma estructura `ChartContainer` + `ComposedChart` de la referencia.
- Validación: `bun run typecheck`, `bun --filter web build` y `git diff --check` correctos el 2026-08-03.

## Ajuste shell — Theme y footer

- Header incorpora `ThemeSwitcher` con composición fuente de `diseño ideal`; ciclo `light → dark → system` mediante `next-themes`.
- Se eliminó el footer de sidebar (`SupportCard` y perfil) por decisión UX; perfil y logout permanecen únicamente en `AccountMenu` del header.
- Validación: `bun --filter web typecheck` y `bun --filter web build` correctos el 2026-08-03.

## Cierre del enfoque anterior — reemplazado

**Estado:** cerrado como registro histórico. Los checkboxes y tablas anteriores describen una fase de migración por adaptación que ya no es criterio de aceptación visual.

A partir de esta decisión, la aceptación usa exclusivamente la regla `source-first`:

```text
diseño ideal → implementación visual literal
ZapiV2       → datos y comportamiento de dominio
```

| Superficie                                                         | Estado source-first                                                                                             |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Shell Portal/Admin                                                 | Base activa: estructura fuente copiada y datos/rutas Zapi inyectados.                                           |
| Dashboard Portal                                                   | Base activa: jerarquía `dashboard/default` copiada y alimentada por `PortalDashboard`.                          |
| Auth, Profile, Files, Teams, AI Studio y Dashboard Admin | Cerradas con fuente canónica explícita; las adaptaciones se limitan a datos, permisos y callbacks de ZapiV2.    |
| Publishing / Calendario                                            | Base activa: `dashboard/calendar` y su renderer FullCalendar copiados; datos y callbacks Publishing inyectados. |
| Captions                                                           | Base activa: `dashboard/captions/_components/caption-library.tsx` copiado a la feature y conectado a REST real. |

No se consideran terminadas las superficies pendientes solo porque una iteración previa haya usado primitives, tokens o una adaptación visual. Cada una debe auditarse primero y sustituirse sin perder lógica Zapi.

### Protocolo operativo consolidado

- `diseño ideal` es la fuente visual canónica. Si una superficie no existe allí, se crea y revisa primero allí antes de cualquier composición V2.
- La copia V2 conserva literalmente JSX, clases, primitives, densidad, responsive y estados visuales; adapta únicamente contenido, datos y comportamiento de dominio.
- Tokens nuevos se auditan y crean primero en `diseño ideal`, con claro/oscuro; V2 no crea sustitutos visuales locales.
- Cambios que afecten fuente y consumidor se validan en ambos repositorios. Una iteración cerrada queda pausada hasta una solicitud de producto nueva.

## Channels Portal — avance source-first

- Se auditó completo el flujo antes de cambiar visual: listado REST, cursor, filtros, permisos, OAuth Meta, picker, QR WhatsApp, sincronización, rename, delete, reconnect y estados loading/error/empty/403.
- El inventario de cuentas sustituyó su grid/card V2 por composición fuente de `diseño ideal/src/app/(main)/dashboard/users/_components/{users,users-columns,users-table}.tsx`.
- Los datos, filtros y paginación siguen siendo remotos/cursor de Channels. Las diferencias frente a la tabla fuente se limitan a no inventar filtros locales, selección masiva, exportación, vista grid o páginas numéricas inexistentes en el contrato actual.
- La fuente canónica del selector inicial vive en `diseño ideal/src/app/(main)/dashboard/channels/_components/channel-capability-picker.tsx`, con demo en `diseño ideal/src/app/(main)/dashboard/channels/page.tsx`.
- V2 copia su `ChannelCapabilityGrid` en `features/channels/components/channel-capability-picker.tsx`; solo adapta textos, tipos de availability y callback de conexión real. No usa variantes, tokens ni clases visuales heredadas de V2.
- Las capabilities bloqueadas muestran un único badge de estado, sin botón deshabilitado redundante; el grid reserva 32 px al lado del scrollbar y 1 px para el `ring` de las cards, evitando bordes cortados.
- El diálogo canónico usa `sm:max-w-3xl` en fuente y V2, ampliando las dos columnas y separando visualmente el scrollbar de la card derecha.
- `diseño ideal` no tenía token `success`; se añadieron `success` y `success-foreground` en claro/oscuro. `Disponible` usa ese verde y los estados no disponibles usan el gris `secondary` ya existente.
- Los badges usan `leading-none` en fuente y copia para centrar ópticamente su texto dentro de la altura fija del primitive.
- Validación de la fuente canónica: `npm run check` y `npm run build` correctos en `diseño ideal`.
- Edición consume `Field`/`FieldGroup` y `SheetFooter` copiados literalmente de `diseño ideal/src/components/ui/{field,sheet}.tsx`; solo cambian etiqueta, valor y callback Zapi.
- Eliminación consume `AlertDialog` con `AlertDialogMedia`, header y footer de `diseño ideal/src/components/ui/alert-dialog.tsx`; solo cambian recurso, texto y callback destructivo Zapi.
- El picker OAuth Meta y el flujo QR WhatsApp tienen fuentes canónicas explícitas en `dashboard/channels/_components`; V2 conserva OAuth, QR y callbacks reales.
- Validación de este avance: `bun --filter web typecheck`, `bun --filter web build` y `git diff --check` correctos el 2026-08-03; `bun --filter web lint` sin errores; sus warnings restantes no provienen de `channel-capability-picker.tsx`.

## Tablas operativas — patrón global

- `DataTableHeader`, `DataTableToolbar` y `DataTableFilter` fijan la composición
  de búsqueda, acciones y filtros a partir de Channels. `TablePagination` es
  el único footer operativo: rango y navegación anterior/siguiente, sin modos
  alternativos ni selector local de filas por página.
- El patrón se aplica en Channels, módulos Admin, Planes, Captions, RSS,
  Soporte, Teams, Publishing, el resumen del Dashboard y el historial de AI
  Studio. Los filtros dejan de usar anchos fijos y pasan a otra línea cuando no
  hay espacio.
- Validación del 2026-08-10: typecheck de `packages/ui` y Web, lint Web sin
  errores, build Web y `git diff --check` correctos. No se levantó servidor ni
  se ejecutó revisión visual; corresponde a aprobación del usuario.
- Revisión del 2026-08-12: `TableHeader` adopta el plano semántico `muted`, los controles usan `background` dentro de cards y el lienzo claro se separa de `card`; las superficies Admin estándar usan `Card variant="subtle"`. El cambio existe primero en `diseño ideal` y se replica en `packages/ui`, sin colores locales ni variantes paralelas.
- Cierre de densidad del 2026-08-12: el primitive `Table` absorbe el cuerpo visual de Channels —padding, encabezado, bordes y hover— y se retiraron overrides locales de Channels, Dashboard, Captions, RSS, Support, Teams y Publishing. El resumen del Dashboard también movió búsqueda y filtros a `DataTableHeader`/`DataTableToolbar`; las tablas restantes de Portal y Admin heredan el mismo contrato sin cambiar datos, acciones, permisos ni paginación.
- Cierre de jerarquía del 2026-08-12: cada colección principal de Portal y Admin conserva un solo título contextual. Los módulos con tabs o métricas mantienen la cabecera superior y usan `DataTableHeader` solo para búsqueda y acción; las tablas puras, como Channels y Auditoría, alojan el contexto dentro de la card. Las acciones de colección pasaron a `DataTableHeader`, los textos como “resultados en esta vista” se eliminaron y el total queda únicamente en `TablePagination`.
- Alineación de controles del 2026-08-12: cuando `DataTableHeader` no muestra contexto porque la ruta ya tiene título, la búsqueda queda a la izquierda y la acción se alinea al extremo derecho de la card. Las tablas con título dentro de la card mantienen sus controles a la derecha de ese contexto.
- Corrección de Portal del 2026-08-13: `CollectionHeader` pasa a ser la única cabecera contextual fuera de card para Support, Teams, RSS, Captions, Publishing, Dashboard y operaciones de AI Studio. Sus `DataTableHeader` contienen solo búsqueda y acción. `audit:portal-admin-ui` bloquea nuevas regresiones de este tipo. La excepción de Channels que mantenía ese contexto dentro de la card quedó retirada el 15 de agosto de 2026.
- Validación de jerarquía del 2026-08-12: la fuente canónica pasa Biome focal, TypeScript y build Next de 56 rutas; ZapiV2 pasa lint focal de UI/Web, typecheck de ambos workspaces y build completo de 75 rutas. La búsqueda residual solo conserva el conteo de resultados de búsqueda online de Files, que no es una tabla paginada ni posee footer duplicado.

## Captions Portal — avance source-first

- La fuente canónica se reestructuró primero en `diseño ideal/src/app/(main)/dashboard/captions/_components/caption-library.tsx` junto con `caption-types.ts`, usando literalmente el patrón tabular de `dashboard/users` que sirve de base a Channels; V2 no compone una variante visual propia.
- `apps/web/features/captions/components/captions-library-page.tsx` copia la jerarquía tabular, DOM, clases, responsive, empty/error/loading, diálogos y badges de la fuente. La vista sustituye las cards y métricas por un Card operativo con búsqueda, filtros compactos, conteo, tabla y `TablePagination`; la adaptación se limita a imports `@workspace`, tipos reales, textos, callbacks, IDs accesibles y datos REST.
- Se eliminó el selector visible de estados de demo. `captionsApi.list/create/update/remove` activa loading, 403, error, resultados y empty según las respuestas reales; el filtro permanece local sobre captions recibidos.
- Un `ApiError` `AUTH_SESSION_EXPIRED` recibido en carga o mutaciones redirige con `useRouter().replace("/login")`, sin mostrar error técnico ni request IDs. `updatedAt` ISO se formatea para lectura humana y el error de guardado queda persistente en el formulario, además del toast secundario.
- Error y permiso usan Card + empty state como Channels; los empty inicial/filtrado se renderizan dentro de la tabla. La única divergencia de variante es el botón de acciones: `ghost` en fuente se mapea a `brand-secondary` porque producto lo prohíbe. No se añadieron variantes, tokens, aliases ni colores locales; badges activo verde y los demás grises conservan `leading-none`.
- Validación: `npm run check` y `npm run build` correctos en `diseño ideal`; `bun --filter web typecheck`, `bun --filter web build` y `git diff --check` correctos en V2 el 2026-08-03. El lint focal no tiene errores y conserva el warning conocido de TanStack Table que ya existe en Channels. La carga REST inicial sigue siendo una promesa cancelable en `useEffect`. No se ejecutó smoke de navegador autenticado en esta iteración.

## Publishing Portal — calendario source-first

- Se auditó el flujo mock y la equivalencia Laravel antes de sustituir la composición: permiso `canView`, posts, cuentas, borrador/programación/publicación inmediata, cola, reintento, borradores, preview y errores permanecen locales; no se tocó REST, contratos, Nest, Drizzle ni Worker.
- La fuente exacta es `diseño ideal/src/app/(main)/dashboard/calendar/_components/calendar.tsx`; su renderer `src/components/calendar/event-calendar-views.tsx` se copia a `apps/web/features/publishing/components/` para evitar promover un pattern que todavía solo consume Publishing.
- V2 adapta los eventos desde `PublishingPost`, los calendarios de demo a filtros Facebook/Instagram/WhatsApp y `Add event` al compositor mock. La navegación, selector, jerarquía DOM, clases, responsive, popover y vistas mes/semana/día se conservan de la fuente.
- La vista diaria es una divergencia visual explícita frente a Laravel, que solo expone mes/semana; no introduce datos ni nuevas transiciones de estado y se reevaluará al definir REST.
- `@fullcalendar/react` y `date-fns` se declaran en `apps/web` por importación directa. El CSS de skeleton se importa junto al renderer copiado, sin tokens, colores o CSS global V2 nuevos.
- Validación: `bun --cwd apps/web typecheck`, lint focal de los tres componentes y `git diff --check` correctos el 2026-08-03. Falta smoke manual en navegador para `/portal/publishing/calendar` en escritorio, móvil y modo claro/oscuro.

## Publishing Portal — encuadre e idioma del calendario — 15 de agosto de 2026

- El calendario ya consumía la fuente canónica; `event-calendar-views.tsx` sigue siendo copia literal de `diseño ideal/src/components/calendar/event-calendar-views.tsx`. El `Calendar` de shadcn no aplica: es un selector de fechas, no un calendario de eventos con vistas mes/semana/día.
- La fuente `dashboard/calendar/_components/calendar.tsx` no fijaba altura, así que FullCalendar crecía por `aspectRatio` y obligaba a desplazar la página en escritorio. La fuente pasa a encuadrar el calendario en el viewport —`h-[calc(100svh-5rem)] md:h-[calc(100svh-7rem)]` con `min-h-[30rem]`— y su renderer recibe `height="100%"`, `expandRows`, `dayMaxEvents` y `scrollTime="08:00:00"`. ZapiV2 copia ese encuadre; el desplazamiento pasa a ser interno del calendario.
- El hueco bajo el calendario en móvil venía del espaciador de `FloatingActionButton`, pensado para páginas que se desplazan. El primitive acepta `withSpacer` y el calendario lo desactiva; su fila queda documentada en [`packages/ui/COMPONENTS.md`](../../packages/ui/COMPONENTS.md).
- El calendario se pintaba sobre el lienzo: su cuerpo usaba `background` y solo su encabezado tenía plano propio (`sidebar`). La fuente pasa a tratarlo como contenido estándar: encabezado y cuerpo comparten `card`, y el renderer sustituye `background` por `card` en cuerpo, encabezados de tabla, encabezado de mes, cabecera de agenda, más-enlaces, anillos de evento e indicador de ahora. En claro la superficie deja de confundirse con el lienzo y en oscuro conserva el tono que ya tenía el encabezado; los controles del toolbar siguen recuperando `background` por su primitive.
- Divergencia de idioma frente a la fuente: V2 pasa `locale` español de `@fullcalendar/react/locales/es`, con lo que encabezados de día, «todo el día», horas y el título del rango dejan de aparecer en inglés. El título usa `first-letter:uppercase` en vez de `capitalize` para no romper «agosto de 2026».
- Los controles del calendario adoptan el patrón operativo de Channels: canal y vista usan `DataTableFilter` —etiqueta, valor y `size="sm"`— y comparten línea con la navegación anterior/hoy/siguiente y la acción principal, todos a la misma altura. Se retiró el icono de calendario del filtro de canal. Es divergencia explícita frente a `diseño ideal`, que usa `Select` con icono: `DataTableFilter` es un pattern propio de V2 sin equivalente en la fuente y producto exige un único patrón de filtro en Portal.
- Cabecera de Channels: `Canales` y su descripción salen de la card a `CollectionHeader`, igual que `/portal/ai-publishing`; su `DataTableHeader` conserva solo búsqueda y acción. La excepción quedó retirada también del auditor y de [`docs/reglas/design.md`](../reglas/design.md).
- Validación del 15 de agosto de 2026: la fuente pasa Biome focal, `tsc --noEmit` y build Next; ZapiV2 pasa typecheck de Web y `packages/ui`, lint de ambos sin errores, build Web, `git diff --check` y `audit:portal-admin-ui` sin hallazgos. La aprobación visual corresponde al usuario.

## Estados de carga compartidos

- Se retiraron los skeletons y placeholders visuales de las rutas Portal/Admin y de los estados internos de Dashboard, Channels, Captions, Profile, Integrations, Files, AI Studio, Plans y Publishing.
- `packages/ui/src/components/spinner.tsx` adopta el spinner de 12 barras recuperado vía MCP desde `21st.dev/@shugar/components/spinner-1`; `PageLoading` centraliza su uso para superficies de página y conserva `aria-busy`/etiquetas accesibles.
- Los flags y transiciones `isLoading`/`loading` se mantienen: el cambio es solamente de presentación y no modifica autenticación, reintentos, llamadas REST ni contratos.

## Cierre de placeholders del Portal — 10 de agosto de 2026

- `diseño ideal/src/app/(main)/dashboard/portal-modules` es la fuente canónica navegable para Publicaciones masivas, AI Publishing, API de automatización, Grupos y Afiliados.
- ZapiV2 copia esa composición en `/portal/bulk-posts`, `/portal/ai-publishing`, `/portal/automation`, `/portal/groups` y `/portal/affiliate`.
- Las cinco superficies usan el patrón final de tablas, búsqueda y filtros adaptables, paginación compacta, tabs sin contadores, acciones con icono izquierdo y sheets desplazables con validación por toast.
- Revisión del 12 de agosto de 2026: la cabecera de página y la acción primaria quedaron fuera de la card operativa; métricas, enlace de afiliado y tabla usan la jerarquía semántica de superficies. Crear y editar actualizan las filas locales, ver abre detalle real y las acciones destructivas exigen confirmación antes de retirar la fila. Los filtros y la paginación siguen trabajando únicamente sobre la pestaña activa.
- Esta iteración cierra el mockup visual y sus interacciones locales. Las conexiones a `bulkPostsApi`, schedules de `aiApi`, `automationApi`, `groupsApi` y `affiliateApi` permanecen en los planes de cada vertical.

## Consistencia transversal Admin y Portal — 12 de agosto de 2026

- La auditoría cubrió ambas áreas. Channels, Teams y Files siguen siendo referencias de producto; no se sustituyó su lógica REST ni sus flujos aprobados.
- `DataTableHeader`, `DataTableToolbar`, `DataTableFilter` y `TablePagination` son la composición común: filtros adaptables sin cortar su etiqueta, controles que envuelven en móvil y footer compacto con el mismo orden y navegación.
- El canvas usa `background`; cards operativas y métricas usan `card`/`subtle`; controles usan `background` dentro de cards; encabezados de tabla usan `muted`. Esta separación aplica por tokens en claro y oscuro, sin colores locales.
- Dashboard, Perfil, Publishing, Captions, RSS, Teams, Support, Watermarks, los nuevos mockups de Portal y los módulos secundarios de Admin adoptan esa jerarquía conservando sus datos, permisos, llamadas REST y mutaciones existentes.
- `MetricCard` queda como único contrato para resúmenes operativos. Portal lo usa en Dashboard, Support, Publishing, AI Studio y los módulos mock; Admin lo usa en Dashboard, Usuarios, Planes, Créditos, Afiliados, Cupones, Pagos, Suscripciones, Configuración AI y los cinco módulos secundarios con métricas. Cada card exige contexto e icono semántico propio.
- Auditoría Admin quedó alineada con el patrón operativo: búsqueda local, filtro por origen, paginación compacta y estados de carga, vacío y error, sin alterar el contrato `GET /v1/admin/audit-events`.

## Cierre de placeholders de Admin — 10 de agosto de 2026

- `diseño ideal/src/app/(main)/dashboard/admin-modules` es la fuente canónica navegable para las 17 entradas secundarias de Admin.
- Se cubren contenido, localización, catálogo y observabilidad AI, ajustes generales y operación del sistema con páginas explícitas en ZapiV2.
- Colecciones usan el patrón final de Channels: cabecera, búsqueda, filtros adaptables, tabla, menú de fila y paginación compacta. Formularios largos usan sheets desplazables; ajustes usan tabs, cards sin footer de acción y botón externo.
- Esta entrega es mock visual con fixtures sintéticas. No añade contratos, endpoints, schema, migraciones ni conexiones backend para estas 17 superficies.
- Fuente y consumidor compilan correctamente; lint focal y typecheck Web también son correctos. La aprobación visual permanece pendiente del usuario.

## Cierre técnico transversal — 12 de agosto de 2026

- Todas las entradas visibles de navegación Portal y Admin tienen una ruta explícita. Los catch-all desconocidos responden `notFound()` y no fabrican pantallas de producto.
- Support e Integraciones Admin ya poseen fuente canónica navegable; Teams, AI Studio, Plans, Publishing, Watermarks y Dashboard Admin conservan sus fuentes exactas creadas durante este plan. Commerce se retiró del Portal por no tener producto validado.
- Recuperación de contraseña, formularios operativos y sheets usan `noValidate`, asterisco semántico rojo, `aria-required`, toast y acción bloqueada hasta completar los campos. No quedan inputs nativos `date`, `time` o `datetime-local` en Web.
- `PageLoading`, `Spinner`, `RetryButton`, `DataTableHeader`, `DataTableToolbar`, `DataTableFilter` y `TablePagination` forman el contrato compartido. Los spinners ad hoc, filtros con ancho fijo y footers alternativos fueron retirados de las superficies activas revisadas.
- Los formularios de Meta, WhatsApp Status, SMTP y Polar.sh comparten sheet desplazable, disponibilidad en superficie `inset`, credenciales separadas, prueba previa cuando corresponde y footer externo bloqueado durante guardado.
- Las acciones Crear/Editar/Ver originadas en tablas de Portal/Admin abren sheet lateral. Planes, Soporte, módulos Admin, módulos Portal y detalle de invitación Teams ya siguen ese contrato; `AlertDialog` queda reservado para confirmar destrucción y Channels conserva su flujo actual como excepción explícita.
- Auditoría residual: las superficies activas de Portal y Admin usan `subtle` para cards de contenido, `surface`/`inset` solo en contenido anidado o previews y controles con `background`. Perfil mantiene las acciones fuera de la card; los `CardFooter` restantes corresponden a estados, previews o cards autocontenidas, no a formularios de configuración.
- Evidencia final: `diseño ideal` pasa `npx biome check`, `npx tsc --noEmit`, build Next (56 rutas) y `git diff --check`; Biome conserva 4 warnings no bloqueantes de previews de Files. ZapiV2 pasa `bun run typecheck` (7 tareas), `bun run build` (5 tareas y 75 rutas), lint Web con 0 errores y `git diff --check`; quedan 46 warnings heredados de hooks, React Compiler, imágenes y bloques legacy no renderizados.
- La aprobación visual manual sigue correspondiendo al usuario; no se levantó servidor ni se generaron capturas en esta iteración.
