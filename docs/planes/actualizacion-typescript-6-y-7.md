# Actualización de TypeScript 5.9 → 6 → 7

## Objetivo

Actualizar el monorepo de TypeScript 5.9.3 a 6.0.3 de forma controlada y dejar
preparada la adopción progresiva del compilador nativo TypeScript 7.

## Estado observado

- El workspace usa Bun 1.3.14 y Turborepo.
- `typescript` raíz está en `^5.9.3`; los workspaces admiten TypeScript 5.
- La configuración compartida ya usa `strict`, `NodeNext`, `isolatedModules` y
  no contiene flags deprecados de TypeScript 6.
- API y Worker usan Jest, `ts-jest` y `ts-node`.
- El lint usa `typescript-eslint` 8.x.

TypeScript 7 es estable para ejecutar `tsc`, pero su API programática no está
disponible todavía. Hasta que exista API estable, `typescript-eslint`, `ts-jest`
y `ts-node` deben continuar resolviendo TypeScript 6.

Fuente de compatibilidad: [anuncio oficial TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

## Fase 1 — TypeScript 6.0.3

- [x] Actualizar las dependencias de todos los workspaces a TypeScript 6.0.3.
- [x] Regenerar `bun.lock` con Bun 1.3.14.
- [x] Ejecutar typecheck, build, lint, auditorías y pruebas API/Worker.
- [x] Resolver incompatibilidades de TypeScript 6 sin relajar `strict` ni
  silenciar diagnósticos globalmente.

Compatibilidades corregidas: `types` explícitos para Node y Jest, retirada de
`baseUrl`, `rootDir: "./src"` explícito para API y Worker, y firma compatible
con el overload actual de `fetch` en una prueba de LinkedIn.

## Fase 2 — TypeScript 7 para compilación

- [ ] Mantener TypeScript 6 como dependencia expuesta con el alias oficial
  `@typescript/typescript6` para consumidores de su API.
- [ ] Añadir TypeScript 7 como alias `@typescript/native` y hacer que los
  scripts de typecheck/build ejecuten su binario `tsc`.
- [ ] Validar que todos los `tsconfig`, build emitido y declaraciones generadas
  coinciden con los resultados aceptados de TypeScript 6.
- [ ] Mantener ESLint, Jest, `ts-jest` y `ts-node` sobre TypeScript 6 hasta que
  sus versiones soporten la API de TypeScript 7.

## Fase 3 — Retirada de TypeScript 6

- [ ] Confirmar soporte explícito de TypeScript 7 en `typescript-eslint`,
  `ts-jest`, `ts-node`, Next.js y cualquier herramienta que importe
  `typescript`.
- [ ] Eliminar el alias de TypeScript 6 solo tras una validación completa en
  local y CI.

## Validación base antes de migrar

Evidencia ejecutada el 30 de agosto de 2026 con TypeScript 5.9.3:

- [ ] `bun run format`: no ejecutado porque el script escribe archivos; no forma
  parte de esta validación sin cambios solicitados.
- [x] `bun run lint`: termina con 7 advertencias preexistentes y ningún error.
  Las advertencias están en `search-dialog.tsx`, `ai-studio-operations.tsx`,
  `publishing-calendar-page.tsx` y `publishing-calendar.tsx`.
- [x] `bun run typecheck`: 8 tareas en 8 workspaces, todas correctas.
- [x] `bun run build -- --force`: 6 tareas en 6 workspaces, todas correctas;
  incluye compilación de API y Worker, paquetes emitidos y build de producción
  Next con 104 páginas estáticas generadas.
- [x] Auditorías raíz: Portal/Admin sin hallazgos; i18n con 4711 claves
  sincronizadas; sin texto de interfaz hardcodeado.
- [x] Pruebas API y Worker: API 25 suites y 103 pruebas aprobadas; Worker 7
  suites y 39 pruebas aprobadas.
- [ ] E2E Web: no ejecutado. La suite requiere credenciales locales
  `E2E_ADMIN_*` y `E2E_PORTAL_*`, que no están configuradas. Además, API tiene
  17 suites (58 pruebas) y Worker 2 suites (2 pruebas) omitidas por su
  configuración de integración local.

## Criterio de cierre

Cada fase se cierra únicamente con lockfile reproducible, compilación de todos
los workspaces, lint y pruebas disponibles en verde, o con fallos existentes
documentados y separados de la actualización.

## Evidencia Fase 1 — 30 de agosto de 2026

- TypeScript instalado: 6.0.3.
- `bun run typecheck -- --force`: 8 tareas correctas en 8 workspaces.
- `bun run lint -- --force`: 8 tareas correctas en 8 workspaces, sin
  advertencias ni errores.
- `bun run build -- --force`: 6 tareas correctas en 6 workspaces; Next generó
  104 páginas estáticas.
- `python3 scripts/audit_portal_admin_ui.py --fail-on-findings`: sin hallazgos.
- API: 25 suites y 103 pruebas aprobadas; 17 suites y 58 pruebas de integración
  permanecen omitidas por configuración local.
- Worker: 7 suites y 39 pruebas aprobadas; 2 suites y 2 pruebas de integración
  permanecen omitidas por configuración local.
- E2E Web sigue pendiente de credenciales locales `E2E_ADMIN_*` y
  `E2E_PORTAL_*`.
