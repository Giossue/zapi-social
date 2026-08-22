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
- La barra del calendario se rehízo por solicitud de producto tomando Metricool como referencia funcional. No existía fuente equivalente, así que la composición se creó primero en `diseño ideal/src/app/(main)/dashboard/calendar/_components/calendar.tsx` —navegable en su ruta `/dashboard/calendar`— y después se copió a V2. Una sola línea contiene: buscador, botón del periodo actual cuya etiqueta sigue a la vista (`Este mes`, `Esta semana`, `Hoy`), navegación `‹ [rango] ›` con el rango dentro de `ButtonGroupText`, filtro de canales en `Popover` con casillas y contador, menú de tres puntos con la vista del calendario y, al extremo derecho, la acción principal.
- Decisiones de esa barra: el bloque de título y el contador `N días · N publicaciones` desaparecen porque el periodo ya vive entre las flechas; el filtro de canales pasa a multi-selección —sin selección equivale a todos— y el buscador filtra los posts por título antes de construir los eventos. Los controles comparten altura `h-7`.
- La altura dejó de vivir en el calendario: la fuente y ZapiV2 lo declaran `h-full min-h-[30rem]` y su página aplica `h-[calc(100svh-5rem)] md:h-[calc(100svh-7rem)]`, de modo que la cabecera y las pestañas de la ruta ocupan su espacio sin recalcular restas. Ambos repositorios usan `DataTableSearch` en el buscador; la única divergencia es que el tipado estricto de V2 resuelve la vista por constante en vez de `views[0].key`.
- Publicación en V2 ordena sus tres secciones igual: `CollectionHeader` con título y descripción, pestañas —ahora también en Calendario—, métricas y superficie. Cola y Borradores dejaron de repetir un `CollectionHeader` de nivel `h2` dentro de la tabla y su acción `Nueva publicación` pasó al `DataTableHeader`, junto a la búsqueda.
- Las tablas de Cola y Borradores se alinean con el resto del Portal: se retiró su lista de tarjetas para móvil y el contenedor `hidden md:block` que la acompañaba, de modo que ahora usan el primitive `Table` con su desplazamiento horizontal y barra propia, como Channels.
- Cabecera de Channels: `Canales` y su descripción salen de la card a `CollectionHeader`, igual que `/portal/ai-publishing`; su `DataTableHeader` conserva solo búsqueda y acción. La excepción quedó retirada también del auditor y de [`docs/reglas/design.md`](../reglas/design.md).
- Validación del 15 de agosto de 2026: la fuente pasa Biome focal, `tsc --noEmit` y build Next; ZapiV2 pasa typecheck de Web y `packages/ui`, lint de ambos sin errores, build Web, `git diff --check` y `audit:portal-admin-ui` sin hallazgos. La aprobación visual corresponde al usuario.

## Publicación — parpadeo al cambiar de pestaña — 15 de agosto de 2026

- Calendario, Cola y Borradores son rutas hermanas: cada pestaña desmontaba `PublishingPageLoader` y montaba otro con estado vacío, así que la vista ya pintada volvía al spinner mientras `publishingApi.list()` respondía de nuevo. El `loading.tsx` de la ruta destino sumaba un segundo parpadeo mientras llegaba su RSC.
- El loader conserva la última respuesta en módulo y arranca con ella: al cambiar de pestaña el contenido aparece de inmediato y la petición revalida en segundo plano. Un fallo de revalidación con datos en pantalla ya no los sustituye por el estado de error; sin datos previos, el error y su reintento se comportan igual que antes.
- Las tres rutas se prefetchean al montar la vista, de modo que la navegación entre pestañas no espera al RSC ni muestra su `loading.tsx`.
- No cambian contratos, permisos ni mutaciones: `publishingApi` se sigue consultando en cada montaje.

## Files — carpetas y archivos en una sola superficie — 15 de agosto de 2026

