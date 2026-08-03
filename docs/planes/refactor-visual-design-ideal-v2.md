# Refactor visual V2 — base `diseño ideal`

## Decisión

`diseño ideal` es referencia visual completa de ZapiV2: tokens, primitives, densidad, shell y composición. ZapiV2 conserva producto, rutas, sesión, permisos, contratos, REST, Nest, Drizzle y Worker.

```text
diseño ideal → referencia visual
ZapiV2       → comportamiento y arquitectura reales
```

No existe ni se usa una arquitectura V3. No se importan `ThemeBootScript`, Preferences ni stores de preferencias de `diseño ideal`: configuración visual fija solicitada por producto.

## Configuración visual fija

| Opción | Valor aplicado |
| --- | --- |
| Theme preset | `Default` |
| Font | `Inter` |
| Theme mode | `Dark` |
| Page layout | `Centered` |
| Navbar | `Sticky` |
| Sidebar style | `Inset` |
| Sidebar collapse | `Icon` |

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

| Vertical | Estado visual | Fuente de datos | Notas |
| --- | --- | --- | --- |
| Dashboard Portal/Admin | [x] Refactorizado | Portal REST live / Admin fixture | Sin hero duplicado; métricas y paneles operativos densos. |
| Files y búsqueda online | [x] Mock nuevo | Fixtures deterministas | Rutas `/portal/files` y `/portal/files/search-online`; upload/búsqueda no tocan storage ni API. |
| Publishing | [x] Refactorizado | Mock existente | Toolbar/calendario/tablas densas; acciones siguen locales. |
| Channels | [x] Refactorizado | REST/OAuth live | OAuth, 403, paginación, mutaciones y errores preservados. |
| Teams | [x] Refactorizado | Mock existente | Tabla desktop, filas móvil, gate de roles y acciones mock preservados. |
| AI Studio | [x] Mock nuevo | Fixtures deterministas | Ruta `/portal/ai-studio/ai-content`; generación local, sin proveedor ni créditos reales. |
| Captions | [x] Refactorizado | REST live | CRUD, filtros, pending, 403 y errores preservados. |
| Commerce | [x] Mock nuevo | Fixtures deterministas | Ruta `/portal/commerce`; no existía equivalencia Laravel/V2. No consulta ni modifica órdenes, inventario ni backend. |

## Referencias adaptadas

- Shell: `diseño ideal/src/app/(main)/dashboard/layout.tsx`.
- Dashboard: `diseño ideal/src/app/(main)/dashboard/default/`.
- Files: `diseño ideal/src/app/(main)/dashboard/file-manager/`.
- Publishing: `diseño ideal/src/app/(main)/dashboard/calendar/`.
- Channels/Teams: `diseño ideal/src/app/(main)/dashboard/infrastructure/` y `users/`.
- AI: `diseño ideal/src/app/(main)/chat/` solo como patrón de composición.
- Commerce: `diseño ideal/src/app/(main)/dashboard/ecommerce/` solo como referencia visual.

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

1. Ejecutar browser smoke sobre `/portal/dashboard`, `/admin/dashboard`, `/portal/files`, `/portal/files/search-online`, `/portal/publishing/calendar`, `/portal/channels`, `/portal/teams`, `/portal/captions`, `/portal/ai-studio/ai-content`, `/portal/commerce`, auth y 404.
2. Definir contrato REST, permisos, ownership, almacenamiento e idempotencia antes de convertir Files, AI Studio o Commerce mock en funcionalidades reales.
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

| Superficie | Estado source-first |
| --- | --- |
| Shell Portal/Admin | Base activa: estructura fuente copiada y datos/rutas Zapi inyectados. |
| Dashboard Portal | Base activa: jerarquía `dashboard/default` copiada y alimentada por `PortalDashboard`. |
| Auth, Profile, Files, Publishing, Channels, Teams, Captions, AI Studio, Commerce y Dashboard Admin | Pendientes de reemplazar su composición de dominio adaptada por fuente literal de `diseño ideal`. |

No se consideran terminadas las superficies pendientes solo porque una iteración previa haya usado primitives, tokens o una adaptación visual. Cada una debe auditarse primero y sustituirse sin perder lógica Zapi.


## Channels Portal — avance source-first

- Se auditó completo el flujo antes de cambiar visual: listado REST, cursor, filtros, permisos, OAuth Meta, picker, QR WhatsApp, sincronización, rename, delete, reconnect y estados loading/error/empty/403.
- El inventario de cuentas sustituyó su grid/card V2 por composición fuente de `diseño ideal/src/app/(main)/dashboard/users/_components/{users,users-columns,users-table}.tsx`.
- Los datos, filtros y paginación siguen siendo remotos/cursor de Channels. Las diferencias frente a la tabla fuente se limitan a no inventar filtros locales, selección masiva, exportación, vista grid o páginas numéricas inexistentes en el contrato actual.
- La fuente canónica del selector inicial vive en `diseño ideal/src/app/(main)/dashboard/channels/_components/channel-capability-picker.tsx`, con demo en `diseño ideal/src/app/(main)/dashboard/channels/page.tsx`.
- V2 copia su `ChannelCapabilityGrid` en `features/channels/components/channel-capability-picker.tsx`; solo adapta textos, tipos de availability y callback de conexión real. No usa variantes, tokens ni clases visuales heredadas de V2.
- Edición consume `Field`/`FieldGroup` y `DialogFooter` copiados literalmente de `diseño ideal/src/components/ui/{field,dialog}.tsx`; solo cambian etiqueta, valor y callback Zapi.
- Eliminación consume `AlertDialog` con `AlertDialogMedia`, header y footer de `diseño ideal/src/components/ui/alert-dialog.tsx`; solo cambian recurso, texto y callback destructivo Zapi.
- El picker OAuth Meta y el flujo QR WhatsApp no se han cambiado todavía: requieren sus propias fuentes canónicas en `diseño ideal`; se preservan sin cambios funcionales hasta construirlas allí.
- Validación de este avance: `bun --filter web typecheck`, `bun --filter web build` y `git diff --check` correctos el 2026-08-03; `bun --filter web lint` sin errores; sus warnings restantes no provienen de `channel-capability-picker.tsx`.
