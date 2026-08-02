# Plan de implementación — Zapi V2

## Objetivo

Construir Zapi V2 como monorepo TypeScript independiente de Laravel. La aplicación nueva conserva dominios útiles del producto actual, pero reemplaza Blade, Livewire y Alpine por Next.js; el negocio y datos pasan a NestJS, PostgreSQL, Redis y workers.

## Decisiones cerradas

| Área | Decisión |
| --- | --- |
| Runtime y workspaces | Bun 1.3 + Turborepo |
| Web | Next.js App Router + React + TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui Radix Nova + Lucide |
| Bloques UI | 21st.dev MCP, revisados y normalizados antes de usar |
| Backend | NestJS sobre Fastify |
| API | REST versionada `/v1` + OpenAPI/Swagger |
| Contratos | Zod + `nestjs-zod`; cliente generado/consumido desde `@workspace/api-client` |
| Base de datos | PostgreSQL 18 + Drizzle ORM + `postgres.js` |
| Cache y jobs | Redis 8 + ioredis + BullMQ 5 |
| Archivos | MinIO local; S3 compatible en producción |
| Email local | Mailpit |
| Auth | Argon2 + JWT access/refresh + cookies HTTP-only + Passport |
| Logs | Pino + `nestjs-pino` |
| Tests | Jest Nest inicial; Vitest/Testing Library/MSW/Playwright para Web |
| Infra local | Podman + `infra/podman/compose.yaml` |

## Principios

```text
Next = UI y consumo REST.
Nest = reglas de negocio, permisos, API e integraciones.
Worker = trabajos lentos y reintentos.
PostgreSQL = fuente de verdad.
Redis = cache, locks, rate limits y colas; nunca fuente de verdad.
MinIO/S3 = archivos.
```

- Next no importa Drizzle ni consulta PostgreSQL.
- Web no recibe entidades Drizzle: Nest devuelve DTOs REST.
- Cada módulo Nest es dueño de su lógica y persistencia; otros módulos usan su API pública.
- Ningún componente 21st crea primitives duplicadas: `packages/ui` es fuente única de Button, Dialog, Input, Select, Table y estados comunes.
- No se migran módulos Laravel uno por uno. Se consolidan por dominio.

## Estructura objetivo

```text
ZapiV2/
├── apps/
│   ├── web/                 # Next.js: marketing, auth, Portal y Admin
│   ├── api/                 # Nest Fastify: REST/OpenAPI
│   └── worker/              # Nest application context + BullMQ
├── packages/
│   ├── ui/                  # shadcn Core, tokens y patterns compartidos
│   ├── contracts/           # Zod schemas, enums y DTOs sin persistencia
│   ├── api-client/          # cliente REST tipado/OpenAPI
│   ├── database/            # Drizzle schema, migraciones y cliente PostgreSQL
│   ├── eslint-config/
│   └── typescript-config/
├── infra/
│   └── podman/
├── docs/
│   ├── conocimiento/
│   ├── reglas/
│   └── planes/
├── turbo.json
└── package.json
```

## Dominios V2

| Dominio | Agrupa Laravel actual |
| --- | --- |
| `identity` | Fortify, usuarios, perfil, login social |
| `workspaces` | Teams, Groups, miembros, permisos de workspace |
| `channels` | AppChannels y proveedores Facebook, Instagram, X, LinkedIn, TikTok, WhatsApp |
| `publishing` | publicaciones, captions, bulk posts, RSS, watermarks, URL shorteners |
| `ai` | AI Studio, planner, content, image, video, review, semantic search |
| `automation` | API keys, webhooks, logs y reglas |
| `files` | archivos, media, avatars y storage |
| `integrations` | OAuth, credenciales de proveedor y health externo |
| `commerce` | planes, billing, pagos, créditos, cupones, afiliados, marketplace |
| `content` | blogs, FAQ, idiomas y páginas públicas |
| `support` | tickets, categorías, comentarios y etiquetas |
| `admin` | capacidades administrativas sobre dominios, no backend duplicado |

## REST API

Convención:

```text
GET    /v1/channels
POST   /v1/channels
GET    /v1/channels/:channelId
PATCH  /v1/channels/:channelId
DELETE /v1/channels/:channelId
```

- Auth y workspace se resuelven en guards/middleware, no desde identificadores enviados sin validar.
- OpenAPI se publica en `/api/docs`.
- Cliente Web se genera desde especificación o se mantiene en `@workspace/api-client`.
- Webhooks usan endpoints separados, firma validada e idempotencia.

