# Catálogo de componentes globales

`packages/ui` es la fuente de verdad de tokens, primitives y patterns compartidos. Antes de crear markup o un componente, consultar primero `codebase-memory` para verificar el código actual y después este catálogo para elegir su importación.

Este inventario refleja los módulos reales de `packages/ui/src/components/`. No sustituye sus exports, contratos ni variantes: revisar el archivo fuente antes de integrarlo. Debe actualizarse en el mismo cambio que agregue, retire o promueva un componente global.

## Acciones, navegación y estructura

| Componente | Importación | Uso principal |
| --- | --- | --- |
| `Accordion` | `@workspace/ui/components/accordion` | Secciones expandibles relacionadas. |
| `Breadcrumb` | `@workspace/ui/components/breadcrumb` | Jerarquía y navegación contextual. |
| `Button` | `@workspace/ui/components/button` | Acciones; usar `brand-secondary` para acciones secundarias e iconos. No usar `ghost` en producto. |
| `ButtonGroup` | `@workspace/ui/components/button-group` | Agrupación visual de acciones afines. |
| `Collapsible` | `@workspace/ui/components/collapsible` | Mostrar u ocultar contenido secundario. |
| `Command` | `@workspace/ui/components/command` | Paleta de comandos y selección filtrable. |
| `ContextMenu` | `@workspace/ui/components/context-menu` | Acciones contextuales al interactuar con un recurso. |
| `DropdownMenu` | `@workspace/ui/components/dropdown-menu` | Acciones secundarias y menús contextuales. |
| `Menubar` | `@workspace/ui/components/menubar` | Barra de menús de aplicación. |
| `NavigationMenu` | `@workspace/ui/components/navigation-menu` | Navegación horizontal estructurada. |
| `Pagination` | `@workspace/ui/components/pagination` | Navegación entre páginas de resultados. |
| `Sidebar` | `@workspace/ui/components/sidebar` | Shell de navegación responsive con provider, drawer móvil y variantes `inset`/`icon`. |
| `Tabs` | `@workspace/ui/components/tabs` | Áreas estrechamente relacionadas. |
| `Toggle` | `@workspace/ui/components/toggle` | Acción booleana aislada con estado visible. |
| `ToggleGroup` | `@workspace/ui/components/toggle-group` | Conjunto compacto de opciones mutuamente relacionadas. |

## Formularios y selección

| Componente | Importación | Uso principal |
| --- | --- | --- |
| `Calendar` | `@workspace/ui/components/calendar` | Selección accesible de fechas; combinar con `Popover` para campos. |
| `Checkbox` | `@workspace/ui/components/checkbox` | Selección múltiple o booleana. |
| `Combobox` | `@workspace/ui/components/combobox` | Selección con búsqueda. |
| `Field` | `@workspace/ui/components/field` | Estructura, etiqueta, descripción y error de campos de formulario. |
| `Input` | `@workspace/ui/components/input` | Entrada de texto de una línea. |
| `InputGroup` | `@workspace/ui/components/input-group` | Campo con addons o acciones integradas. |
| `InputOTP` | `@workspace/ui/components/input-otp` | Captura segmentada de códigos de un solo uso. |
| `Label` | `@workspace/ui/components/label` | Etiqueta accesible para controles. |
| `NativeSelect` | `@workspace/ui/components/native-select` | Select nativo cuando la plataforma sea preferible. |
| `RadioGroup` | `@workspace/ui/components/radio-group` | Una opción entre alternativas exclusivas. |
| `Select` | `@workspace/ui/components/select` | Selecciones con opciones acotadas. |
| `Slider` | `@workspace/ui/components/slider` | Selección continua o de rango. |
| `Switch` | `@workspace/ui/components/switch` | Ajustes binarios inmediatos. |
| `Textarea` | `@workspace/ui/components/textarea` | Entrada de texto multilínea. |

## Superficies, datos y contenido

