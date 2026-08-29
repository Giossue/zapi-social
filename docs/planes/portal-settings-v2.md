# Portal Settings V2

## Alcance

`/portal/settings` agrupa configuración operativa del workspace bajo una
navegación secundaria vertical. Las secciones canónicas son:

| Sección        | URL canónica                           |
| -------------- | -------------------------------------- |
| Canales        | `/portal/settings/channels`            |
| Ajustes AI     | `/portal/settings/ai-studio`           |
| Link in bio    | `/portal/settings/link-bio`            |
| Marcas de agua | `/portal/settings/watermarks`          |
| Claves API     | `/portal/settings/automation`          |
| Webhooks       | `/portal/settings/automation/webhooks` |
| Registro       | `/portal/settings/automation/logs`     |

La entrada primaria **Ajustes** sustituye las entradas directas de estas
secciones en el sidebar del Portal. El área secundaria muestra las siete
secciones disponibles.

## Compatibilidad y permisos

- `/portal/channels` redirige a `/portal/settings/channels`, conservando los
  parámetros de búsqueda. Los retornos OAuth y la limpieza de URL usan la ruta
  canónica nueva.
- `/portal/ai-studio/settings`, `/portal/link-bio`, `/portal/watermarks`,
  `/portal/automation`, `/portal/automation/logs` y
  `/portal/automation/webhooks` redirigen a su equivalente en Settings y
  conservan los parámetros de búsqueda.
- Cada sección mantiene su permiso y bloqueo por plan: `channels.view`,
  `ai-studio.view`, `link-bio.view`, `watermarks.view` y `automation.view`.
  Mover la ruta no cambia contratos, ownership ni APIs.

## Fuente visual y validación

La composición canónica vive en
`template-shadcn-superdashboard/src/app/(main)/dashboard/settings`: Tabs
verticales dentro de un panel secundario, responsive y sin primitives nuevos.
V2 adapta traducciones, rutas y las páginas funcionales existentes. La fuente
incluye rutas demo reutilizables para AI Studio y Marcas de agua; Link in bio y
Automatización no tienen equivalentes en el template, por lo que conservan sus
componentes funcionales de V2 dentro del mismo shell.

Validación requerida: typecheck, lint, build, auditoría Portal/Admin, paridad
i18n y aprobación visual.

## Evidencia de implementación — 29 de agosto de 2026

- [x] Sidebar primario con **Ajustes**, navegación secundaria vertical y
      siete secciones bajo `/portal/settings/*`.
- [x] Redirección compatible desde `/portal/channels`, incluida la preservación
      de parámetros para retornos OAuth; callbacks OAuth y limpieza de URL apuntan
      a la ruta canónica nueva.
- [x] Migradas las rutas de Ajustes AI, Link in bio, Marcas de agua y
      Automatización (claves, webhooks y registro), manteniendo componentes,
      APIs, permisos y bloqueos de plan existentes.
- [x] `bun run --cwd apps/web build`, `bun run typecheck`, `bun run lint`,
      `bun run audit:i18n`, `bun run audit:i18n-hardcoded` y
      `bun run audit:portal-admin-ui` sin hallazgos.
- [x] La fuente visual de Settings pasó `bunx biome check` en sus archivos
      nuevos.
- [ ] Aprobación visual del usuario en escritorio y móvil.
