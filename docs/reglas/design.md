# Reglas de diseño e integración UI

## Fuente de verdad

`packages/ui` es fuente única de tokens y primitives reutilizables.

```text
Tokens → shadcn primitives → patterns compartidos → features → rutas Next
```

Portal y Admin usan el mismo `ThemeProvider`, los mismos tokens y los mismos primitives de `packages/ui`. Diferencia entre áreas vive en información, permisos y navegación; no en un segundo tema, CSS global, paleta, tipografía, radios, sombras o conjunto duplicado de primitives.

Para un mismo rol visual, ambas áreas usan el mismo primitive y la misma variante: por ejemplo, un card de resumen no puede ser `surface` en Admin y `subtle` en Portal sin una razón funcional documentada. La composición puede variar, pero no su identidad visual.

## Tokens

- Usar tokens semánticos: `background`, `foreground`, `card`, `primary`, `muted`, `accent`, `success`, `warning`, `info`, `destructive`, `border`, `ring`, `sidebar`, `chart-*`.
- No usar colores raw (`bg-blue-500`, hex, `dark:bg-*`) en features o rutas.
- No redefinir `:root`, `.dark`, radios, sombras ni tipografía fuera de `packages/ui/src/styles/globals.css`.
- `className` compone layout, ancho, posición, grid y spacing. No reescribe estilo visual de una primitive.
- No usar hero cards: evitar cards introductorias grandes con eyebrow, icono y descripción que duplican el contexto de la ruta. La pantalla empieza con su contenido operativo.
- No duplicar el título ni la descripción de una ruta cuando el shell ya los muestra en su encabezado. La ruta empieza por acciones o contenido operativo.

### Política de uso de color

Los tokens expresan roles de interfaz; no son una paleta libre para elegir por gusto. Portal y Admin aplican esta misma tabla.

| Rol visual                     | Token o primitive obligatorio                                                                        | Uso                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Lienzo de aplicación           | `background`                                                                                         | Fondo de la página y áreas no elevadas.                                                                                  |
| Estructura de navegación       | `sidebar`, `sidebar-border`, `sidebar-primary`                                                       | Sidebar y header del shell, en ambas áreas.                                                                              |
| Contenido estándar             | `Card variant="subtle"`                                                                              | Resúmenes, inventarios, paneles operativos y loading equivalente. Es la variante base compartida.                        |
| Contenido elevado              | `Card` por defecto                                                                                   | Solo overlays, bloques que flotan sobre otro contenido o cuando la elevación comunica prioridad.                         |
| Superficie densa sin elevación | `Card variant="surface"`                                                                             | Formularios o paneles compactos dentro de una superficie ya agrupada; no como variante estética alternativa de `subtle`. |
| Superficie subordinada         | `Card variant="inset"`                                                                               | Contenido interno, pasos, avisos o bloques contenidos dentro de un card padre.                                           |
| Acción principal               | `Button` por defecto (`primary`)                                                                     | Una acción principal por contexto.                                                                                       |
| Acción secundaria              | `Button variant="brand-secondary"` o `surface`                                                       | Acciones auxiliares; elegir por contexto, no para inventar color.                                                        |
| Selección y navegación activa  | `sidebar-active`, `accent` o `primary` mediante primitive                                            | Estado activo; nunca un color local.                                                                                     |
| Estado de dominio              | `success`, `warning`, `info`, `destructive` mediante `Badge`, `Alert`, `Toast` o primitive existente | Éxito, advertencia, información y error. No usar `primary` para comunicar salud o peligro.                               |

No aplicar clases de color a un primitive para cambiar su apariencia (`bg-*`, `text-*`, `border-*`, `dark:*`). Si falta un rol visual, se amplía el token o la variante en `packages/ui` con una decisión documentada, antes de usarlo en una feature.

### Política de elevación y sombras

Las sombras son tokens globales, no decoración por pantalla:

