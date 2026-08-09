# Separación V2: Admin de plataforma y Portal de clientes

## Decisión

Zapi V2 separa de forma estricta las dos superficies de producto:

```text
PlatformAdmin
  → solo /admin/*
  → administración global de Zapi
  → sin workspace, memberships ni recursos de cliente

PortalUser
  → solo /portal/*
  → cliente dentro de uno o más workspaces
  → roles owner, admin o member del workspace
  → sin acceso a /admin/*
```

Una misma cuenta no puede pertenecer a ambas áreas. Cuando soporte necesite revisar un cliente se implementará impersonación auditada, no acceso directo del administrador a Portal.

## Referencia Laravel y divergencia intencional

Laravel distingue Admin mediante `is_super_admin` o `role_id`:

```php
isSuperAdmin() => is_super_admin || username === 'admin' || role.slug === 'super-admin'
canAccessAdmin() => isSuperAdmin() || role_id presente
```

`EnsureAdminAccess` bloquea a un cliente de `/admin/*` y lo redirige a Portal. Sin embargo, Fortify redirige todos los logins a:

```text
/portal/dashboard
```

Por tanto Laravel permite que un superadmin llegue a Portal. V2 no replica esa ambigüedad: la separación total es una mejora deliberada de seguridad y modelo de producto.

## Modelo de datos V2

### Usuario

Añadir a `users`:

```text
is_platform_admin boolean not null default false
```

Reglas:

```text
is_platform_admin = true
  → no debe tener workspace_memberships
  → no puede ser owner de workspaces

is_platform_admin = false
  → puede pertenecer a workspaces
  → no puede acceder a rutas o APIs Admin
```

La membresía de workspace no expresa administración de plataforma:

```text
workspace_memberships.role
  owner | admin | member
```

Solo controla permisos de Portal.

## Contrato de sesión

Extender `AuthSession`:

```ts
area: "admin" | "portal"
```

Sesión Admin:

```json
{
  "user": { "id": "…", "email": "…", "displayName": "…" },
  "area": "admin"
}
```

Sesión Portal:

```json
{
  "user": { "id": "…", "email": "…", "displayName": "…" },
  "area": "portal",
  "workspace": { "id": "…", "name": "…", "slug": "…", "role": "owner" }
}
```

No devolver una propiedad `workspace` ficticia para PlatformAdmin.

## Autenticación y redirecciones

```text
POST /v1/auth/login
POST /v1/auth/register
GET  /v1/auth/session
```

Reglas:

| Acción           | PlatformAdmin       | PortalUser                                                            |
| ---------------- | ------------------- | --------------------------------------------------------------------- |
| Login            | redirigir `/admin`  | redirigir `/portal/dashboard`                                         |
| Registro público | prohibido           | crea usuario con zona horaria + workspace personal + owner membership |
| Logout           | `/login`            | `/login`                                                              |
| Refresh          | conserva área admin | conserva workspace activo                                             |

El registro público nunca puede crear `is_platform_admin = true`.
La zona horaria es obligatoria en el contrato de registro y se persiste en `users.timezone`; Web propone la zona detectada por el navegador y permite cambiarla antes de crear la cuenta.

## Guards de rutas y API

### Web

```text
/admin/*
  requiere session.area === 'admin'
  usuario Portal → /portal/dashboard o 403 según contexto

/portal/*
  requiere session.area === 'portal'
  PlatformAdmin → /admin
```

### API

```text
/v1/admin/*
  requiere is_platform_admin = true

/v1/portal/*
  requiere is_platform_admin = false
  requiere workspace membership activa
```

No derivar acceso Admin desde:

```text
workspace.role === 'owner'
role_id de workspace
username
```

## Áreas funcionales

### Admin de plataforma

```text
/admin
/admin/integrations
/admin/users                 # futuro
/admin/workspaces            # futuro
/admin/plans                 # futuro
/admin/audit                 # futuro
```

`/admin/integrations` administra configuración global de providers y no representa una pantalla de cliente.

### Portal de cliente

