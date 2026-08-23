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
