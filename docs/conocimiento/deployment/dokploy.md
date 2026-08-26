# Despliegue en Dokploy

## Objetivo

Zapi V2 se despliega desde el mismo repositorio como servicios separados. La separación mantiene responsabilidades, secretos y dominios claros:

```text
Internet
├── zapisocial.com      → Web Next.js (sitio público)
├── app.zapisocial.com  → Web Next.js (Portal y Admin)
└── api.zapisocial.com  → API Nest
                             ├── PostgreSQL
                             ├── Redis / BullMQ
                             └── volumen privado Files
                                      ↑
Worker Nest ───────────────────────────┘
```

El sitio público de marketing **no es una aplicación aparte**: vive dentro de
`apps/web` como grupo de rutas `(marketing)` y se sirve desde el mismo
contenedor. La decisión y el porqué están en
[`planes/landing-en-web-v2.md`](../../planes/landing-en-web-v2.md).

El worker se despliega como servicio interno sin dominio público. Procesa perfiles, derivados, RSS, Publishing, Bulk Posts, AI y webhooks; comparte PostgreSQL, Redis, la clave de cifrado y el volumen Files con API.

## Repositorio y rama

Ambos servicios usan:

```text
Repositorio: Giossue/zapi-social
Rama: main
Build path: /
Trigger: On Push
Submódulos: desactivados
```

## DNS y dominios

En Namecheap deben existir registros `A` hacia la IP pública del servidor Dokploy:

| Host  | Destino         | Servicio Dokploy | Puerto interno |
| ----- | --------------- | ---------------- | -------------: |
| `@`   | IP del servidor | Web              |           3000 |
| `www` | IP del servidor | Web              |           3000 |
| `app` | IP del servidor | Web              |           3000 |
| `api` | IP del servidor | API              |           3001 |

Los dominios configurados en Dokploy son:

```text
Web: https://zapisocial.com, https://www.zapisocial.com, https://app.zapisocial.com
API: https://api.zapisocial.com
```

Los tres dominios de Web apuntan a la misma aplicación. Lo que distingue a
`app.` es `PORTAL_HOST`: en ese host la ruta `/` redirige al panel
(`/portal/dashboard` o `/login`) en vez de servir la landing. La regla vive en
`apps/web/proxy.ts` y se resuelve en **tiempo de ejecución**, verificado con
podman: basta con definir la variable en el entorno del contenedor.

Sin `PORTAL_HOST`, todos los hosts sirven la landing en `/`. Eso es lo correcto
en local y lo que rompería producción si se olvida en Dokploy: `app.` dejaría de
llevar al panel.

Activar certificados HTTPS en todos. No exponer PostgreSQL ni Redis como dominios públicos.

## Dockerfiles

Los tres servicios se construyen con contexto raíz porque dependen de workspaces compartidos.

| Servicio | Build type | Dockerfile          | Context path | Build stage |
| -------- | ---------- | ------------------- | ------------ | ----------- |
| Web      | Dockerfile | `Dockerfile.web`    | `.`          | vacío       |
| API      | Dockerfile | `Dockerfile.api`    | `.`          | vacío       |
| Worker   | Dockerfile | `Dockerfile.worker` | `.`          | vacío       |

Los Dockerfiles se validaron con Podman. No definir un Start Command manual en Dokploy: debe usar el `CMD` de la imagen.

Los tres compilan `@workspace/contracts` antes que su aplicación. Hace falta
aunque la web solo importe tipos de ese paquete casi siempre: `exports` resuelve
los tipos desde `src` pero **los valores desde `dist`**, y `.dockerignore` no
copia `dist`. La primera importación de un valor —un catálogo, un schema Zod—
rompe el build con `Module not found`, y solo se ve al desplegar, porque en
local `dist` ya existe de una compilación anterior.

## Qué tarda en un despliegue, y por qué

Medido con Podman en agosto de 2026, sobre la web:

| Escenario                 | Antes    | Ahora    |
| ------------------------- | -------- | -------- |
| Build en frío             | 1 m 36 s | 1 m 30 s |
| Cambio pequeño, con caché | 39 s     | **22 s** |