- Producto pidió el modelo de Google Drive: una sola vista donde las carpetas encabezan el mismo listado que los archivos, en vez de una sección `Carpetas` con cards grandes y otra `Todos los archivos`. El cambio se hizo primero en `diseño ideal/src/app/(main)/dashboard/file-manager/` y luego se copió a V2.
- La fuente retira `folders-section.tsx` y su página deja de mostrar los encabezados `Folders` y `All files`: `FileListView` y `FileGridView` reciben ahora `folders` además de `files`.
- En lista, cada carpeta es una fila más de la tabla —icono, nombre que abre la carpeta, número de archivos y tamaño, tipo `Carpeta`, fecha y su menú de acciones— sin casilla de selección, porque la selección masiva sigue operando solo sobre archivos.
- En cuadrícula, las carpetas ocupan cards compactas de una sola línea sobre las cards de archivo. Pierden fecha y tamaño: esa información vive en la vista de lista, como en la referencia.
- El estado vacío pasa a mirar ambos conjuntos: solo aparece cuando la ubicación no tiene ni carpetas ni archivos. La paginación sigue contando archivos, que son lo único paginado por el contrato actual.
- El filtro por tipo pasa a `DataTableFilter` y se alinea a la izquierda con las acciones de selección; el conmutador de vista queda solo a la derecha.
- Files sustituye la paginación por carga incremental, como pidió producto: un `IntersectionObserver` con margen de 300 px pide la siguiente tanda al acercarse el final y `Spinner` marca la espera. `TablePagination` desaparece de esta superficie y `docs/reglas/design.md` recoge la excepción.
- La tanda pasa de 10 a 24 archivos. Una mutación no devuelve al principio: `loadLibrary` recarga de una vez todas las tandas visibles, hasta el tope de 100 que admite `limit` en el contrato; por encima de esa cifra el resto se recupera al seguir bajando.
- El contrato pagina carpetas y archivos con la misma ventana, así que al añadir una tanda solo se concatenan archivos y se conservan las carpetas de la ubicación. Cambiar de carpeta, buscar o filtrar reinicia el acumulado.
- La cuadrícula arranca en dos columnas: `grid-cols-2` bajo `sm` para carpetas y archivos, manteniendo `sm:grid-cols-3` y `xl:grid-cols-5`. En móvil deja de mostrarse una card por fila.

## Files — recorrido de carpetas colapsable — 15 de agosto de 2026

- El breadcrumb sigue el comportamiento de Drive con rutas profundas: deja a la vista la carpeta actual y la que la contiene, y recoge el resto —raíz `Archivos` incluida— en un menú tras la elipsis. Hasta tres tramos se muestran enteros.
- El recorrido no era deducible en cliente y por eso nunca llegó a verse: al entrar en una carpeta, `GET /v1/portal/files` solo devuelve sus subcarpetas, así que ni la carpeta actual ni sus ancestros estaban en la respuesta. `portalFilesResponseSchema` gana `folderPath`, que el servicio resuelve subiendo por `parentFolderId`, y la biblioteca lo consume tal cual.
- Cada entrada del menú navega a su carpeta y distingue la raíz con su propio icono.
- Es composición propia de V2: `diseño ideal` no navega entre carpetas en su file-manager, así que no hay superficie equivalente que copiar.

## Files — filtro de tipo y fin de lista — 15 de agosto de 2026