## Redis y Worker

Redis local: `127.0.0.1:6379`.

Prefijos:

```text
zapi:cache:*
zapi:lock:*
zapi:queue:*
zapi:rate-limit:*
zapi:session:*
```

Colas iniciales:

```text
ai
email
publishing
integrations
media
notifications
```

Cada job requiere ID estable, idempotencia, reintentos limitados, logs y estado de negocio en PostgreSQL.

## Infraestructura local

| Servicio | Puerto host | Propósito |
| --- | ---: | --- |
| PostgreSQL 18.4 | `5433` | datos locales |
| Redis 8 | `6379` | cache, locks, BullMQ |
| Mailpit SMTP | `1025` | captura de emails |
| Mailpit UI | `8025` | inspección de emails |
| MinIO API | `9000` | S3 local |
| MinIO Console | `9001` | administración local |
| Nest API | `3001` | REST y Swagger |
| Next Web | `3000` | interfaz |

Credenciales locales viven en `.env` ignorado. Solo `infra/podman/.env.example` se versiona.

## Fases

### Fase 0 — Foundation

- [x] Bun + Turbo monorepo.
- [x] Next, Nest API, Nest Worker, shadcn Radix Nova.
- [x] Paquetes `ui`, `contracts`, `database`, `api-client`.
- [x] Redis y Mailpit locales.
- [x] PostgreSQL 18.4 schema-only local.
- [ ] MinIO local con secreto fuera de Git.
- [ ] `AppModule` usa config Zod y health real PostgreSQL/Redis.
- [ ] API Fastify elimina scaffold Express y tests Express.
- [ ] Worker registra primeros processors sin HTTP.

### Fase 1 — Contratos y acceso a datos

- [ ] Crear cliente Drizzle y migraciones V2, sin reutilizar entidades Laravel.
- [ ] Definir schemas `identity`, `workspaces` y errores REST en `contracts`.
- [ ] Exponer OpenAPI y generar `api-client`.
- [ ] Configurar cookies, CORS, rate limits y logs estructurados.

### Fase 2 — Identidad y workspaces

- [ ] Registro, login, refresh, logout, recuperación y verificación de email.
- [ ] Roles, super admin, membresía de workspace y autorización.
- [ ] Web auth, layouts `(auth)` y `(workspace)`.

### Fase 3 — UI system y shell

- [ ] Leer `componentes.md` y evaluar bloques 21st uno por uno.
- [ ] Añadir primitives shadcn necesarias por CLI y documentar API.
- [ ] Construir shell Portal/Admin, navegación, command menu, feedback, loading, empty/error states.
- [ ] Tokens claro/oscuro y catálogo interno de componentes.

### Fase 4 — Vertical Channels

- [ ] API Channels con ownership por workspace.
- [ ] UI listado, filtros, edición simple, estado, delete y reconnect.
- [ ] Drivers OAuth por proveedor y jobs de refresh.
- [ ] Migrar datos de prueba; no copiar tokens producción sin plan explícito.

### Fase 5 — Publishing e IA

- [ ] Publicación, campañas, scheduler y workers idempotentes.
- [ ] Media/MinIO, captions, watermarks y RSS.
- [ ] AI Studio y límites de créditos.

### Fase 6 — Commerce, support, automation y admin

- [ ] Planes, pagos, créditos, afiliados y webhooks.
- [ ] Tickets, notificaciones, API keys y automatización.
- [ ] Admin sobre mismos módulos de dominio.

### Fase 7 — Migración y corte

- [ ] Inventario de datos Laravel por dominio.
- [ ] Migraciones aditivas y scripts re-ejecutables.
- [ ] Backfill, validación de conteos/FK y rollback.
- [ ] Feature flags, shadow traffic cuando aplique y retiro legacy por consumidor.

## Criterios de calidad

Cada vertical se cierra solo con:

- contratos Zod, DTO REST y autorización;
- migración Drizzle reversible cuando sea práctico;
- tests de dominio/API y estados Web;
- loading, empty, error, permisos, responsive y accesibilidad;
- logs y jobs idempotentes cuando exista async;
- OpenAPI actualizada;
- sin acceso Web directo a PostgreSQL o Redis.

## Estado actual

Foundation instalada. API Fastify y Worker existen, pero falta conectar configuración tipada/health al módulo y reemplazar el scaffold Nest restante. No hay funcionalidad de producto migrada todavía.
