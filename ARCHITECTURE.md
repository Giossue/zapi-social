# Arquitectura Zapi V2

## Dirección de producto

```text
ZapiSocial auditado
→ equivalencia V2 documentada
→ UI Next con fixtures y repositorio mock
→ estados y acciones definidos
→ contrato REST/Zod + OpenAPI
→ Nest/Fastify + Drizzle + Worker
```

Laravel es la referencia funcional, visual y de datos; no es la arquitectura objetivo. Zapi V2 conserva el comportamiento útil y registra explícitamente mejoras, divergencias y trabajo pendiente.

## Límites del monorepo

| Área                      | Responsabilidad                                                                                     | No debe hacer                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web`                | Rutas Next, layouts y composición UI; consumo REST mediante `@workspace/api-client`.                | Acceder a PostgreSQL, Redis o credenciales de providers.                      |
| `apps/api`                | REST `/v1`, auth, autorización, ownership, DTOs, OpenAPI y casos de uso.                            | Exponer entidades Drizzle o ejecutar trabajo lento en el request.             |
| `apps/worker`             | Procesar BullMQ, reintentos, sincronizaciones e idempotencia.                                       | Exponer HTTP público o duplicar reglas de autorización de API.                |
| `packages/ui`             | Tokens, primitives y patterns reutilizables.                                                        | Contener lógica de dominio o datos de features.                               |
| `packages/contracts`      | Schemas Zod, DTOs, enums y errores públicos.                                                        | Importar Nest, Drizzle o infraestructura.                                     |
| `packages/api-client`     | Cliente REST tipado derivado del contrato/OpenAPI.                                                  | Contener reglas de negocio o acceso directo a datos.                          |
| `packages/database`       | Schema Drizzle, migraciones y cliente PostgreSQL.                                                   | Ser importado desde Web.                                                      |
| `packages/file-ingestion` | Política pura y compartida de MIME, extensión, firma binaria, tipo y límite para entradas de Files. | Acceder a base de datos, filesystem, HTTP, secretos o lógica de autorización. |

## Dependencias permitidas

```text
apps/web    → packages/ui, packages/contracts, packages/api-client
apps/api    → packages/contracts, packages/database
apps/worker → packages/contracts, packages/database
apps/api y apps/worker → providers externos mediante adapters server-side
apps/api y apps/worker → packages/file-ingestion para validar binarios con una sola política
```

## Datos y ejecución

- PostgreSQL es la fuente de verdad.
- Redis se usa para cache, locks, rate limits y BullMQ; no modela estado de negocio durable.
- API y Worker validan configuración al arrancar y redactan secretos en logs.
- Web nunca recibe credenciales, tokens de provider, URL de PostgreSQL, configuración Redis ni claves de cifrado.
- Una operación asíncrona conserva su estado de negocio en PostgreSQL; el job no es la única evidencia de progreso.

## Lectura relacionada

- [Índice documental](./docs/README.md)
- [Stack observado](./docs/conocimiento/stack.md)
- [Reglas de diseño](./docs/reglas/design.md)
- [Reglas de calidad](./docs/reglas/calidad.md)
- [Plan global](./docs/planes/implementacion-v2.md)
- [Separación Admin y Portal](./docs/planes/separacion-admin-portal.md)
