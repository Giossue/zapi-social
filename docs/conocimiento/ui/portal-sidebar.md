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
3. Portal y Admin componen el patrón selectivo `SidebarProvider` / `Sidebar` / `SidebarInset` de `apps/web/components/shared/sidebar-layout.tsx`; no se instaló `@shadcn/sidebar` ni se modificaron primitives de `packages/ui`.
4. En escritorio, `Sidebar` deja un `sidebar-gap` animado y mantiene el panel fijo con el mismo ancho (`w-72` o `w-20`); el contenido usa `SidebarInset`, en vez de sincronizar un `padding-left` independiente.
5. El mismo panel de navegación se desplaza como drawer en móvil: no se monta una segunda navegación, por lo que enlaces, estado de disclosures y triggers de tooltip conservan su identidad DOM.
6. Navegación usa primitive `Button` de `packages/ui` y el drawer/controles secundarios usan `variant="brand-secondary"`.
7. Scroll usa primitive compartido `packages/ui/src/components/scroll-area.tsx`.
8. Scroll Area fue auditado por MCP 21st; se adaptó composición Radix y tokens existentes. No se importó bloque, CSS global ni primitive duplicado.
9. Visibilidad por plan, equipo y permisos sigue mock: opciones visibles para diseñar módulos primero.
10. Portal y Admin persisten el estado contraído en `localStorage` versionado: `zapi:portal-sidebar:v1` y `zapi:admin-sidebar:v1`.
11. El panel móvil se abre siempre expandido aunque el estado persistido de escritorio sea contraído; cerrar o navegar vuelve a ocultarlo sin modificar esa preferencia.
12. En modo contraído, el botón de expandir se ubica fuera del logo, los iconos se centran y los disclosures ocultan su chevron sin perder etiqueta accesible.
13. Ambos shells usan el asset local `apps/web/public/brand/logo-brand-dark.png` mediante `next/image`.
14. El ancho del gap y del panel fijo, las etiquetas, títulos de grupo e iconos usan transiciones CSS de 200 ms con `ease-out`, respetando `prefers-reduced-motion`.
15. Al contraerse, Portal y Admin muestran tooltips a la derecha de cada opción mediante el primitive compartido `Tooltip`; el trigger permanece montado al expandir o contraer.

## Pendiente

- [ ] Diseñar cada módulo con fixtures, mocks y estados UI.
- [ ] Aplicar visibilidad real después de contrato REST y backend.
