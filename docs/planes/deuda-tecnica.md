# Deuda técnica

Inventario de lo que existe a medias: superficies con interfaz pero sin lógica real, código sin consumidores y documentación que describe otro estado. No es un backlog de producto; es la lista de lo que hoy miente sobre sí mismo.

Cada entrada se borra cuando deja de ser cierta, no cuando se decide arreglarla.

## Admin sin backend

Dieciséis rutas resueltas por `features/platform-admin-mockups`. No tienen módulo en `apps/api`, contrato ni tablas:

`/admin/blogs`, `/admin/blog-categories`, `/admin/blog-tags`, `/admin/faqs`, `/admin/languages`, `/admin/ai-templates`, `/admin/ai-template-categories`, `/admin/ai-usage-logs`, `/admin/ai-report`, `/admin/settings/general`, `/admin/settings/auth`, `/admin/settings/analytics`, `/admin/settings/static-pages`, `/admin/settings/cache`, `/admin/settings/crons`, `/admin/settings/system-information`.

`ai-usage-logs` y `ai-report` son las más cercanas a existir: `adminAiApi.usage(days)` ya devuelve consumo por modelo.

## Fixtures dentro de pantallas conectadas

No bloquean, pero conviene saber que no son datos de servidor:

- `channels-page.tsx` usa `channelsFixture.capabilities` para etiquetas de referencia.
- `plans-page.tsx` usa `planPermissionGroups` como catálogo estático de permisos.
- `ai-studio-page.tsx` usa `studioDestinations` como configuración de navegación.