El desglose de los 39 s originales sorprende: compilar la web eran 28 s, y de
esos **solo 7 eran compilar**. Los otros 21 se iban en que `next build` vuelve a
comprobar los tipos por su cuenta. Compilar los contratos son 2,8 s; el resto
son las copias y el volcado de capas.

Tres cambios, por orden de lo que aportaron:

1. **La omisión de tipos se retiró el 24 de agosto de 2026.** La distribución
   para compradores debe fallar durante `next build` si contiene un error de
   TypeScript, incluso cuando el operador no ejecute el gate raíz por separado.
2. **Cachés de BuildKit** para las descargas de bun y para `.next/cache`, con
   `# syntax=docker/dockerfile:1` al principio de los tres `Dockerfile`. Ayuda
   en frío; con Turbopack la caché de Next apenas se nota.
3. **`Dockerfile.web` dejó de copiar** `packages/database`, `file-ingestion` y
   `eslint-config`: la web depende de `ui`, `contracts` y `api-client`. Sus
   `package.json` sí se copian, porque `bun install` los necesita para resolver
   el workspace.

Las tres imágenes usan builds multi-stage y usuarios sin privilegios. Web usa
la salida `standalone` de Next y su imagen final solo contiene el servidor,
estáticos y archivos públicos necesarios para producción.

## Watch Paths: desplegar solo el servicio que cambió

Un push desplegaba los tres servicios. Eso no solo gasta tiempo de build:
**reiniciaba el worker por un cambio de documentación**, y el worker puede estar
entregando publicaciones en ese momento.

Cada aplicación de Dokploy tiene un campo **Watch Paths** en su pestaña General,
bajo Provider. Se añade una ruta por entrada con el botón `+`; pegarlas todas
juntas separadas por espacios crea un solo patrón que no coincide con nada y
deja esa aplicación sin desplegarse nunca, en silencio.

Las rutas **no son por carpeta, son por dependencia**, según las que declara
[`ARCHITECTURE.md`](../../../ARCHITECTURE.md):

| Servicio | Rutas vigiladas                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Web      | `apps/web/**`, `packages/{ui,contracts,api-client}/**`, `Dockerfile.web`                                    |
| API      | `apps/api/**`, `packages/{contracts,database,file-ingestion}/**`, `infra/docker/**`, `Dockerfile.api`       |
| Worker   | `apps/worker/**`, `packages/{contracts,database,file-ingestion}/**`, `infra/docker/**`, `Dockerfile.worker` |

Las tres añaden además `packages/{typescript-config,eslint-config}/**`,
`package.json`, `bun.lock`, `turbo.json` y `tsconfig.json`.

**El error que importa es olvidar `packages/contracts/**`en la web.** No rompe
el build —se despliega y parece que todo va bien—, deja la web hablando un
contrato distinto al de la API. Por eso la comprobación que vale es tocar`packages/contracts/`y ver que arrancan los tres servicios; que un cambio en`docs/` no despliegue nada es la comprobación fácil.

Autodeploy se queda encendido: Watch Paths filtra dentro de él, no lo sustituye.
El botón **Deploy** de cada aplicación sigue ignorando las rutas.

## Perfil operativo actual

Los valores sensibles permanecen únicamente en Dokploy. En esta guía, `configurado en Dokploy` significa que el servicio tiene el valor real sin exponerlo en el repositorio.

| Servicio    | Entorno actual                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web Next    | `NODE_ENV=production`, `INTERNAL_API_ORIGIN=https://api.zapisocial.com`, `PORTAL_HOST=app.zapisocial.com`                                                                                                                                                                                                                                |
| API Nest    | `NODE_ENV=production`, `API_HOST=0.0.0.0`, `API_PORT=3001`, `API_PUBLIC_ORIGIN=https://api.zapisocial.com`, `WEB_ORIGIN=https://app.zapisocial.com`, `COOKIE_SECURE=true`, `LOG_LEVEL=info`; base de datos, JWT, Redis, Files, cifrado y proveedores de media configurados en Dokploy cuando apliquen. |
| Worker Nest | Servicio interno; comparte base de datos, Redis, clave de cifrado y volumen/ruta Files con API. `API_PUBLIC_ORIGIN` habilita media temporal de Instagram; proveedor y routing AI se administran en PostgreSQL desde Admin.                                                                             |

