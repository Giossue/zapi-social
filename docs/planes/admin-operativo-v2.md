# Admin operativo V2

## Estado

**Fases 1–4 implementadas el 23 de agosto de 2026 (pendiente la aprobación
visual).** Bloque 1 de [`mvp-codecanyon-v2.md`](./mvp-codecanyon-v2.md): un
administrador opera todo el negocio desde el panel.

Nota de cierre visual: el motor mockup secundario
(`platform-admin-mockups/`) se eliminó junto con sus tres consumidores al
conectarlos; los seis módulos operativos siguen sobre
`admin-module-preview.tsx`, que queda como el único motor. La deuda de «dos
motores» desapareció por borrado, no por migración.

## Lo que ya funciona (y no es maqueta)

Los seis módulos operativos —`/admin/users`, `/admin/credits`,
`/admin/affiliate`, `/admin/coupons`, `/admin/payments`,
`/admin/subscriptions`— consultan y mutan datos reales vía
`AdminOperationsService` (`apps/api/src/billing/admin-operations.service.ts`):
edición de usuario con plan y estado, desactivar/reactivar, CRUD de cupones,
aprobar/rechazar comisiones y retiros, reembolso y sincronización de pagos con
Polar, y revocar/cancelar al fin de periodo/reanudar suscripciones contra la
API de Polar.

En varios puntos V2 ya supera a la referencia: ZapiSocial no puede suspender
usuarios (su tabla `users` no tiene columna de estado), no reembolsa desde el
admin (su historial se declara "read-only"), y en suscripciones solo ofrece
**Delete** — la cancelación real solo existe en el portal del usuario.

## Cómo lo hace ZapiSocial (hechos observados)

- **Usuarios** (`modules/AdminUser`): listar con búsqueda y orden, crear,
  editar (plan, expiración, rol, `is_super_admin`, avatar, contraseña),
  borrado individual y masivo, e **impersonar** («View as user»:
  `UserImpersonationController` guarda `impersonator_id` en sesión, entra como
  el usuario y ofrece `impersonation.leave` para volver). Requiere el permiso
  `admin-users.edit`.
- **Roles** (`admin_roles`): sistema propio, sin spatie. Tabla con
  `permissions` (json de strings con comodines `grupo.*`), `users.role_id` +
  `is_super_admin`. `EnsureAdminAccess` (middleware global) exige
  `canAccessAdmin()` y `canAccessAdminRoute(routeName)`; el catálogo de
  permisos se genera desde el sidebar (`AdminPermissionCatalog`), con acciones
  `view/create/edit/delete` por módulo.
- **Teams** (`admin-user-teams`): listar y editar workspaces/equipos con sus
  miembros (`TeamIndex`/`TeamForm`).
- **Reporte de usuarios** (`AdminUserReportController`): altas mensuales (12m),
  diarias (30d) y semanales (8w), desglose por idioma, rol y plan, top equipos,
  tasas de verificación y 2FA.
- **Logs** (`admin-user-logs` sobre `audit_logs` con `log_activity()`):
  filtrable por usuario y fechas.
- Lo que ZapiSocial **no** tiene: suspender/banear, verificar email a mano,
  ficha-detalle de usuario, conceder créditos desde admin, reembolso, cancelar
  suscripción desde admin, «marcar payout como pagado» separado de Approve.

## Alcance V2

1. **Las tres superficies que estaban en maqueta**: `/admin/user-report`,
   `/admin/user-roles` y `/admin/teams` (eran fixtures sin una sola llamada a
   la API).
2. **Impersonación** («ver como el usuario»), que ZapiSocial sí tiene y V2 no:
   es la herramienta de soporte más usada de este tipo de producto.
3. **Conceder créditos desde la ficha** — mejora sobre ZapiSocial, que expone
   `grantPack()` pero ningún admin lo llama; el ledger de V2
   (`creditLedgerEntries`) ya modela `grant`.
4. **Cerrar la duplicación de motores visuales** (resuelto borrando el motor
   mockup con sus consumidores; ver nota de cierre en el estado).

## Fuera de alcance

- Roles de Portal/workspace (eso es [`teams-v2.md`](./teams-v2.md)).
- Facturas PDF y correos de recibo.
- Borrado masivo de usuarios (destructivo; se decide aparte).

## Diseño V2

