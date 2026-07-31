# Reglas de diseño e integración UI

## Fuente de verdad

`packages/ui` es fuente única de tokens y primitives reutilizables.

```text
Tokens → shadcn primitives → patterns compartidos → features → rutas Next
```

Portal y Admin usan mismos tokens. Diferencia entre áreas vive en composición, información, permisos y navegación; no en un segundo tema, CSS global o conjunto duplicado de primitives.

## Tokens

- Usar tokens semánticos: `background`, `foreground`, `card`, `primary`, `muted`, `accent`, `success`, `warning`, `info`, `destructive`, `border`, `ring`, `sidebar`, `chart-*`.
- No usar colores raw (`bg-blue-500`, hex, `dark:bg-*`) en features o rutas.
- No redefinir `:root`, `.dark`, radios, sombras ni tipografía fuera de `packages/ui/src/styles/globals.css`.
- `className` compone layout, ancho, posición, grid y spacing. No reescribe estilo visual de una primitive.

## Primitives

Antes de crear markup propio, comprobar `packages/ui` y shadcn.

- No duplicar `Button`, `Dialog`, `Input`, `Select`, `Table`, `Tooltip`, `Toast`, `Empty`, `Alert`, `Badge`, `Card` o `Skeleton`.
- Formularios usan primitives/Field actuales; no inputs estilizados locales.
- Modal, dropdown, tooltip y drawer conservan primitive accesible; no z-index ni focus trap locales.
- Un pattern pasa a `packages/ui` solo si es reusable por tres o más features. Si no, permanece en `features/<dominio>/components`.

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
