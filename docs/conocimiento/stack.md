Monorepo: Bun + Turborepo
Frontend: Next.js + React + TypeScript
UI: Tailwind CSS 4 + shadcn/ui Radix Nova + Lucide
UI bloques: 21st.dev MCP, adaptado a packages/ui
Backend: NestJS + Fastify + TypeScript
API: REST versionada + OpenAPI/Swagger
Cliente API: Orval/OpenAPI + openapi-fetch
Validación: Zod + nestjs-zod
Base datos: PostgreSQL 18
ORM: Drizzle ORM + postgres.js
Cache/colas: Redis 8 + ioredis + BullMQ
Worker: NestJS worker separado
Archivos: Volumen filesystem compartido entre API y Worker
Ingestión: packages/file-ingestion comparte MIME, firma y tipo entre API/Worker
Email local: Mailpit
Auth: JWT access/refresh + cookies HTTP-only + Passport
Passwords: Argon2
Logs: Pino + nestjs-pino
Tests web: Vitest + Testing Library + MSW + Playwright
Tests API: Jest inicialmente; migrable después si conviene
Formato/lint: ESLint + Prettier
Infra local: Podman + compose.yaml
