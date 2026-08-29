# Portal Settings V2

## Alcance

`/portal/settings` agrupa configuración operativa del workspace bajo una
navegación secundaria vertical. La primera sección migrada es Canales, cuya URL
canónica pasa a ser `/portal/settings/channels`.

La entrada primaria **Ajustes** sustituye la entrada directa de Canales en el
sidebar del Portal. El área secundaria muestra las secciones disponibles; al
inicio contiene únicamente Canales. Cuando se migre otra superficie a este
dominio, se añade como `settings/<sección>` en la misma navegación.

## Compatibilidad y permisos

- `/portal/channels` redirige a `/portal/settings/channels`, conservando los
  parámetros de búsqueda. Los retornos OAuth y la limpieza de URL usan la ruta
  canónica nueva.
- Settings/Canales conserva `channels.view` y los permisos de gestión ya
  aplicados por su API; mover la ruta no cambia contratos ni ownership.
- La navegación primaria de Ajustes solo se muestra cuando el usuario puede
  ver Canales, hasta que exista otra sección con permisos propios.

## Fuente visual y validación

La composición canónica vive en
`template-shadcn-superdashboard/src/app/(main)/dashboard/settings`: Tabs
verticales dentro de un panel secundario, responsive y sin primitives nuevos.
V2 adapta traducciones, rutas y la página funcional de Canales.

Validación requerida: typecheck, lint, build, auditoría Portal/Admin, paridad
i18n y aprobación visual.

## Evidencia de implementación — 29 de agosto de 2026

- [x] Sidebar primario con **Ajustes**, navegación secundaria vertical y
      `/portal/settings/channels` como sección inicial.
- [x] Redirección compatible desde `/portal/channels`, incluida la preservación
      de parámetros para retornos OAuth; callbacks OAuth y limpieza de URL apuntan
      a la ruta canónica nueva.
- [x] `bun run --cwd apps/web build`, `bun run typecheck`, `bun run lint`,
      `bun run audit:i18n`, `bun run audit:i18n-hardcoded` y
      `bun run audit:portal-admin-ui` sin hallazgos.
- [x] La fuente visual de Settings pasó `bunx biome check` en sus archivos
      nuevos.
- [ ] Aprobación visual del usuario en escritorio y móvil.
