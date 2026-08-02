# Portal — sidebar base

## Estado

- [x] Tokens globales compartidos Portal/Admin.
- [x] Shell responsive: sidebar desktop, colapsable y drawer móvil.
- [x] Opciones Portal equivalentes a Laravel.
- [x] Rutas Portal mock para navegar sin backend.
- [x] AI Studio desplegable.
- [x] Scrollbar custom accesible.
- [x] Typecheck, build y `git diff --check`.

## Cómo se hizo

1. Laravel fue referencia: `register_user_sidebar_section` y `register_user_sidebar_item`.
2. Mapa V2 centralizado en `apps/web/features/portal-shell/portal-navigation.ts`.
3. Shell en `apps/web/components/app-shell.tsx`.
4. Navegación usa primitive `Button` de `packages/ui`.
5. Scroll usa primitive compartido `packages/ui/src/components/scroll-area.tsx`.
6. Scroll Area fue auditado por MCP 21st; se adaptó composición Radix y tokens existentes. No se importó bloque, CSS global ni primitive duplicado.
7. Visibilidad por plan, equipo y permisos sigue mock: opciones visibles para diseñar módulos primero.

## Pendiente

- [ ] Diseñar cada módulo con fixtures, mocks y estados UI.
- [ ] Aplicar visibilidad real después de contrato REST y backend.
