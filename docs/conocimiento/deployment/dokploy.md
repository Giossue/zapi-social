# Despliegue en Dokploy

## Objetivo

Zapi V2 se despliega desde el mismo repositorio como servicios separados. La separación mantiene responsabilidades, secretos y dominios claros:

```text
Internet
├── app.zapisocial.com  → Web Next.js
└── api.zapisocial.com  → API Nest
                             ├── PostgreSQL
                             └── Redis / BullMQ
```

El worker se despliega como servicio interno sin dominio público. Procesa BullMQ para sincronización de perfiles; comparte PostgreSQL, Redis y la clave de cifrado de API.

## Repositorio y rama

Ambos servicios usan:

```text
Repositorio: Giossue/zapi-social
Rama: master
Build path: /
Trigger: On Push
Submódulos: desactivados
```

## DNS y dominios

En Namecheap deben existir registros `A` hacia la IP pública del servidor Dokploy:

| Host  | Destino         | Servicio Dokploy | Puerto interno |
| ----- | --------------- | ---------------- | -------------: |
| `app` | IP del servidor | Web              |           3000 |
| `api` | IP del servidor | API              |           3001 |

Los dominios configurados en Dokploy son:

```text
Web: https://app.zapisocial.com
API: https://api.zapisocial.com
```

Activar certificados HTTPS en ambos. No exponer PostgreSQL ni Redis como dominios públicos.

## Dockerfiles

Los dos servicios se construyen con contexto raíz porque dependen de workspaces compartidos.

| Servicio | Build type | Dockerfile       | Context path | Build stage |
| -------- | ---------- | ---------------- | ------------ | ----------- |
| Web      | Dockerfile | `Dockerfile.web` | `.`          | vacío       |
| API      | Dockerfile | `Dockerfile.api` | `.`          | vacío       |

Los Dockerfiles se validaron con Podman. No definir un Start Command manual en Dokploy: debe usar el `CMD` de la imagen.

## Perfil operativo actual

Los valores sensibles permanecen únicamente en Dokploy. En esta guía, `configurado en Dokploy` significa que el servicio tiene el valor real sin exponerlo en el repositorio.

| Servicio | Entorno actual |
| --- | --- |
| Web Next | `NODE_ENV=production`, `INTERNAL_API_ORIGIN=https://api.zapisocial.com` |
| API Nest | `NODE_ENV=production`, `API_HOST=0.0.0.0`, `API_PORT=3001`, `API_PUBLIC_ORIGIN=https://api.zapisocial.com`, `WEB_ORIGIN=https://app.zapisocial.com`, `COOKIE_SECURE=true`, `LOG_LEVEL=info`; base de datos, JWT, Redis y cifrado configurados en Dokploy. |
| Worker Nest | Servicio interno; comparte base de datos, Redis y clave de cifrado configurados en Dokploy con API. |

La etiqueta visual de un servicio en Dokploy no cambia esta responsabilidad: el bloque con `API_HOST`/`API_PORT` pertenece a API y el bloque con `INTERNAL_API_ORIGIN` pertenece a Web.

## Variables por servicio

### Web Next.js

Solo necesita variables de ejecución y build relacionadas con el proxy hacia API:

```dotenv
NODE_ENV=production
INTERNAL_API_ORIGIN=https://api.zapisocial.com
```

`INTERNAL_API_ORIGIN` debe estar disponible durante el build y runtime porque `next.config.ts` construye el rewrite `/api/*`.

La web **no** recibe:

```text
DATABASE_URL
REDIS_*
JWT_ACCESS_SECRET
COOKIE_SECURE
PROVIDER_INTEGRATIONS_ENCRYPTION_KEY
```

### Worker Nest

No expone dominio ni puerto público. Usa el mismo contexto raíz y el Dockerfile/servicio Worker configurado en Dokploy.

```dotenv
NODE_ENV=production
DATABASE_URL=POSTGRES_CONNECTION_SECRET
REDIS_HOST=REDIS_SERVICE_HOST
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=REDIS_PASSWORD
PROVIDER_INTEGRATIONS_ENCRYPTION_KEY=THE_SAME_STABLE_API_KEY
LOG_LEVEL=info
```

- `DATABASE_URL`, Redis y `PROVIDER_INTEGRATIONS_ENCRYPTION_KEY` son secretos del servicio Worker.
- La clave de cifrado debe ser exactamente la misma que API para poder descifrar tokens de cuentas ya conectadas.
- El Worker no recibe `JWT_ACCESS_SECRET`, `WEB_ORIGIN`, callbacks OAuth ni dominio público.
- El sync de perfiles Meta se programa internamente cada cinco minutos y no requiere cron externo.