| Nivel          | Fuente                                        | Cuándo usarlo                                              |
| -------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Sin elevación  | `Card variant="surface"`, `outline` o `inset` | Contenido integrado al plano actual.                       |
| Sutil          | `Card variant="subtle"` → `--shadow-xs`       | Cards estándar de producto.                                |
| Elevación base | `Card` por defecto → `--shadow-sm`            | Elementos que deben distinguirse del lienzo.               |
| Elevación alta | `--shadow-md` desde un primitive compartido   | Solo dialog, popover, menu o drawer; no desde una feature. |

Features, rutas y shells no escriben `shadow-*`, `box-shadow`, `filter: drop-shadow()` ni valores de sombra locales. Los cambios de elevación se realizan en `packages/ui/src/styles/globals.css` o en la variante compartida correspondiente.

## Primitives

Antes de crear markup o un componente, ejecutar `codebase-memory` para comprobar qué existe realmente en `packages/ui` y revisar el [catálogo global](../../packages/ui/COMPONENTS.md). No responder por memoria ni asumir que un componente falta.

- `componentes.md` contiene candidatos/comandos de 21st; no es el catálogo de componentes instalados. Consultarlo solo para inspiración o bloques externos.
- Reutilizar el primitive o variante existente antes de crear uno nuevo. No duplicar `Button`, `Dialog`, `Input`, `Select`, `Table`, `Tooltip`, `Toast`, `Empty`, `Alert`, `Badge`, `Card` o `Skeleton`.
- No usar `Button` con `variant="ghost"` en producto. Las acciones secundarias, incluidas cancelar, cerrar e iconos, usan `variant="brand-secondary"`. La variante `ghost` permanece solo por compatibilidad interna hasta eliminarla de `packages/ui`.
- Formularios usan primitives/Field actuales; no inputs estilizados locales.
- Modal, dropdown, tooltip y drawer conservan primitive accesible; no z-index ni focus trap locales.
- Un componente específico de dominio permanece en `features/<dominio>/components`.
- Las tablas operativas paginadas usan `TablePagination`; no duplicar ese footer en una feature. Usar modo `compact` cuando el footer solo requiere rango y flechas —para datos remotos o locales— y modo `detailed` cuando la tabla necesita selector de filas, página y controles primera/anterior/siguiente/última.
- Un pattern pasa a `packages/ui` solo si su contrato es genérico y será reutilizable por tres o más features. Todo primitive o pattern global añadido, creado o promovido debe añadir o actualizar su fila en `packages/ui/COMPONENTS.md` dentro del mismo cambio.

## 21st.dev MCP y CLI

21st es fuente de referencia y bloques, no fuente automática de arquitectura.

Proceso obligatorio:

```text
1. Definir pantalla/estado mock.
2. Buscar o recuperar bloque por MCP.
3. Auditar markup, deps, primitives, tokens y accesibilidad.
4. Extraer solo composición útil.
5. Reemplazar primitives del bloque por packages/ui.
6. Adaptar clases a tokens semánticos.
7. Integrar dentro feature o pattern correcto.
8. Typecheck/build y revisión visual.
```

Nunca ejecutar todos los comandos de `componentes.md` en lote.

Rechazar o adaptar antes de integrar bloques que traigan:

```text
:root o .dark propios
CSS global
Button/Input/Dialog/Tooltip duplicados
colores raw
radii/sombras locales arbitrarias
deps grandes sin necesidad
estado mock incrustado como arquitectura final
```

Un `npx`/CLI 21st solo se ejecuta cuando destino está claro (`apps/web` o `packages/ui`) y se revisa diff inmediatamente. Preferir MCP + adaptación manual para bloques de layout.

## Diseño primero

```text
Laravel referencia → pantalla Next → fixtures/mock → estados UI → contrato REST → Nest
```

