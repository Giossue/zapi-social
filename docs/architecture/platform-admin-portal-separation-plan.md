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

| Acción           | PlatformAdmin       | PortalUser                                           |
| ---------------- | ------------------- | ---------------------------------------------------- |
| Login            | redirigir `/admin`  | redirigir `/portal/dashboard`                        |
| Registro público | prohibido           | crea usuario + workspace personal + owner membership |
| Logout           | `/login`            | `/login`                                             |
| Refresh          | conserva área admin | conserva workspace activo                            |

El registro público nunca puede crear `is_platform_admin = true`.

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

- [ ] Añadir `users.is_platform_admin` al schema Drizzle.
- [ ] Crear migración reversible/aditiva.
- [ ] Definir constraints o validaciones de consistencia entre PlatformAdmin y memberships.
- [ ] Migrar o reclasificar usuarios existentes de producción con plan explícito.

### B. Sesión y autenticación

- [ ] Hacer `workspace` opcional en contrato de sesión Admin.
- [ ] Añadir `area` a contratos y API client.
- [ ] Cambiar `IdentityService.getSession()` para resolver PlatformAdmin sin workspace.
- [ ] Impedir registro público de PlatformAdmin.
- [ ] Redirigir login por área.
- [ ] Invalidar o renovar sesiones emitidas con el contrato anterior.

### C. Guards API

- [ ] Crear guard reutilizable `requirePlatformAdmin`.
- [ ] Crear guard reutilizable `requirePortalSession`.
- [ ] Aplicar guard Admin a Integrations y futuros módulos `/v1/admin/*`.
- [ ] Aplicar guard Portal a Dashboard, Channels y futuros módulos `/v1/portal/*`.
- [ ] Eliminar comprobaciones Admin basadas en `workspace.role === 'owner'`.

### D. Rutas y UI Web

- [ ] Crear `/admin` como dashboard administrativo inicial.
- [ ] Redirigir PlatformAdmin autenticado de `/portal/*` a `/admin`.
- [ ] Redirigir PortalUser autenticado de `/admin/*` a `/portal/dashboard`.
- [ ] Ajustar `AppShell` para no cargar navegación Portal bajo sesión Admin.
- [ ] Mantener layout Admin independiente y tokens compartidos.
- [ ] Crear estados loading/error/sin permiso para ambas áreas.

### E. Seed y operación

- [ ] Corregir `seed:users` para crear PlatformAdmin real y PortalUser separado.
- [ ] Documentar variables `SEED_*` por área.
- [ ] Ejecutar seed solo de forma manual y borrar variables al terminar.
- [ ] Definir procedimiento de bootstrap del primer PlatformAdmin en producción.

### F. Validación

- [ ] Test: PlatformAdmin login → `/admin`.
- [ ] Test: PortalUser login → `/portal/dashboard`.
- [ ] Test: PlatformAdmin no accede a `/v1/portal/*`.
- [ ] Test: PortalUser no accede a `/v1/admin/*`.
- [ ] Test: registro público crea solamente PortalUser.
- [ ] Test: seed no crea memberships para PlatformAdmin.
- [ ] Typecheck, build, migración en staging y revisión visual.

## Estado actual

```text
Actual: owner de workspace puede entrar a /admin/integrations y todos los logins van a Portal.
Objetivo: Admin global y Portal separados de forma estricta.
```

No marcar fases como terminadas hasta validar tanto API como navegación web con dos usuarios distintos.