La etiqueta visual de un servicio en Dokploy no cambia esta responsabilidad: el bloque con `API_HOST`/`API_PORT` pertenece a API y el bloque con `INTERNAL_API_ORIGIN` pertenece a Web.

## Variables por servicio

### Web Next.js

Solo necesita variables de ejecución y build relacionadas con el proxy hacia API:

```dotenv
NODE_ENV=production
INTERNAL_API_ORIGIN=https://api.zapisocial.com
PORTAL_HOST=app.zapisocial.com
```

`INTERNAL_API_ORIGIN` debe estar disponible durante el build y runtime porque `next.config.ts` construye el rewrite `/api/*`.

`PORTAL_HOST` es el nombre de host —sin esquema ni puerto— que debe entrar al
panel desde `/`. Solo se necesita en runtime.

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
FILES_STORAGE_PATH=/var/lib/zapi/files
API_PUBLIC_ORIGIN=https://api.zapisocial.com
LOG_LEVEL=info
```

- `DATABASE_URL`, Redis y `PROVIDER_INTEGRATIONS_ENCRYPTION_KEY` son secretos del servicio Worker.
- La clave de cifrado debe ser exactamente la misma que API para poder descifrar tokens de cuentas ya conectadas.
- `FILES_STORAGE_PATH` debe coincidir con la ruta de montaje de API y apuntar al mismo volumen persistente.
- `API_PUBLIC_ORIGIN` es necesaria en Worker para que Instagram reciba una URL HTTPS temporal firmada.
- OpenAI (texto) y AtlasCloud (imagen/video) se configuran desde `Admin → Configuración AI`. Cada clave se cifra con `PROVIDER_INTEGRATIONS_ENCRYPTION_KEY`; el Worker no recibe claves ni modelos AI mediante variables de entorno.
- Sin el proveedor requerido probado, habilitado y con una ruta compatible, la tarea falla de forma explícita y reembolsa el débito correspondiente.
- `Dockerfile.worker` instala `ffmpeg`, que también aporta `ffprobe`, para thumbnails y watermarks de vídeo.
- El Worker no recibe `JWT_ACCESS_SECRET`, `WEB_ORIGIN`, callbacks OAuth ni dominio público.
- Schedulers de perfiles, RSS, Publishing, AI y webhooks se registran internamente y no requieren cron externo.

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
COOKIE_DOMAIN=.zapisocial.com
REDIS_HOST=REDIS_SERVICE_HOST
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=REDIS_PASSWORD
LOG_LEVEL=info
PROVIDER_INTEGRATIONS_ENCRYPTION_KEY=BASE64_32_BYTE_KEY
FILES_STORAGE_PATH=/var/lib/zapi/files
# Opcionales para Online Media:
UNSPLASH_ACCESS_KEY=UNSPLASH_SECRET
```

Notas:

- `API_PUBLIC_ORIGIN` recibe callbacks OAuth y debe ser un dominio HTTPS público.
- `WEB_ORIGIN` es el único origen permitido por CORS con cookies.
- `COOKIE_DOMAIN=.zapisocial.com` comparte la sesión entre `zapisocial.com` y
  `app.zapisocial.com`. Nació para que el sitio público detectase la sesión
  cuando era una aplicación aparte; ahora que comparte contenedor sigue haciendo
  falta, porque la landing y el panel se sirven en hosts distintos y los CTA «Ir
  al panel» leen la cookie desde el apex. Al introducirlo, las cookies host-only
  previas quedan huérfanas: el logout de la API limpia ambas variantes y el
  middleware de Web borra las que encuentre inválidas.