- No implementar backend de módulo antes de aprobar diseño, estados y acciones mock, salvo solicitud explícita.
- Fixtures son sintéticos, deterministas y nunca incluyen datos/tokens producción.
- Cada pantalla cubre normal, loading, empty, error, permisos, móvil y claro/oscuro cuando aplique.
- Los `EmptyState` operativos usan el tamaño de icono de las metric cards (`size-5`) como escala base. No repetir dentro del empty state una acción primaria que ya está disponible de forma persistente en el encabezado de la misma pantalla; se permiten acciones contextuales no redundantes, como **Reintentar** ante un error o **Limpiar filtros** ante una búsqueda sin resultados.
- Next no accede directamente a PostgreSQL ni Redis.

## Rendimiento React/Next

- Server Components por defecto; usar `"use client"` solo para interacción real.
- Importar rutas directas; evitar barrel imports pesados.
- No añadir librería pesada por un bloque visual sin necesidad demostrada.
- Lazy load para editores, charts o viewers pesados cuando no sean visibles inicialmente.
- Estado estático y arrays de navegación viven a nivel módulo; no se recrean por render.
- No crear componentes dentro componentes. No usar memo para expresiones simples.

## Validación

Toda integración UI termina con:

```text
typecheck
build/lint disponible
diff sin CSS/tokens duplicados
revisión visual manual cuando exista navegador
```

## Calidad

Para Definition of Done, pruebas, revisión y validación proporcional, consultar [calidad.md](./calidad.md).


## Regla source-first para `diseño ideal`

`../diseño ideal` es la fuente visual obligatoria cuando contiene una superficie equivalente. No es una referencia estética ni un catálogo de inspiración.

```text
Fuente `diseño ideal`
→ copiar página/componente, JSX, clases, primitives, densidad, responsive y estados visuales

Destino ZapiV2
→ reemplazar solo textos, datos, rutas, callbacks, sesión, permisos y estados reales
```

Para cada feature:

1. Auditar primero su comportamiento completo: datos, botones, modales, loading, empty, error, permisos, pending y efectos externos.
2. Localizar la página/componente fuente equivalente en `diseño ideal`.
3. Eliminar la composición visual de dominio V2 existente.
4. Crear la nueva composición copiando la fuente; conservar comportamiento mediante props, hooks o adapters Zapi.
5. Registrar cualquier divergencia indispensable por falta de dato/acción equivalente; no introducir datos ficticios para aparentar equivalencia.

Queda prohibido crear un componente de dominio “inspirado” o una versión visual Zapi de la fuente. Cambiar una `Card`, `Button`, `Dialog`, tabla o layout de la fuente para acomodar estilos/variantes V2 previas incumple esta regla.

### Protocolo obligatorio fuente → copia

1. Auditar todos los estados y efectos de la feature V2 antes de diseñar: normal, loading, empty, error, permiso, pending, modal y responsive.
2. Buscar una fuente exacta en `diseño ideal`. Si existe, copiar DOM, clases, primitives, spacing y responsive sin reinterpretarlos.
3. Si no existe fuente exacta, no ensamblar un sustituto dentro de V2. Crear primero un componente canónico co-localizado en `diseño ideal`, con ruta o demo navegable para revisarlo; después copiarlo literalmente a la feature V2.
4. Mantener la lógica V2 mediante props, hooks o adapters. Solo son adaptables contenido, tipos, datos, handlers, rutas, permisos, sesión y accesibilidad indispensable.
5. Auditar tokens antes de crear alguno. Un token nuevo se añade primero a la fuente `diseño ideal`, incluyendo claro/oscuro; la copia V2 solo refleja ese token cuando lo consume.
6. No crear variantes, aliases, sombras, colores raw ni estilos compensatorios locales en V2. Una divergencia visual indispensable se documenta en el plan antes de aceptarla.
7. Validar la fuente y el consumidor tras cambios compartidos: formato/check/build/lint disponible en ambos repositorios, `git diff --check` y smoke visual cuando haya navegador.
8. Al cerrar una iteración, dejar la superficie pausada. Se reabre exclusivamente por una solicitud de producto nueva; no se hacen retoques preventivos.
