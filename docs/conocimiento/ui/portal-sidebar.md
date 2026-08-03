# Portal y Admin — sidebar base

## Estado

- [x] Tokens globales compartidos Portal/Admin.
- [x] Shell responsive mediante el `Sidebar` oficial de `packages/ui`: cierre completo en escritorio y drawer móvil.
- [x] Opciones Portal equivalentes a Laravel.
- [x] Rutas Portal mock para navegar sin backend.
- [x] AI Studio desplegable.
- [x] Typecheck y `git diff --check` ejecutados después de la migración al primitive oficial.

## Cómo se compone

1. Laravel fue referencia: `register_user_sidebar_section` y `register_user_sidebar_item`.
2. El mapa Portal V2 permanece centralizado en `apps/web/features/portal-shell/portal-navigation.ts`; Admin conserva `apps/web/features/platform-admin/admin-navigation.ts`.
3. Portal y Admin consumen `SidebarProvider`, `Sidebar`, `SidebarInset`, `SidebarHeader`, `SidebarContent`, `SidebarGroup` y los `SidebarMenu*` desde `@workspace/ui/components/sidebar`. El layout local `apps/web/components/shared/sidebar-layout.tsx` fue retirado.
4. Cada shell controla el primitive con `open={!collapsed}` y persiste cambios de `onOpenChange` en sus claves existentes de `localStorage`: `zapi:portal-sidebar:v1` y `zapi:admin-sidebar:v1`.
5. `Sidebar` usa `collapsible="offcanvas"`: en escritorio no existe un estado intermedio de iconos; cerrarlo retira por completo el panel y su gap. El `SidebarTrigger` del encabezado sigue disponible para volver a abrirlo.
6. En móvil, el provider oficial presenta el mismo panel como drawer. Los enlaces y el trigger interno cierran el drawer sin alterar la preferencia persistida de escritorio.
7. `SidebarContent` delega el scroll del menú a `ScrollArea` de `packages/ui`.
8. El disclosure AI Studio, la ruta activa, `AccountMenu`, Bell y el asset local `apps/web/public/brand/logo-brand-dark.png` se conservan en los shells.
9. Visibilidad por plan, equipo y permisos sigue mock: opciones visibles para diseñar módulos primero.

## Pendiente

- [ ] Diseñar cada módulo con fixtures, mocks y estados UI.
- [ ] Aplicar visibilidad real después de contrato REST y backend.