| Componente | Importación | Uso principal |
| --- | --- | --- |
| `AspectRatio` | `@workspace/ui/components/aspect-ratio` | Mantener proporciones de contenido visual. |
| `Attachment` | `@workspace/ui/components/attachment` | Presentación de adjuntos. |
| `Avatar` | `@workspace/ui/components/avatar` | Identidad visual de una persona o entidad; incluir fallback. |
| `Badge` | `@workspace/ui/components/badge` | Estados y etiquetas de dominio, incluidas variantes `success`, `warning` e `info`. |
| `Bubble` | `@workspace/ui/components/bubble` | Contenido compacto de conversación o estado. |
| `Card` | `@workspace/ui/components/card` | Superficies con variantes semánticas `subtle`, `surface`, `inset` e `interactive`. |
| `Carousel` | `@workspace/ui/components/carousel` | Colecciones navegables de elementos visuales. |
| `Chart` | `@workspace/ui/components/chart` | Gráficos con tokens compartidos. |
| `Item` | `@workspace/ui/components/item` | Filas y elementos compuestos reutilizables. |
| `Kbd` | `@workspace/ui/components/kbd` | Representación de atajos de teclado. |
| `Marker` | `@workspace/ui/components/marker` | Marcadores visuales pequeños y semánticos. |
| `Message` | `@workspace/ui/components/message` | Mensajes de conversación. |
| `MessageScroller` | `@workspace/ui/components/message-scroller` | Región de scroll para historiales de mensajes. |
| `Progress` | `@workspace/ui/components/progress` | Progreso determinado o indeterminado. |
| `Resizable` | `@workspace/ui/components/resizable` | Paneles redimensionables. |
| `ScrollArea` | `@workspace/ui/components/scroll-area` | Regiones con scroll contenido. |
| `Separator` | `@workspace/ui/components/separator` | Separación semántica entre bloques o acciones. |
| `Table` | `@workspace/ui/components/table` | Datos tabulares y listados operativos. |

## Feedback, overlays y utilidades de interfaz

| Componente | Importación | Uso principal |
| --- | --- | --- |
| `Alert` | `@workspace/ui/components/alert` | Avisos persistentes y mensajes de estado. |
| `AlertDialog` | `@workspace/ui/components/alert-dialog` | Confirmación de acciones destructivas o de riesgo. |
| `Dialog` | `@workspace/ui/components/dialog` | CRUD breve, confirmaciones y detalle puntual. |
| `Drawer` | `@workspace/ui/components/drawer` | Flujo contextual compacto, especialmente en móvil. |
| `Empty` | `@workspace/ui/components/empty` | Primitive compuesto para estados vacíos. |
| `EmptyState` | `@workspace/ui/components/empty-state` | Colecciones, rutas o permisos sin contenido útil. |
| `HoverCard` | `@workspace/ui/components/hover-card` | Información suplementaria al pasar el cursor. |
| `Popover` | `@workspace/ui/components/popover` | Contenido contextual anclado; contenedor de Calendar y controles compactos. |
| `Sheet` | `@workspace/ui/components/sheet` | Panel lateral accesible. |
| `Skeleton` | `@workspace/ui/components/skeleton` | Loading que conserva la forma del contenido. |
| `Sonner` | `@workspace/ui/components/sonner` | Adaptador de Sonner cuando se necesita su componente de host. |
| `Spinner` | `@workspace/ui/components/spinner` | Indicador de carga en acciones o regiones pequeñas. |
| `Toaster` / `toast` | `@workspace/ui/components/toast` | Feedback transitorio; no sustituye errores persistentes de formularios. |
| `Tooltip` | `@workspace/ui/components/tooltip` | Etiquetas contextuales para controles compactos. |

## Contexto y comportamiento compartido

| Componente | Importación | Uso principal |
| --- | --- | --- |
| `Direction` | `@workspace/ui/components/direction` | Proveer dirección de lectura cuando un flujo lo requiera. |

## Proceso obligatorio antes de crear un componente

1. Consultar `codebase-memory` para buscar primitives y patterns existentes en `packages/ui`.
2. Revisar este catálogo y los exports/variantes del archivo encontrado.
3. Consultar `componentes.md` solo si se necesita inspiración o un bloque 21st; no representa componentes instalados.
4. Reutilizar el componente existente cuando cubra la necesidad.
5. Si el componente es específico del dominio, crearlo en `features/<dominio>/components`.
6. Promoverlo a `packages/ui` solo si su contrato es genérico y será reutilizable en tres o más features.
7. Al promover o añadir uno global, actualizar este catálogo y respetar tokens, accesibilidad y validación de `docs/reglas/design.md`.