- El filtro por tipo se aplicaba en memoria sobre la tanda recibida, pero `filesTotal` seguía contando sin filtrar. Al elegir un tipo sin resultados, la biblioteca creía que faltaban archivos y pedía tandas sin fin: el usuario solo veía el cargador girando. `kindFilter` traduce el tipo a condiciones sobre `mimeType` dentro de la consulta, así que el total y las páginas ya concuerdan.
- `document` pasa a significar lo mismo que muestra la interfaz —cuanto no es imagen ni vídeo, incluidos PDF, hojas de cálculo y comprimidos—, porque la biblioteca ya los pinta a todos como documento. Las categorías finas del contrato siguen aceptándose.
- Como red de seguridad independiente del conteo, una tanda con menos elementos que el límite cierra la lista: ningún desajuste futuro puede volver a dejar el cargador girando.
- Se retiró el filtro «Creados con AI»: `generatedWithAi` no tiene origen real y siempre vaciaba la vista.
- El filtro gana la opción «Carpetas» y cada opción deja en pantalla lo que nombra: elegir un tipo de archivo esconde las carpetas y elegir «Carpetas» esconde los archivos, que es además donde antes se veían cinco carpetas bajo el rótulo «Documentos». Con «Carpetas» no se piden más tandas, porque solo los archivos se paginan.
- El breadcrumb vuelve a aparecer solo dentro de una carpeta; en la raíz no se muestra la palabra «Archivos».
- «Enviar a papelera» pasa a llamarse «Eliminar»: V2 no tiene papelera y `remove`/`removeFolder` ya borran los ficheros y sus filas sin estado intermedio. El diálogo de confirmación habla de elementos —no solo de archivos— y advierte de que la acción no se puede deshacer.

## Files — orden, acciones en lote y favoritos — 15 de agosto de 2026

- Marcar un favorito escribía `updatedAt`, así que el archivo saltaba al principio del listado —ordenado por esa fecha— tanto al marcarlo como al desmarcarlo, y además falseaba la fecha mostrada. `updateAsset` solo toca `updatedAt` cuando cambian el nombre o la carpeta.
- La barra de acciones en lote solo contaba archivos, de modo que seleccionar carpetas no mostraba nada. Ahora aparece con cualquier selección y mover y eliminar operan sobre ambos tipos: cada elemento usa su endpoint —`update`/`remove` para archivos, `updateFolder`/`removeFolder` para carpetas— y el resultado se informa por elementos, no por archivos.
- El orden es una consulta real, no un reordenamiento de lo ya cargado: `portalFilesQuerySchema` acepta `sort` (`name` o `modifiedAt`) y `order` (`asc` o `desc`), el servicio los aplica a archivos y carpetas, y el cliente los propaga. El menú de la biblioteca replica el de Drive con sus dos bloques.
- Divergencia frente a Drive: no se ofrecen «Fecha en la que lo modificaste» ni «Fecha en la que lo abriste», que exigen datos por usuario que el schema no guarda, ni el bloque «Carpetas», porque el contrato pagina carpetas y archivos por separado y mezclarlos rompería el recuento de tandas.
- El desplegable del breadcrumb se retiró por decisión de producto: la ubicación actual vuelve a ser texto.

## Files — selección y navegación al modo Drive — 15 de agosto de 2026

- La biblioteca deja de seleccionarse con casillas. `useLibrarySelection` —copiado entre `diseño ideal` y V2— gobierna carpetas y archivos como una sola colección ordenada: un clic selecciona, doble clic abre, `Ctrl`/`Cmd` alterna, `Mayús` extiende el rango, `Ctrl`/`Cmd` + `A` selecciona todo, `Esc` limpia y un clic en el hueco deselecciona.
- Con el teclado, las flechas recorren la colección y `Mayús` extiende la selección al moverse; `Intro` abre el elemento activo. Los saltos verticales se resuelven contra la geometría real del DOM, así que funcionan igual en la tabla de una columna que en la rejilla, que cambia de ancho al redimensionar.
- Abrir significa entrar en la carpeta o previsualizar el archivo. El `Checkbox` desaparece de la card y de la tabla; el estado seleccionado lo pinta `data-selected` en el primitive `Card` —añadido en ambos repositorios— y `data-state="selected"` en `TableRow`, que ya lo soportaba.
- La rejilla declara `role="listbox"` con `aria-multiselectable` y sus elementos `role="option"`; la tabla conserva su semántica nativa y solo marca `aria-selected` por fila. El recorrido usa `tabindex` móvil para entrar con una sola pulsación de `Tab`.
- Mover y eliminar en lote siguen operando solo sobre archivos: la selección puede incluir carpetas, pero esas acciones filtran los identificadores de archivo antes de llamar a la API.
- El breadcrumb pasa a mostrarse siempre, con `Archivos` como raíz. Su último tramo es un menú desplegable con las acciones de la ubicación actual —crear carpeta y, dentro de una carpeta, renombrar, mover o enviar a papelera—, como el selector de `Mi unidad` en Drive.
- Las cards de carpeta centran verticalmente icono, nombre y menú.

