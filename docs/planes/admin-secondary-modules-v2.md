# Mockups secundarios de Administración V2

## Estado y alcance

Las rutas principales de plataforma ya tienen superficies propias. Este plan cubre las 16 entradas restantes del sidebar Admin que todavía caen en el placeholder genérico. La entrega actual es exclusivamente visual y usa fixtures sintéticas; no crea contratos, endpoints, tablas ni migraciones. Captcha dejó este alcance: su superficie real se documenta en [`turnstile-v2.md`](./turnstile-v2.md).

Fuente canónica: `template-shadcn-superdashboard/src/app/(main)/dashboard/admin-modules`. La copia V2 vive bajo `features/platform-admin-mockups` y conserva el patrón final de tablas, sheets y formularios.

## Equivalencia Laravel

| Área              | Rutas V2                                                                                                                                  | Comportamiento útil conservado en el mockup                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Usuarios y acceso | `/admin/user-report`, `/admin/user-roles`, `/admin/teams`                                                                                 | Reporte de crecimiento y seguridad de cuentas; roles con matriz de permisos; equipos con propietario y miembros. |
| Contenido         | `/admin/blogs`, `/admin/blog-categories`, `/admin/blog-tags`, `/admin/blog-rss`, `/admin/faqs`                                            | Listado, búsqueda, estado, orden, creación, edición, duplicación o eliminación según el recurso. |
| Localización      | `/admin/languages`                                                                                                                        | Idiomas y sincronización de traducciones.                                                        |
| Catálogo AI       | `/admin/ai-templates`, `/admin/ai-template-categories`                                                                                    | Plantillas, categorías, estado, orden y edición contextual.                                      |
| Observabilidad AI | `/admin/ai-usage-logs`, `/admin/ai-report`                                                                                                | Uso por proveedor/modelo/capacidad, coste, tokens y reporte agregado.                            |
| Ajustes           | `/admin/settings/general`, `/admin/settings/auth`, `/admin/settings/captcha`, `/admin/settings/analytics`, `/admin/settings/static-pages` | Configuración general, acceso, captcha, scripts de analítica y páginas legales/estáticas.        |
| Operación         | `/admin/settings/cache`, `/admin/settings/crons`, `/admin/settings/system-information`                                                    | Limpieza de cache, tareas programadas y diagnóstico redactado del sistema.                       |

## Decisiones de UI

- Las colecciones usan `DataTableHeader`, `DataTableToolbar`, `DataTableFilter` y el único `TablePagination`.
- Crear o editar recursos breves usa sheet desplazable. Campos obligatorios muestran asterisco rojo y el botón permanece deshabilitado hasta completarlos.
- Ajustes largos se separan por tabs y cards; el botón para guardar queda fuera de la card, sin footer coloreado.
- No se usan controles nativos de fecha, hora, selección o validación. Errores y confirmaciones del mock usan toast.
- Acciones principales muestran icono a la izquierda. Menús de fila usan tres puntos verticales y separan acciones destructivas.
- No se muestran secretos, rutas del servidor, variables de entorno ni diagnósticos sensibles.
- La jerarquía visual sigue el patrón Admin consolidado: lienzo `background`, métricas y contenido en `Card variant="subtle"`, encabezado tabular `muted` y controles con el tono del lienzo dentro de las cards.
- Blogs, Plantillas AI, Uso AI, Reporte AI e Información del sistema reutilizan el `MetricCard` compartido; cada dato conserva etiqueta, valor, contexto e icono semántico propio, sin una variante local ni un icono genérico repetido.
- El mock conserva estado local: crear y editar actualizan la tabla; ver abre detalle; eliminar requiere confirmación; cache y cron ejecutan acciones sin fingir CRUD; los ajustes detectan cambios y solo habilitan guardar cuando corresponde.

## Fases

1. [x] Auditar navegación Admin y módulos Laravel equivalentes.
2. [x] Crear y validar la fuente canónica navegable en `template-shadcn-superdashboard`.
3. [x] Copiar las 16 superficies restantes a ZapiV2 y retirar el placeholder de cada entrada del sidebar; Captcha ya es una integración real.
4. [x] Validar fuente y consumidor con formato, typecheck/build, lint focal y `git diff --check`.
5. [ ] Obtener aprobación visual del usuario.
6. [ ] Diseñar contratos y backend por vertical únicamente después de aprobar los mockups.

## Evidencia — 10 de agosto de 2026

- Fuente navegable creada en `/dashboard/admin-modules`; `npm run build` correcto y Biome focal sin diagnósticos.
- Las 16 rutas Admin mock aparecen explícitamente en el build de ZapiV2 y ya no resuelven mediante el placeholder dinámico. Captcha se valida en su plan funcional propio.
- Web: lint focal, `tsc --noEmit` y `next build` correctos.
- No se levantaron servidores ni se hizo revisión visual automatizada; la aprobación visual corresponde al usuario.

## Revisión de consistencia — 12 de agosto de 2026

- Se alineó la composición con Planes y los módulos Admin existentes: acción principal en el encabezado de página, métricas y tabla con superficie `subtle`, toolbar y paginación compartidas, detalle mediante sheet y eliminación mediante `AlertDialog`.
- La revisión final sustituyó el grid local de métricas por `MetricCard` en fuente y consumidor, por lo que las cinco rutas con resumen numérico coinciden con `/admin/users`.
- Los formularios mantienen `noValidate`, `aria-required`, asterisco rojo, estado pendiente y bloqueo por campos obligatorios; una edición o ajuste sin cambios no puede guardarse.
- La separación tonal se resolvió en la fuente canónica y en primitives compartidos, no con colores locales de la feature.
- Fuente: Biome focal sin diagnósticos, `tsc --noEmit`, `next build` y `git diff --check` correctos.
- ZapiV2: lint focal Web sin errores, typecheck de Web y `packages/ui`, build Web con las 16 rutas mock y `git diff --check` correctos. Los warnings de lint restantes pertenecen a efectos preexistentes en Planes, Carousel y hooks responsive; no fueron introducidos por esta revisión.

