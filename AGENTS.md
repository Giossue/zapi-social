<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Before modifying Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Zapi V2 — guía operativa

## 1. Orientación documental obligatoria

Antes de afirmar cómo funciona algo o modificar un módulo, localizar la referencia en [`docs/README.md`](./docs/README.md).

```text
docs/conocimiento/  estado técnico y composición observada
docs/reglas/        normas obligatorias
docs/planes/        decisiones, equivalencias Laravel → V2 y pendientes
```

### Ruta de lectura por tipo de tarea

| Tarea | Leer |
| --- | --- |
| UI, ruta Next, Tailwind, shadcn, 21st o accesibilidad | `docs/reglas/design.md` antes de editar |
| Next.js | guía concreta en `node_modules/next/dist/docs/` antes de escribir código |
| Arquitectura, stack o responsabilidades | `docs/conocimiento/stack.md` |
| Despliegue, Dokploy o variables por servicio | `docs/conocimiento/deployment/dokploy.md` |
| Navegación y shell Portal | `docs/conocimiento/ui/portal-sidebar.md` |
| Prioridad global de V2 | `docs/planes/implementacion-v2.md` |
| Identidad, sesión, redirecciones, Admin o Portal | `docs/planes/separacion-admin-portal.md` |
| Channels y providers | `docs/planes/channels-v2.md` y `docs/planes/channels-providers.md` |

### Si no hay documentación suficiente

1. No inventar rutas, contratos, permisos, estados, decisiones ni configuración.
2. Buscar por nombre en `docs/`, después en contratos, schema, código y tests.
3. Para una equivalencia de producto, auditar `ZapiSocial` —rutas, módulo, vistas, modelo/tablas, permisos y acciones visibles— antes de inferir V2.
4. Si sigue siendo ambiguo, si faltan requisitos o si la operación es irreversible, pedir aclaración al usuario.
5. Si se inicia un módulo o se toma una decisión nueva, crear o actualizar un plan breve en `docs/planes/` con alcance, referencia Laravel, estado mock y pendiente; no presentar una inferencia como hecho.

## 2. Dirección de producto

```text
Laravel ZapiSocial = referencia funcional, visual y de schema.
ZapiV2 = producto nuevo.
Laravel → diseño Next con mocks → contrato REST → Nest.
```

No modificar Laravel en una tarea V2 salvo solicitud explícita. No implementar backend de un módulo antes de que diseño, mocks y acciones estén definidos, salvo solicitud explícita.

### Flujo por módulo V2

1. Localizar referencia Laravel y registrar la equivalencia mínima en el plan afectado.
2. Construir primero la ruta/pantalla Next con `fixtures` y repositorio `mock`.
3. Diseñar estados normal, loading, empty, error, permisos, móvil y claro/oscuro.
4. Reutilizar primitives de `packages/ui`; no recrear `Button`, `Dialog`, `Input`, `Select`, `Table`, `Toast` o `EmptyState`.
5. Auditar bloques 21st antes de integrarlos según `docs/reglas/design.md`.
6. Definir tipos y contrato REST cuando las acciones estén claras.
7. Implementar Nest/Drizzle/Redis después, sustituyendo el mock sin reescribir la composición UI.

## 3. Estructura y límites

```text
apps/web       # Next: rutas y UI
apps/api       # Nest Fastify: REST/OpenAPI
apps/worker    # BullMQ
packages/ui    # tokens y primitives compartidos
packages/contracts
packages/api-client
packages/database
infra/podman
```

- `packages/ui` es la fuente única de tokens y primitives reutilizables.
- `features/<dominio>` contiene componentes, fixtures, mocks, tipos y composición de dominio.
- `app/` define rutas y layouts; no concentra lógica de feature.
- Portal y Admin comparten tokens; no crear temas paralelos.
- Usar tokens semánticos y variantes; no colores raw ni overrides arbitrarios de primitives.
- Next no accede directamente a PostgreSQL ni Redis.
- Redis es cache, locks, rate limits y BullMQ; PostgreSQL es fuente de verdad.
- Nest expone DTOs REST versionados; no entidades Drizzle directamente.

## 4. Mocks y datos

- Fixtures, mocks, capturas y composiciones aprobadas son referencias de producto: no borrarlos, sobrescribirlos ni sustituirlos por datos reales sin orden explícita.
- Al conectar una API, conservar el mock aprobado en `features/<dominio>/fixtures` o documentar su reemplazo en el plan.
- Los fixtures son sintéticos y deterministas; nunca contienen datos de producción.

## 5. Seguridad y bases de datos

- Nunca leer, mostrar, versionar ni registrar `.env`, secretos, tokens, passwords, credenciales o archivos privados.
- Validar ownership, permisos e idempotencia al implementar backend.
- No ejecutar cambios sobre bases remotas sin solicitud explícita.

### PostgreSQL remoto

- Usar exclusivamente `psql "service=zapi_v2"`.
- Lecturas (`SELECT`, schema, conteos y `EXPLAIN`) están permitidas.
- Mutaciones, migraciones y cambios de permisos requieren aprobación explícita para esa operación.
- No incluir host, usuario, contraseña, URI ni secretos en código, documentos, comandos visibles o logs.

### PostgreSQL local

- Es una instalación nativa, no un contenedor.
- Para consultas o migraciones que requieran el rol `postgres`, solicitar y usar `pkexec runuser -u postgres`; inspeccionar antes de asumir el nombre de la base.

## 6. Validación y comunicación

- UI: typecheck, build/lint disponible, estados mock y revisión visual si hay navegador.
- API: typecheck, tests de módulo, OpenAPI y autorización.
- Datos: schema, migración, constraints y conteos relevantes.
- Refactors: alcance explícito, diff y búsqueda de residuos.
- No afirmar que algo funciona sin evidencia.

Responder en español, directo y sin inventar comportamiento. Antes de crear una pantalla, explicar qué módulo Laravel se replica y qué queda mock. Al terminar, indicar archivos cambiados, validación ejecutada, pendiente real y siguiente módulo recomendado.
