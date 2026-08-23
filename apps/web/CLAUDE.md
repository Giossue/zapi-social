# apps/web

Rutas Next de Portal y Admin, layouts y composición de interfaz. Consume REST mediante `@workspace/api-client`; nunca accede a PostgreSQL, Redis ni credenciales de providers.

## Antes de editar

- UI, tokens, primitives, tablas, formularios y estados: [`docs/reglas/design.md`](../../docs/reglas/design.md) y [`packages/ui/COMPONENTS.md`](../../packages/ui/COMPONENTS.md).
- Cuando exista superficie equivalente en `../template-shadcn-superdashboard`, se copia su composición y solo se adaptan datos, rutas, handlers y permisos.
- Un componente de dominio vive en `features/<dominio>/components`; un primitive compartido, en `packages/ui`.
- Textos e idiomas: [`docs/planes/i18n-v2.md`](../../docs/planes/i18n-v2.md). Las superficies migradas leen su texto de `messages/` con clave semántica; el resto lo conserva en el código hasta su tanda.

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
dos catálogos siguen sincronizados y ese auditor pasa. Falla mientras queden
superficies pendientes de la fase 2; el recuento vive en
[`docs/planes/i18n-v2.md`](../../docs/planes/i18n-v2.md).
