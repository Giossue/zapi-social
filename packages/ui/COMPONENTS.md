# Catálogo de componentes globales

`packages/ui` es la fuente de verdad de primitives y patterns compartidos instalados. Antes de crear markup o un componente, consultar primero `codebase-memory` para verificar el código actual y después este catálogo para su propósito e importación.

Este documento no sustituye el código: debe actualizarse cuando se agregue, retire o promueva un componente global.

## Primitives instalados

| Componente          | Importación                              | Uso principal                                                                                     |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Badge`             | `@workspace/ui/components/badge`         | Estados y etiquetas de dominio.                                                                   |
| `Button`            | `@workspace/ui/components/button`        | Acciones; usar `brand-secondary` para acciones secundarias e iconos. No usar `ghost` en producto. |
| `Card`              | `@workspace/ui/components/card`          | Superficies con variantes semánticas.                                                             |
| `Calendar`          | `@workspace/ui/components/calendar`      | Selección accesible de fechas; componer con `Popover` para campos de fecha.                       |
| `Checkbox`          | `@workspace/ui/components/checkbox`      | Selección múltiple o booleana en formularios.                                                     |
| `Dialog`            | `@workspace/ui/components/dialog`        | CRUD breve, confirmaciones y detalle puntual.                                                     |
| `DropdownMenu`      | `@workspace/ui/components/dropdown-menu` | Acciones secundarias y menús contextuales.                                                        |
| `EmptyState`        | `@workspace/ui/components/empty-state`   | Colecciones, rutas o permisos sin contenido útil.                                                 |
| `Input`             | `@workspace/ui/components/input`         | Entrada de texto de una línea.                                                                    |
| `Popover`           | `@workspace/ui/components/popover`       | Contenido contextual anclado; usar como contenedor de Calendar y controles compactos.             |
| `ScrollArea`        | `@workspace/ui/components/scroll-area`   | Regiones con scroll contenido.                                                                    |
| `Select`            | `@workspace/ui/components/select`        | Selecciones con opciones acotadas.                                                                |
| `Sidebar`           | `@workspace/ui/components/sidebar`       | Shell de navegación responsive con provider controlado, drawer móvil y cierre desktop offcanvas.  |
| `Skeleton`          | `@workspace/ui/components/skeleton`      | Estado loading que conserva la forma del contenido.                                               |
| `Switch`            | `@workspace/ui/components/switch`        | Ajustes binarios inmediatos.                                                                      |
| `Tabs`              | `@workspace/ui/components/tabs`          | Áreas de configuración estrechamente relacionadas.                                                |
| `Textarea`          | `@workspace/ui/components/textarea`      | Entrada de texto multilínea.                                                                      |
| `Toaster` / `toast` | `@workspace/ui/components/toast`         | Feedback transitorio; no sustituye errores persistentes de formularios.                           |
| `Tooltip`           | `@workspace/ui/components/tooltip`       | Etiquetas contextuales para controles compactos; no sustituye texto visible cuando haya espacio.  |

## Proceso obligatorio antes de crear un componente

1. Consultar `codebase-memory` para buscar primitives y patterns existentes en `packages/ui`.
2. Revisar este catálogo y los exports/variantes del componente encontrado.
3. Consultar `componentes.md` solo si se necesita inspiración o un bloque 21st; no representa componentes instalados.
4. Revisar shadcn si no existe un primitive equivalente.
5. Reutilizar el componente existente cuando cubra la necesidad.
6. Si es específico del dominio, crearlo en `features/<dominio>/components`.
7. Promoverlo a `packages/ui` solo si su contrato es genérico y será reutilizable en tres o más features.
8. Al promover o añadir uno global, actualizar este catálogo y respetar tokens, accesibilidad y validación de `docs/reglas/design.md`.
