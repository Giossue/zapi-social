# apps/api

REST `/v1` con Nest sobre Fastify: sesión, autorización, ownership, DTOs, OpenAPI y casos de uso. No expone entidades Drizzle ni ejecuta trabajo lento dentro del request.

## Antes de editar

- Sesión, área, ownership, secretos y validación de entrada: [`docs/reglas/seguridad.md`](../../docs/reglas/seguridad.md).
- Cada handler autenticado empieza por `requirePortalSession` o `requirePlatformAdmin` de `SessionAccessService`.
- El cuerpo y la query entran como `unknown` y se validan con el schema Zod de `packages/contracts`.
- Un cambio de schema o de datos usa el skill `create-drizzle-migration` y las normas de [`docs/reglas/workflow.md`](../../docs/reglas/workflow.md).

## Antes de cerrar

```bash
bun run typecheck
bun run test
```