## Files — doble envío al crear carpeta — 15 de agosto de 2026

- Crear carpeta no bloqueaba su formulario mientras la petición viajaba, así que un segundo envío salía antes de que el primero cerrara el diálogo. El servidor aceptaba el primero y rechazaba el segundo con `VALIDATION_FAILED` por nombre repetido; como el éxito espera a recargar la biblioteca y el error no, el aviso rojo aparecía antes que el verde.
- `createFolder` ignora reentradas mientras hay una petición en curso y `FileFolderDialog` recibe `pending`: la acción muestra `Spinner` y queda deshabilitada, cancelar se bloquea y el diálogo no se cierra a mitad de guardado.
- El error deja de ser único: un `VALIDATION_FAILED` explica que ya existe una carpeta con ese nombre en la ubicación actual; el resto conserva el mensaje genérico. No cambian el contrato ni la validación de la API.
- Renombrar, mover y eliminar comparten el patrón sin estado pendiente; quedan fuera de este cambio por no haberse reportado.

## Files en móvil — acción única — 15 de agosto de 2026

- `Nueva carpeta` e importación de `Google Drive` quedan ocultas bajo `sm`: en móvil la barra superior conserva solo la búsqueda y las tres formas de añadir viven en el botón flotante.
- `FloatingActionButton` acepta `menu`: cuando se le pasa un `DropdownMenuContent`, el botón lo abre en vez de ejecutar una acción única. Files lo usa con `Nueva carpeta`, `Google Drive` —solo si el proveedor está habilitado— y `Subir desde archivos`, conservando permisos, estado `openingDrive` y diálogos existentes.
- El icono vuelve al signo `+` por defecto del primitive, coherente con que ahora ofrece varias acciones. Su fila de [`packages/ui/COMPONENTS.md`](../../packages/ui/COMPONENTS.md) recoge el contrato nuevo.

## Dashboards Portal y Admin — gráficos con datos reales — 22 de agosto de 2026

