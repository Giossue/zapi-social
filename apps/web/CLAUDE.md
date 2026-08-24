# apps/web

Rutas Next de Portal y Admin, layouts y composición de interfaz. Consume REST mediante `@workspace/api-client`; nunca accede a PostgreSQL, Redis ni credenciales de providers.

## Antes de editar

- UI, tokens, primitives, tablas, formularios y estados: [`docs/reglas/design.md`](../../docs/reglas/design.md) y [`packages/ui/COMPONENTS.md`](../../packages/ui/COMPONENTS.md).
- Cuando exista superficie equivalente en `../template-shadcn-superdashboard`, se copia su composición y solo se adaptan datos, rutas, handlers y permisos.
- Un componente de dominio vive en `features/<dominio>/components`; un primitive compartido, en `packages/ui`.
- Las tarjetas de Admin → Integraciones comparten `IntegrationSection`,
  `IntegrationInsetCard` y `IntegrationAvailabilityCard`. Un proveedor nuevo las
  reutiliza en vez de rehacer el bloque: es lo que hizo que Drive, SMTP y Polar
  divergieran de Meta.
- Textos e idiomas: [`docs/conocimiento/i18n.md`](../../docs/conocimiento/i18n.md) explica cómo añadir una clave, un argumento ICU o un idioma; [`docs/planes/i18n-v2.md`](../../docs/planes/i18n-v2.md) tiene la decisión y el alcance. Toda la interfaz lee su texto del catálogo de `packages/contracts/src/messages/` con clave semántica; los idiomas añadidos desde Admin se fusionan encima en `i18n/request.ts`.

## Antes de cerrar

```bash
bun run typecheck
bun run lint
bun run audit:portal-admin-ui
bun run audit:i18n
bun run audit:i18n-hardcoded
```

El auditor de UI cubre todas las rutas de Portal y Admin. No sustituye la
aprobación visual del usuario.

`audit:i18n-hardcoded` encuentra texto de interfaz escrito en el código, que es
justo lo que `audit:i18n` no puede ver: si una superficie nunca se migró, los
dos catálogos siguen sincronizados y ese auditor pasa.

Prohíbe **cualquier** literal en un nodo JSX, una prop de rótulo o una plantilla
con interpolación, sin mirar el idioma ni la longitud. Sus versiones anteriores
fallaron por acotar de más —buscar marcas del español dejaba pasar «Guardar
perfil»; pedir tres caracteres dejaba pasar «Tú»; mirar solo `apps/web` dejaba
pasar «1-1 de 1»; ir línea a línea dejaba pasar tanto el texto mezclado con una
expresión, `>Acceso de {member.name}<`, como el que Prettier reparte en varias
líneas—, y cada hueco solo se vio en pantalla. Por eso el comando se comprueba a
sí mismo contra casos conocidos antes de escanear: si deja de reconocerlos,
falla.

El nodo de texto se mira entero, no línea a línea: se sustituyen las expresiones
incrustadas por espacios y se juzga lo que queda, que es justo la parte fija que
hay que traducir.

Para no confundir código con texto descarta lo que no es interfaz: el argumento
de `t()`, los identificadores sin espacios, las listas de clases de Tailwind,
los comentarios y `console.*`.
