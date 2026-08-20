# Zapi V2

Monorepo de Zapi V2: Portal y Admin en Next.js, API REST en Nest/Fastify, Worker de trabajos asíncronos y paquetes compartidos de contrato, cliente, base de datos y UI.

`ZapiSocial` (Laravel) es la referencia funcional que se audita; no es la arquitectura objetivo. `diseño ideal` es la fuente visual canónica.

## Estructura

```text
apps/web                  Rutas Next de Portal y Admin
apps/api                  REST /v1 con Nest sobre Fastify
apps/worker               Consumidores BullMQ, reintentos y sincronizaciones
packages/ui               Tokens, primitives y patterns compartidos
packages/contracts        Schemas Zod, DTOs y errores públicos
packages/api-client       Cliente REST tipado
packages/database         Schema Drizzle, migraciones y cliente PostgreSQL
packages/file-ingestion   Política compartida de validación de binarios
```

Los límites entre áreas y las dependencias permitidas están en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Requisitos

- Bun 1.3 como gestor de paquetes y runtime de scripts.
- Node.js 20 o superior.
- PostgreSQL y Redis alcanzables por API y Worker.

## Comandos

```bash
bun install          # instalar dependencias del workspace
bun run dev          # levantar todas las apps
bun run format       # prettier sobre el workspace
bun run lint         # eslint por paquete
bun run typecheck    # tsc --noEmit por paquete
bun run build        # build de todas las apps
```

Migraciones desde `packages/database`:

```bash
bun run db:generate  # generar migración a partir del schema Drizzle
bun run db:migrate   # aplicar migraciones pendientes
```

Auditoría estática de las rutas de Portal y Admin:

```bash
bun run audit:portal-admin-ui
```

## Componentes de interfaz

Los primitives viven en `packages/ui/src/components` y se consumen como `@workspace/ui/components/<nombre>`. El inventario está en [`packages/ui/COMPONENTS.md`](./packages/ui/COMPONENTS.md) y las normas de uso en [`docs/reglas/design.md`](./docs/reglas/design.md).

Para incorporar un bloque de shadcn dentro del paquete compartido:

```bash
bunx shadcn@latest add button -c packages/ui
```

## Trabajar en este repositorio

[`CLAUDE.md`](./CLAUDE.md) es el índice de trabajo para agentes y personas: indica qué leer antes de tocar cada área. `AGENTS.md` es un enlace al mismo archivo para los agentes que buscan ese nombre.

- Normas obligatorias: [`docs/reglas/`](./docs/reglas/)
- Estado técnico observado: [`docs/conocimiento/`](./docs/conocimiento/)
- Decisiones y trabajo por vertical: [`docs/planes/`](./docs/planes/)

No se versionan secretos, tokens ni valores de `.env`.
