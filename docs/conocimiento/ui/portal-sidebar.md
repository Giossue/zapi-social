# Portal — sidebar base

## Estado

- [x] Tokens globales compartidos Portal/Admin.
- [x] Shell responsive: sidebar desktop, colapsable y drawer móvil.
- [x] Opciones Portal equivalentes a Laravel.
- [x] Rutas Portal mock para navegar sin backend.
- [x] AI Studio desplegable.
- [x] Typecheck, build y `git diff --check`.

## Cómo se hizo

1. Laravel fue referencia: `register_user_sidebar_section` y `register_user_sidebar_item`.
2. Mapa V2 centralizado en `apps/web/features/portal-shell/portal-navigation.ts`.
3. Portal y Admin componen primitives locales `SidebarProvider`, `Sidebar`, `SidebarInset`, `SidebarHeader`, `SidebarContent`, `SidebarGroup` y `SidebarMenu*` de `apps/web/components/shared/sidebar-layout.tsx`. La composición se adaptó al patrón de `next-shadcn-admin-dashboard` sin instalar `@shadcn/sidebar` ni modificar primitives de `packages/ui`.
4. En escritorio, `Sidebar` deja un `sidebar-gap` animado y mantiene el panel fijo con el mismo ancho (`w-72` o `w-20`); el contenido usa `SidebarInset`, en vez de sincronizar un `padding-left` independiente.
5. El mismo panel de navegación se desplaza como drawer en móvil: no se monta una segunda navegación, por lo que enlaces, estado de disclosures y triggers de tooltip conservan su identidad DOM.
6. La navegación usa `SidebarMenuButton` y `SidebarMenuSubButton`, que internamente componen el primitive `Button` de `packages/ui` con variantes `sidebar` y `sidebar-active`; drawer y controles secundarios usan `variant="brand-secondary"`.
7. El estado compacto se expresa con `data-collapsible="icon"` en el contenedor del sidebar; los primitives usan selectores `group-data` para ocultar etiquetas, grupos y submenús sin layout paralelo.
8. Cada `SidebarMenuButton` conserva montados `TooltipTrigger` y `TooltipContent`; el tooltip se habilita solo en modo compacto, para que su identidad DOM permanezca estable al alternar el ancho.
9. `SidebarContent` delega el scroll a `ScrollArea` de `packages/ui`; el viewport se conserva operativo también con `data-collapsible="icon"`.
10. Visibilidad por plan, equipo y permisos sigue mock: opciones visibles para diseñar módulos primero.
11. Portal y Admin persisten el estado contraído en `localStorage` versionado: `zapi:portal-sidebar:v1` y `zapi:admin-sidebar:v1`.
12. El panel móvil se abre siempre expandido aunque el estado persistido de escritorio sea contraído; cerrar o navegar vuelve a ocultarlo sin modificar esa preferencia.
13. Al contraerse, Portal y Admin muestran tooltips a la derecha de cada opción mediante el primitive compartido `Tooltip`; el trigger permanece montado al expandir o contraer.
14. Ambos shells usan el asset local `apps/web/public/brand/logo-brand-dark.png` mediante `next/image`.
15. El ancho del gap y del panel fijo, las etiquetas, títulos de grupo e iconos usan transiciones CSS de 200 ms con `ease-out`, respetando `prefers-reduced-motion`.

## Pendiente

- [ ] Diseñar cada módulo con fixtures, mocks y estados UI.
- [ ] Aplicar visibilidad real después de contrato REST y backend.