```text
/portal/dashboard
/portal/channels
/portal/publishing/*
/portal/library/*
/portal/settings/*
```

## Seed inicial

La seed de despliegue debe crear entidades distintas:

```text
SEED_ADMIN_*
  → usuario is_platform_admin = true
  → sin workspace

SEED_MEMBER_*
  → PortalUser
  → workspace personal o membership de prueba
  → role owner, admin o member según el caso declarado
```

Nunca usar `SEED_ADMIN_*` para crear un workspace owner.

## Impersonación futura

PlatformAdmin no accede al Portal con su propia sesión. La impersonación deberá requerir:

```text
permiso explícito
motivo obligatorio
sesión temporal
actor y objetivo auditados
banner persistente
salida de impersonación
revocación inmediata
```

No forma parte de la primera migración de separación.

## Plan de implementación

### A. Modelo y migración

- [x] Añadir `users.is_platform_admin` al schema Drizzle.
- [x] Crear migración reversible/aditiva.
- [x] Definir constraints o validaciones de consistencia entre PlatformAdmin y memberships.
- [ ] Migrar o reclasificar usuarios existentes de producción con plan explícito.

### B. Sesión y autenticación

- [x] Hacer `workspace` opcional en contrato de sesión Admin.
- [x] Añadir `area` a contratos y API client.
- [x] Cambiar `IdentityService.getSession()` para resolver PlatformAdmin sin workspace.
- [x] Impedir registro público de PlatformAdmin.
- [x] Exigir y persistir la zona horaria al registrar un PortalUser.
- [x] Redirigir login por área.
- [x] Invalidar o renovar sesiones emitidas con el contrato anterior.

### C. Guards API

- [x] Crear guard reutilizable `requirePlatformAdmin`.
- [x] Crear guard reutilizable `requirePortalSession`.
- [x] Aplicar guard Admin a Integrations y futuros módulos `/v1/admin/*`.
- [x] Aplicar guard Portal a Dashboard, Channels y futuros módulos `/v1/portal/*`.
- [x] Eliminar comprobaciones Admin basadas en `workspace.role === 'owner'`.

### D. Rutas y UI Web

- [x] Crear `/admin` como dashboard administrativo inicial.
- [x] Redirigir PlatformAdmin autenticado de `/portal/*` a `/admin`.
- [x] Redirigir PortalUser autenticado de `/admin/*` a `/portal/dashboard`.
- [x] Ajustar `AppShell` para no cargar navegación Portal bajo sesión Admin.
- [x] Mantener layout Admin independiente y tokens compartidos.
- [x] Crear estados loading/error/sin permiso para ambas áreas.

### E. Seed y operación

- [x] Corregir `seed:users` para crear PlatformAdmin real y PortalUser separado.
- [x] Documentar variables `SEED_*` por área.
- [ ] Ejecutar seed solo de forma manual y borrar variables al terminar.
- [ ] Definir procedimiento de bootstrap del primer PlatformAdmin en producción.

### F. Validación

- [ ] Test: PlatformAdmin login → `/admin`.
- [ ] Test: PortalUser login → `/portal/dashboard`.
- [ ] Test: PlatformAdmin no accede a `/v1/portal/*`.
- [ ] Test: PortalUser no accede a `/v1/admin/*`.
- [x] Test: registro público crea solamente PortalUser y persiste su zona horaria obligatoria.
- [ ] Test: seed no crea memberships para PlatformAdmin.
- [x] Typecheck, build, migración en staging y revisión visual.

Evidencia de registro con zona horaria: el test focal de Identity rechaza el payload sin `timezone`, crea únicamente un PortalUser y verifica `users.timezone`; contratos, API y Web completan build.

## Estado actual

```text
Actual: separación Admin/Portal implementada en código; falta aplicar la migración 0003, reclasificar la seed de producción y validar ambos perfiles desplegados.
Objetivo: Admin global y Portal separados de forma estricta.
```

No marcar fases como terminadas hasta validar tanto API como navegación web con dos usuarios distintos.