- Producto pidió que ambos dashboards usen los gráficos de `diseño ideal` con información útil según la base de datos. Las composiciones canónicas se crearon primero en la fuente reutilizando los patrones de charts de `dashboard/analytics` (línea comparativa, barras diarias con shape propio, barras horizontales con tabs y tabla compacta) y después se copiaron a V2.
- Fuente Portal: `diseño ideal/src/app/(main)/dashboard/default/` se rehízo con `metric-cards` (MetricCard + badge de tendencia), `publishing-activity`, `ai-usage`, `channel-breakdown` y `upcoming-posts`; se retiraron `performance-overview`, `subscriber-overview`, `recent-customers-table` y `data.json`, que solo consumía esa página.
- Fuente Admin: `diseño ideal/src/app/(main)/dashboard/platform/dashboard/` añade `admin-metric-cards`, `user-growth`, `plan-breakdown`, `recent-payments` y `platform-ai-activity`; `admin-dashboard-preview` los compone y conserva las cards de atención operativa e integraciones.
- Contrato: `portalDashboardSchema` pasa a exponer KPIs con tendencia (`change` dirección + etiqueta calculadas en servidor), serie diaria comparada de 28 días, uso AI (créditos, días y tipos), distribución por canal/herramienta y próximas publicaciones (programadas y borradores, sin IDs). Se añade `adminDashboardSchema` con usuarios, workspaces, suscripciones activas, ingresos, crecimiento de usuarios, suscripciones por plan, actividad AI y últimos pagos (`amountMinor` + `currency`, formateo en cliente). Los campos `welcome`, `primaryAction`, `tools` y `attention` desaparecen: ninguna superficie los renderizaba.
- API: `DashboardService` Portal sustituye el stub por consultas Drizzle reales filtradas por `workspaceId` de la sesión (publishing_posts, social_accounts, ai_requests, file_assets), con ventanas de 28 días actuales y previas agregadas por día en SQL. Nuevo `GET /v1/admin/dashboard` en el mismo módulo con `requirePlatformAdmin` y agregados de plataforma (users, workspaces, billing_subscriptions + plans, billing_payments netos de reembolsos, ai_requests). Los helpers de ventanas, series y etiquetas viven en `dashboard.shared.ts`.
- Web: `features/dashboard` copia la composición fuente y elimina la tabla de resumen anterior, sus tipos duplicados y la fixture sin consumidores; los tipos vienen de `@workspace/contracts`. `features/platform-admin` incorpora los cinco componentes nuevos y `admin-dashboard.tsx` carga en paralelo `adminDashboardApi.get()` y la disponibilidad de proveedores, conservando loading (`PageLoading`), error con reintento, 403 y redirección de sesión expirada.
- Divergencias registradas frente a la fuente: los conjuntos vacíos muestran un texto atenuado («Sin datos…», «Sin pagos…») porque los datos reales pueden estar vacíos y la demo siempre tiene filas; las fechas reales se formatean con `Intl` en español; los iconos de tipos AI se resuelven por etiqueta con `Sparkles` como fallback. Los KPI de suscripciones activas no muestran tendencia por no existir un histórico honesto.
- Validación del 22 de agosto de 2026: `diseño ideal` pasa Biome focal, `tsc --noEmit` y build Next; ZapiV2 pasa `bun run typecheck` (8 tareas), `bun run build` (6 tareas), lint Web con 0 errores (los 2 avisos de los dashboards son el patrón heredado de carga en efecto), `bun --cwd apps/api test` (19 pruebas, 40 omitidas), `audit:portal-admin-ui` sin hallazgos y `git diff --check`. La aprobación visual corresponde al usuario.
- Corrección post-despliegue del 22 de agosto de 2026: el portal desplegado devolvía 500 porque las cuatro expresiones `case when columna >= ${fecha}` interpolaban un `Date` en un template `sql` crudo; sin encoder de columna, Drizzle lo serializa con `toString()` («Sat Jul 25 2026 …») y Postgres no puede compararlo con `timestamptz`. Las mismas ventanas pasadas por `gte()` sí viajan en ISO. El fix pasa `fecha.toISOString()` con cast `::timestamptz` en portal (créditos y archivos) y admin (workspaces y pagos). Diagnóstico reproducido ejecutando las consultas Drizzle reales contra la base local; verificado el patrón corregido, typecheck y tests de API.

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
- Las acciones Crear/Editar/Ver originadas en tablas de Portal/Admin abren sheet lateral. Planes, Soporte, módulos Admin, módulos Portal y detalle de invitación Teams ya siguen ese contrato; `AlertDialog` queda reservado para confirmar destrucción y Channels abre su conexión de canal en `Sheet` a pantalla completa.
- Auditoría residual: las superficies activas de Portal y Admin usan `subtle` para cards de contenido, `surface`/`inset` solo en contenido anidado o previews y controles con `background`. Perfil mantiene las acciones fuera de la card; los `CardFooter` restantes corresponden a estados, previews o cards autocontenidas, no a formularios de configuración.
- Evidencia final: `diseño ideal` pasa `npx biome check`, `npx tsc --noEmit`, build Next (56 rutas) y `git diff --check`; Biome conserva 4 warnings no bloqueantes de previews de Files. ZapiV2 pasa `bun run typecheck` (7 tareas), `bun run build` (5 tareas y 75 rutas), lint Web con 0 errores y `git diff --check`; quedan 46 warnings heredados de hooks, React Compiler, imágenes y bloques legacy no renderizados.
- La aprobación visual manual sigue correspondiendo al usuario; no se levantó servidor ni se generaron capturas en esta iteración.
