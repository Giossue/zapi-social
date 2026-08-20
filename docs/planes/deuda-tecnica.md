# Deuda técnica

Inventario de lo que existe a medias: superficies con interfaz pero sin lógica real, código sin consumidores y documentación que describe otro estado. No es un backlog de producto; es la lista de lo que hoy miente sobre sí mismo.

Cada entrada se borra cuando deja de ser cierta, no cuando se decide arreglarla.

## Fixtures dentro de pantallas conectadas

No bloquean, pero conviene saber que no son datos de servidor:

- `channels-page.tsx` usa `channelsFixture.capabilities` para etiquetas de referencia.
- `plans-page.tsx` usa `planPermissionGroups` como catálogo estático de permisos.
- `ai-studio-page.tsx` usa `studioDestinations` como configuración de navegación.
