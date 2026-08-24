# Deuda técnica

Inventario de lo que existe a medias: superficies con interfaz pero sin lógica real, código sin consumidores y documentación que describe otro estado. No es un backlog de producto; es la lista de lo que hoy miente sobre sí mismo.

Cada entrada se borra cuando deja de ser cierta, no cuando se decide arreglarla.

## Fixtures dentro de pantallas conectadas

No bloquean, pero conviene saber que no son datos de servidor:

- `channels-page.tsx` usa `channelsFixture.capabilities` para etiquetas de referencia.
- `plans-page.tsx` usa `planPermissionGroups` como catálogo estático de permisos.
- `ai-studio-page.tsx` usa `studioDestinations` como configuración de navegación.

## Pruebas que no corren en este entorno

`apps/api` mantiene diez suites de integración marcadas como `describe.skip` mientras no
exista `SUPPORT_WATERMARKS_TEST_DATABASE_URL` apuntando a `zapi_v2_local`. Con esa variable
definida corren; sin ella el comando pasa en verde sin ejercitar la base. El Worker conserva
una suite en la misma situación.

## Dos motores de mockup para módulos secundarios de Admin

Las superficies de usuarios y acceso (`/admin/user-report`, `/admin/user-roles`,
`/admin/teams`) usan `features/platform-admin-mockups/admin-secondary-module-mockup.tsx`,
copia literal del motor actual de `template-shadcn-superdashboard`; las seis superficies previas
(users, credits, affiliate, coupons, payments, subscriptions) siguen sobre
`features/platform-admin/components/admin-module-preview.tsx`, la adaptación
anterior de ese mismo motor. Al conectar cada vertical a REST conviene migrar
las seis antiguas al motor copiado y retirar `admin-module-preview.tsx`.

## Schema esperando su función

Columnas y tablas que existen en Drizzle pero que ninguna ruta escribe todavía.
No son campos sueltos que baste con cablear: cada una es la mitad de datos de una
función que aún no existe. Se dejan documentadas para que nadie las lea como algo
terminado ni las borre creyéndolas muertas.

- **Papelera de Files (`file_assets.trashedAt`, `file_folders.trashedAt` y el
  estado `trashed`).** Hoy `files.service.ts` borra en duro: quita el binario y
  la fila (`tx.delete(...)`). El estado `trashed` solo se lee en un filtro del
  dashboard (`ne(fileAssets.status, 'trashed')`); nada lo escribe. Cerrar el
  ciclo es una función completa —borrado suave, vista de papelera, restaurar,
  purga con retención en el Worker y UI en el Portal—, no un flag que enchufar.
- **Módulos por workspace (`workspaces.enabledModules`).** Lista de módulos
  habilitados por workspace. Ninguna ruta la escribe ni la consulta para permitir
  o bloquear una vertical. Es la base de un gating de módulos que no existe:
  necesita superficie de administración, lectura en cada guard de vertical y una
  decisión de producto sobre qué módulos son opcionales.
- **Registro de despliegues (`audit_releases` y las FK `releaseId` en los logs de
  auditoría).** La tabla se lee en joins para adjuntar servicio y commit a un
  evento, pero nada inserta filas: no hay pipeline que registre un release. Sin
  ese productor, todas las FK quedan nulas. Es un feature de trazabilidad de
  despliegues pendiente de origen de datos.
- **`posts.networkOptions`.** Columna JSON para opciones por red al publicar
  (por ejemplo, ajustes específicos de una plataforma). Ninguna ruta la escribe
  ni la lee; los publicadores actuales no la consultan. Queda como hueco para
  cuando una red exija opciones que no caben en el contenido común.