## Superficies de usuarios y acceso — 22 de agosto de 2026

Se añadieron tres superficies mock nuevas siguiendo el mismo patrón fuente → copia. La fuente canónica sigue siendo `template-shadcn-superdashboard/src/app/(main)/dashboard/admin-modules` (grupo «Usuarios y acceso» del selector); la copia V2 vive en `apps/web/features/platform-admin-mockups` porque los mockups anteriores ya fueron reemplazados por superficies REST reales.

| Ruta V2              | Referencia Laravel (`modules/AdminUser`)                                          | Qué muestra el mockup                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/user-report` | `AdminUserReportController` + `report/index.blade.php`                             | Métricas de usuarios, crecimiento 30 días, verificación y 2FA; tabla de últimas altas con usuario, rol, plan y registro; solo lectura.    |
| `/admin/user-roles`  | `RoleIndex`, `RoleForm`, `AdminPermissionCatalog`, `roles-index.blade.php`         | Roles con usuarios asignados y conteo de permisos; crear/editar en sheet con matriz de permisos por módulo y acción; eliminar con aviso. |
| `/admin/teams`       | `TeamIndex`, `TeamForm`, `teams-index.blade.php`                                   | Equipos con propietario, miembros y slug; estado con/sin propietario; edición de nombre y descripción en sheet, sin crear ni eliminar.   |

Adaptaciones respecto a Laravel, documentadas como divergencias del mock:

- El reporte reduce la batería de gráficos Highcharts a las cuatro métricas principales (`MetricCard`) y la tabla de últimas altas; el estado por fila resume la postura de verificación (`Verificada`, `Sin verificar`, `Atención`).
- La matriz de permisos usa los grupos representativos del panel V2 con acciones Ver/Crear/Editar/Eliminar, derivadas del catálogo dinámico de rutas de Laravel.
- La gestión individual de miembros de un equipo (añadir/quitar con rol) no se replica en el mock; se conserva el conteo de miembros y el propietario.
- Igual que en Laravel, Equipos no permite crear ni eliminar (los equipos personales se aprovisionan automáticamente); para ello el mockup genérico ganó el modo de acción `edit`.

El mockup genérico de la fuente se amplió antes de copiar: campo `permissions` (matriz con `Checkbox` dentro de `FieldSet`), modo de acción `edit`, botón secundario «Cancelar» sin icono en el sheet de formulario, `FloatingActionButton` para la acción de crear (con el botón del encabezado oculto bajo `sm`) y columnas responsive `hidden md/lg:table-cell`. `FloatingActionButton` se portó a `template-shadcn-superdashboard/src/components` desde `packages/ui`.

Evidencia de validación:

- Fuente: Biome focal sin diagnósticos y `tsc --noEmit` correctos; los tres módulos son navegables en `/dashboard/admin-modules`.
- ZapiV2: `tsc --noEmit` de Web, lint de Web sin errores nuevos (0 hallazgos en los archivos añadidos) y `bun run audit:portal-admin-ui` sin hallazgos.
- La aprobación visual corresponde al usuario; la navegación del sidebar se integra en un proceso separado.

## Fuente RSS del blog — 22 de agosto de 2026

Se añadió la colección mock `/admin/blog-rss`, equivalente al hijo «RSS Feeds»
del sidebar de `modules/AdminBlogs` en Laravel (`RssIndex` sobre
`blog_rss_sources`). La fuente canónica es la colección `blog-rss` del grupo
«Contenido y localización» en `template-shadcn-superdashboard/src/app/(main)/dashboard/admin-modules`;
la copia V2 vive en
`apps/web/features/admin-content/components/blog-rss-collection.tsx` y reutiliza
el patrón declarativo de `AdminCollectionPage` con fixtures locales
deterministas (sin contrato REST ni endpoint nuevo).

- Campos tomados de Laravel sin inventar ninguno: nombre, URL del feed,
  categoría destino, etiquetas, frecuencia de sincronización en minutos,
  máximo de entradas por ejecución, instrucción para la IA, estado
  activa/pausada, publicación automática, mejora con IA y traducción
  automática. La tabla muestra fuente, categoría, sincronización, última
  importación con conteo de entradas y estado.
- Divergencias del mock: la validación remota del feed, «Run now»/«Run all»,
  la selección múltiple y el histórico de importaciones (`RssLogsIndex`)
  quedan para la vertical real de contenido.
- Validación: fuente con Biome focal sin diagnósticos y `tsc --noEmit`;
  ZapiV2 con `tsc --noEmit` de Web, lint sin errores nuevos y
  `bun run audit:portal-admin-ui` sin hallazgos. La entrada del sidebar se
  integra en un proceso separado.

## Retiro de módulos — 12 de agosto de 2026

- Se retiraron por decisión de producto `Menú público` y `Temas`: navegación, páginas explícitas y fixtures dejan de existir. Las URLs antiguas pasan al catch-all de Admin y responden `notFound()`.
- Tabs de ajustes ya no usan scrollbars nativos: envuelven las opciones visibles y el auditor global `bun run audit:portal-admin-ui` impide reintroducir ese patrón.
- La aprobación visual sigue pendiente; este punto no se marca como cerrado hasta que el usuario revise el resultado.