- `DATABASE_URL`, JWT, Redis y clave de cifrado son secretos de Dokploy: nunca se versionan ni se copian a documentación, issues o chat.
- `PROVIDER_INTEGRATIONS_ENCRYPTION_KEY` debe mantenerse estable. Rotarla requiere un proceso explícito de re-cifrado de configuraciones OAuth existentes.
- Redis autenticado usa `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME` y `REDIS_PASSWORD` separados. No usar una URL Redis como valor de `REDIS_HOST`.
- `UNSPLASH_ACCESS_KEY` permanece como configuración de API. Pexels se administra cifrado desde Admin → Integraciones y no usa variables de entorno.

## Volumen Files compartido

API y Worker deben montar el mismo volumen persistente con idéntica ruta dentro del contenedor:

```text
Volume name: zapi-files-data
Mount path API:    /var/lib/zapi/files
Mount path Worker: /var/lib/zapi/files
FILES_STORAGE_PATH=/var/lib/zapi/files
```

Un volumen con el mismo nombre pero datos independientes, o rutas internas distintas, rompe thumbnails, Bulk Posts, AI Images, Publishing, watermarks y los logotipos subidos desde Admin, que viven en `branding/` dentro de esa misma ruta. Después de cambiar un mount se redeployan ambos servicios. El volumen no se monta en Web.

Los volúmenes nuevos se montan inicialmente como `root:root`, aunque la imagen haya creado la ruta con otro propietario. API y Worker arrancan mediante `files-storage-entrypoint`: corrige una vez la propiedad del volumen a `bun:bun` cuando sea necesario y después ejecuta Nest como el usuario sin privilegios `bun`. El smoke operativo debe confirmar lectura y escritura desde ambos contenedores; que los archivos sean legibles no basta para generar thumbnails, importaciones ni variantes temporales de watermarks.

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

La autorización operativa, comprobaciones y límites para migraciones locales y remotas viven exclusivamente en [`docs/reglas/workflow.md`](../../reglas/workflow.md). Esta guía de despliegue no los redefine.

El backend consolidado se validó localmente con `0020_mushy_peter_parker` y `0021_pale_thor`. Esa evidencia local no confirma que producción tenga las migraciones; deben verificarse y aplicarse durante la ventana de despliegue antes de publicar código que dependa de sus tablas, siguiendo `docs/reglas/workflow.md`.

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

## Retirar la aplicación landing

El sitio público fue una cuarta aplicación de Dokploy hasta que se integró en
Web. Para completar la migración en un despliegue que todavía la tenga:

1. Desplegar Web con el código que incluye `(marketing)` y añadirle
   `PORTAL_HOST=app.zapisocial.com`.
2. Añadir `zapisocial.com` y `www.zapisocial.com` como dominios de la aplicación
   **Web**, con HTTPS. Dokploy no deja dos aplicaciones con el mismo dominio: hay
   que quitarlo antes de la aplicación landing.
3. Comprobar los cuatro casos: apex sirve la landing, `www` también, `app.`
   redirige al panel y `/blog` responde.
4. Eliminar la aplicación **landing**.
5. Retirar de Web las variables que ya no usa nadie: `ZAPI_API_ORIGIN`,
   `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_AUTHOR_NAME`.

El paso 2 es el único con corte de servicio: entre quitar el dominio de la
aplicación vieja y añadirlo a Web, el apex no resuelve.

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

2. Web, panel:

```text
https://app.zapisocial.com/login
```

`https://app.zapisocial.com/` debe redirigir al panel, no mostrar la landing. Si
muestra la landing, falta `PORTAL_HOST`.

3. Web, sitio público:

```text
https://zapisocial.com/
https://zapisocial.com/blog
```

Los planes, las preguntas y las páginas legales del pie salen del Admin. Si la
API no responde, la página debe seguir cargando con esas secciones vacías: que
la landing se caiga por un fallo del backend es un defecto.

4. Registro/login y una consulta de Portal Channels.

5. Confirmar que API y Worker ven el mismo asset/thumbnail en `FILES_STORAGE_PATH`.

6. Verificar que el Worker permanece activo y que los dispatchers no fallan por Redis, volumen, `ffmpeg` o variables AI.

7. Revisar auditoría persistente y logs de contenedor sin imprimir contraseñas, tokens, grants OAuth ni URLs de callback con `code` o `state`.