### API Nest

```dotenv
NODE_ENV=production
API_HOST=0.0.0.0
API_PORT=3001
API_PUBLIC_ORIGIN=https://api.zapisocial.com
WEB_ORIGIN=https://app.zapisocial.com
DATABASE_URL=postgresql://USER:PASSWORD@POSTGRES_HOST:5432/zapi_v2
JWT_ACCESS_SECRET=GENERATED_LONG_SECRET
COOKIE_SECURE=true
REDIS_HOST=REDIS_SERVICE_HOST
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=REDIS_PASSWORD
LOG_LEVEL=info
PROVIDER_INTEGRATIONS_ENCRYPTION_KEY=BASE64_32_BYTE_KEY
```

Notas:

- `API_PUBLIC_ORIGIN` recibe callbacks OAuth y debe ser un dominio HTTPS público.
- `WEB_ORIGIN` es el único origen permitido por CORS con cookies.
- `DATABASE_URL`, JWT, Redis y clave de cifrado son secretos de Dokploy: nunca se versionan ni se copian a documentación, issues o chat.
- `PROVIDER_INTEGRATIONS_ENCRYPTION_KEY` debe mantenerse estable. Rotarla requiere un proceso explícito de re-cifrado de configuraciones OAuth existentes.
- Redis autenticado usa `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME` y `REDIS_PASSWORD` separados. No usar una URL Redis como valor de `REDIS_HOST`.

## Base de datos y migraciones

La base de producción usa PostgreSQL y requiere:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Después de que API tenga un `DATABASE_URL` válido, ejecutar una vez por release que incluya migraciones:

```bash
bun --filter @workspace/database db:migrate
```

Migraciones de producción verificadas el 2026-08-04:

```text
0000_chemical_proudstar.sql … 0015_lyrical_cargill.sql
```

La base tenía físicamente `0009`–`0011` sin sus filas en
`drizzle.__drizzle_migrations`. Se verificaron tablas, claves e índices antes de
registrarlos como baseline; Drizzle aplicó después `0012`–`0015` normalmente.
No se modificaron ni eliminaron filas de `file_assets` durante esa operación.

No ejecutar SQL destructivo ni aplicar migraciones sobre una base remota sin autorización explícita.

## Seed inicial de usuarios

La seed es manual e idempotente: crea o reutiliza un owner y un member en el mismo workspace, sin escribir credenciales al repositorio.

Agregar temporalmente como secretos en API:

```dotenv
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=CHOOSE_A_STRONG_PASSWORD
SEED_ADMIN_DISPLAY_NAME=Zapi Admin
SEED_MEMBER_EMAIL=member@example.com
SEED_MEMBER_PASSWORD=CHOOSE_A_STRONG_PASSWORD
SEED_MEMBER_DISPLAY_NAME=Zapi Member
```

Ejecutar una vez en la consola del contenedor API:

```bash
bun run --filter api seed:users
```

Después de confirmar el login, borrar las seis variables `SEED_*` de Dokploy. La seed nunca imprime emails ni contraseñas.

## OAuth

Los callbacks externos usan el dominio API:

```text
https://api.zapisocial.com/v1/oauth/channels/facebook/callback
https://api.zapisocial.com/v1/oauth/channels/linkedin/callback
```

Cuando se habilite un provider, registrar la URL exacta en su consola y guardar su configuración únicamente mediante Admin Integrations. La configuración se cifra en API; nunca llega a Web.

## Cómo añadir una variable nueva

1. Definirla en el schema de configuración del servicio que realmente la consume.
2. Documentarla en la sección correspondiente de este archivo con propósito, formato y si es secreto.
3. Añadirla en Dokploy al servicio correcto; si afecta build de Next, añadirla también al entorno de build.
4. No duplicar secretos de API en Web ni enviar secretos a variables `NEXT_PUBLIC_*`.
5. Añadir una prueba de arranque o health check si la variable habilita una dependencia nueva.
6. Actualizar Dockerfile solo si la variable modifica build o runtime de contenedor.

## Validación posterior al despliegue

1. API:

```text
GET https://api.zapisocial.com/v1/health
```

Debe responder `status`, `database` y `redis` como `ok`.

2. Web:

```text
https://app.zapisocial.com/login
```

3. Registro/login y una consulta de Portal Channels.

4. Revisar logs de API sin imprimir contraseñas, tokens, grants OAuth ni URLs de callback con `code` o `state`.
