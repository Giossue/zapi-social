# apps/worker

Consumidores BullMQ, reintentos, sincronizaciones e idempotencia. No expone HTTP público ni duplica las reglas de autorización de la API.

## Antes de editar

- Un job es idempotente por su identificador de negocio y conserva su estado en PostgreSQL: la cola no es la única evidencia de progreso.
- Los reintentos son limitados y los logs redactan secretos; ver [`docs/reglas/seguridad.md`](../../docs/reglas/seguridad.md).
- La autorización comprobada en API se vuelve a verificar aquí cuando el trabajo actúa sobre datos de un workspace.

## Antes de cerrar

```bash
bun run typecheck
bun run test
```
