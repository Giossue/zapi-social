# apps/web

Rutas Next de Portal y Admin, layouts y composición de interfaz. Consume REST mediante `@workspace/api-client`; nunca accede a PostgreSQL, Redis ni credenciales de providers.

## Antes de editar

- UI, tokens, primitives, tablas, formularios y estados: [`docs/reglas/design.md`](../../docs/reglas/design.md) y [`packages/ui/COMPONENTS.md`](../../packages/ui/COMPONENTS.md).
- Cuando exista superficie equivalente en `../template-shadcn-superdashboard`, se copia su composición y solo se adaptan datos, rutas, handlers y permisos.
- Un componente de dominio vive en `features/<dominio>/components`; un primitive compartido, en `packages/ui`.

## Antes de cerrar

```bash
bun run typecheck
bun run lint
bun run audit:portal-admin-ui
```

El auditor cubre todas las rutas de Portal y Admin. No sustituye la aprobación visual del usuario.