### Roles de administrador

Hoy V2 solo distingue `users.isPlatformAdmin`. Se conserva la forma de
ZapiSocial adaptada:

- Tabla `admin_roles` (name, slug, description, `permissions` json) +
  `users.adminRoleId`.
- El catálogo de permisos es un **enum tipado en contracts** (no generado en
  runtime): una clave `view/manage` por módulo de Admin. Comodines `grupo.*`
  como en Laravel.
- `SessionAccessService.requirePlatformAdmin` acepta un permiso opcional:
  `requirePlatformAdmin(request, 'users.manage')`. Super admin
  (`isPlatformAdmin`) lo pasa todo; un rol se evalúa contra su json. Es un
  refinamiento del guard existente, no un guard nuevo.

### Impersonación

- `POST /v1/admin/users/:id/impersonate` crea una sesión Portal marcada con
  `impersonatorUserId` (columna nueva en `authSessions`); nunca sobre otro
  administrador.
- La web muestra una franja fija «Viendo como {nombre}» con «Salir», que llama
  a `POST /v1/auth/impersonation/leave` y restaura la sesión admin.
- Cada entrada y salida se audita en `apiAuditLogs`. La sesión impersonada no
  puede tocar rutas `/v1/admin` (la separación de áreas de
  [`seguridad.md`](../reglas/seguridad.md) ya lo garantiza).

### User report y teams

- `/admin/user-report`: las métricas de ZapiSocial (altas por periodo, por
  idioma y por plan, verificación) consultadas sobre `users`,
  `workspaceMemberships` y `workspacePlanAssignments`; misma composición
  visual que el mockup actual, que ya copia el template.
- `/admin/teams`: listar workspaces con dueño, plan, miembros y cuentas
  conectadas; la acción «Administrar módulos» edita el override por workspace
  sin permitir módulos excluidos por el plan.

## Orden

`Laravel auditado → contrato REST/Zod → API → conectar superficie por
superficie` (la UI ya existe como mockup aprobado; no hay fase de mock nueva).

## Fases

### Fase 1 — Roles de administrador

- [x] Tabla `admin_roles` + `users.adminRoleId` (migración 0043 en local y
      remota); catálogo tipado en contracts con comodines `*` y `modulo.*`.
      (23-08-2026)
- [x] Enforcement central en `requirePlatformAdmin`: deriva el permiso del
      método y la ruta (`GET → view`, resto → `manage`; `operations/:module`
      usa el módulo interior), con spec de 5 casos. Super admin pasa todo.
      (23-08-2026)
- [x] `/admin/user-roles` conectado: CRUD, rejilla de permisos por módulo y
      gestión de miembros con buscador. (23-08-2026)

### Fase 2 — Impersonación

- [x] `authSessions.impersonatorUserId` (migración 0044),
      `POST /v1/admin/users/:id/impersonate` y
      `POST /v1/auth/impersonation/leave` con cookies nuevas, rechazo de
      objetivos administradores y auditoría de entrada y salida. (23-08-2026)
- [x] Franja «Viendo como {nombre}» en el Portal con salida, y acción «Ver
      como el usuario» en el módulo de usuarios. (23-08-2026)

### Fase 3 — Reporte y teams

- [x] `/admin/user-report`: altas por mes, idioma y plan, verificación y
      últimos registros, sobre consultas reales. (23-08-2026)
- [x] `/admin/teams`: workspaces con dueño, plan, miembros y cuentas, con
      buscador, paginación de servidor y edición de módulos por workspace.
      (24-08-2026)

### Fase 4 — Créditos y cierre visual

- [x] Acción «Conceder créditos» en el módulo de usuarios: suma al saldo del
      workspace y deja asiento `grant` en el ledger, con hoja genérica de
      campos por acción en el motor. (23-08-2026)
- [x] Cierre visual por la vía corta: el motor mockup secundario se borró con
      sus tres consumidores y la entrada de «dos motores» salió de
      [`deuda-tecnica.md`](./deuda-tecnica.md). Los seis módulos siguen en
      `admin-module-preview.tsx`, único motor restante. (23-08-2026)

Evidencia del bloque: typecheck y build del monorepo, lint ×3, 57 pruebas de
API (permisos y cableados incluidos), auditorías i18n y de UI, y las tres
imágenes podman en verde el 23-08-2026.
