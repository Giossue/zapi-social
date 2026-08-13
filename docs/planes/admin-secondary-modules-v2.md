# Mockups secundarios de Administración V2

## Estado y alcance

Las rutas principales de plataforma ya tienen superficies propias. Este plan cubre las 17 entradas restantes del sidebar Admin que todavía caen en el placeholder genérico. La entrega actual es exclusivamente visual y usa fixtures sintéticas; no crea contratos, endpoints, tablas ni migraciones.

Fuente canónica: `diseño ideal/src/app/(main)/dashboard/admin-modules`. La copia V2 vive bajo `features/platform-admin-mockups` y conserva el patrón final de tablas, sheets y formularios.

## Equivalencia Laravel

| Área              | Rutas V2                                                                                                                                  | Comportamiento útil conservado en el mockup                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Contenido         | `/admin/blogs`, `/admin/blog-categories`, `/admin/blog-tags`, `/admin/faqs`                                                               | Listado, búsqueda, estado, orden, creación, edición, duplicación o eliminación según el recurso. |
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
2. [x] Crear y validar la fuente canónica navegable en `diseño ideal`.
3. [x] Copiar las 17 superficies a ZapiV2 y retirar el placeholder de cada entrada del sidebar.
4. [x] Validar fuente y consumidor con formato, typecheck/build, lint focal y `git diff --check`.
5. [ ] Obtener aprobación visual del usuario.
6. [ ] Diseñar contratos y backend por vertical únicamente después de aprobar los mockups.

## Evidencia — 10 de agosto de 2026

- Fuente navegable creada en `/dashboard/admin-modules`; `npm run build` correcto y Biome focal sin diagnósticos.
- Las 17 rutas Admin aparecen explícitamente en el build de ZapiV2 y ya no resuelven mediante el placeholder dinámico.
- Web: lint focal, `tsc --noEmit` y `next build` correctos.
- No se levantaron servidores ni se hizo revisión visual automatizada; la aprobación visual corresponde al usuario.

## Revisión de consistencia — 12 de agosto de 2026

- Se alineó la composición con Planes y los módulos Admin existentes: acción principal en el encabezado de página, métricas y tabla con superficie `subtle`, toolbar y paginación compartidas, detalle mediante sheet y eliminación mediante `AlertDialog`.
- La revisión final sustituyó el grid local de métricas por `MetricCard` en fuente y consumidor, por lo que las cinco rutas con resumen numérico coinciden con `/admin/users`.
- Los formularios mantienen `noValidate`, `aria-required`, asterisco rojo, estado pendiente y bloqueo por campos obligatorios; una edición o ajuste sin cambios no puede guardarse.
- La separación tonal se resolvió en la fuente canónica y en primitives compartidos, no con colores locales de la feature.
- Fuente: Biome focal sin diagnósticos, `tsc --noEmit`, `next build` y `git diff --check` correctos.
- ZapiV2: lint focal Web sin errores, typecheck de Web y `packages/ui`, build Web con las 17 rutas y `git diff --check` correctos. Los warnings de lint restantes pertenecen a efectos preexistentes en Planes, Carousel y hooks responsive; no fueron introducidos por esta revisión.

## Retiro de módulos — 12 de agosto de 2026

- Se retiraron por decisión de producto `Menú público` y `Temas`: navegación, páginas explícitas y fixtures dejan de existir. Las URLs antiguas pasan al catch-all de Admin y responden `notFound()`.
- Tabs de ajustes ya no usan scrollbars nativos: envuelven las opciones visibles y el auditor global `bun run audit:portal-admin-ui` impide reintroducir ese patrón.
- La aprobación visual sigue pendiente; este punto no se marca como cerrado hasta que el usuario revise el resultado.
