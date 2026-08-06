# Plan — Teams y Members V2

## Estado

**Laravel auditado; UI mock y backend de Teams implementados en código. La migración `0019_minor_stick.sql` está aplicada a `zapi_v2_local` y a `zapi_v2` remoto; la validación verificó las dos tablas, sus dos constraints de invitación y los índices críticos.**

Teams gobierna membresías del workspace y el alcance de cuentas para Publishing y Channels. No se implementarán autorizaciones provisionales en esos dominios: consumirán la política central definida aquí.

## Evidencia Laravel

| Área         | Referencia                                                    | Comportamiento observado                                                                                  |
| ------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Workspace    | `ZapiSocial/modules/AppTeams/Livewire/Workspace.php`          | Roles, permisos JSON, invitaciones y grants de cuentas viven en un único componente Livewire.             |
| Acceso       | `Support/TeamWorkspaceAccess.php`                             | Owner evita restricciones; `managed_account_ids` es una allow-list del pivot.                             |
| Registro     | `Support/TeamPermissionRegistry.php`                          | Permisos por módulos y defaults por rol se registran dinámicamente.                                       |
| Invitaciones | `Models/TeamInvitation.php` y `Workspace::acceptInvite`       | El código de 8 caracteres puede aceptarse por cualquier usuario autenticado; el correo es solo metadato.  |
| Publishing   | `AppPublishingServiceProvider.php` y `PublishingCalendar.php` | `post.create`, `post.approve` y `post.publish` se mezclan con checks inconsistentes en acciones de posts. |

## Problemas heredados que V2 no replica

1. Un código de invitación no queda ligado al correo invitado y puede ser canjeado por otra persona.
2. Rol, permisos JSON y lógica de defaults se superponen; una corrección de permisos puede cambiar implícitamente los privilegios.
3. El modelo `editor` aparece en la autorización legacy, pero la interfaz siempre invita como `member`.
4. `managed_account_ids` se guarda como JSON en membresía; no tiene FK ni trazabilidad de cambios.
5. Las acciones de Publishing resuelven posts por equipo sin comprobar de forma uniforme autor, alcance de cuenta y permiso al mutar.
6. La aceptación, edición de miembros y cambios de permisos no generan una auditoría durable y consultable.

## Decisiones V2

### Roles y autorización

Roles canónicos: `owner`, `admin`, `member`. No existe `editor`.

| Acción                                        | Owner |                                       Admin |                       Member |
| --------------------------------------------- | ----: | ------------------------------------------: | ---------------------------: |
| Ver miembros y sus cuentas alcanzables        |    Sí |                                          Sí | Sí, solo su perfil y cuentas |
| Invitar member                                |    Sí |                                          Sí |                           No |
| Invitar/promover/admin o transferir ownership |    Sí |                                          No |                           No |
| Revocar member                                |    Sí |                                          Sí |                           No |
| Revocar/admin                                 |    Sí |                                          No |                           No |
| Cambiar grants de cuentas de member           |    Sí |                            Sí, solo members |                           No |
| Crear/editar/eliminar sus borradores          |    Sí |                                          Sí |   Sí, solo cuentas asignadas |
| Editar/eliminar borradores ajenos             |    Sí |                     Sí, cuentas alcanzables |                           No |
| Publicar o programar sin aprobación           |    Sí |                     Sí, cuentas alcanzables |                           No |
| Aprobar/rechazar                              |    Sí | Sí, cuentas alcanzables, sin autoaprobación |                           No |

Los permisos no se editan como una lista JSON desde Portal. El rol define las capabilities. Las excepciones futuras, si fueran necesarias, se modelarán explícitamente, auditadas y con vencimiento; no reutilizarán `permissions` como bolsa libre.

### Grants de cuentas

- Owner y admin alcanzan todas las cuentas activas del workspace.
- Member solo alcanza cuentas con fila en `social_account_memberships` vinculada a su `workspace_membership`.
- API y Worker verifican membership activa, rol, grant/cuenta, estado del canal y capability en cada operación.
- Al revocar un miembro se inactivan sus sesiones de workspace, se eliminan grants y se conserva auditoría; no se borran publicaciones históricas.

### Invitaciones

- Solo invitaciones privadas y ligadas a un correo normalizado.
- El token se guarda exclusivamente como hash; es de un uso, expira y se invalida al revocar.
- Al canjear se exige sesión con el mismo correo. Si no tiene cuenta, se le dirige a registro preservando el flujo de invitación, sin exponer el token en logs.
- La invitación define rol permitido por el emisor: admin solo puede invitar member; owner puede invitar admin o member.
- La aceptación y todos los cambios de membresía se auditan.

## Modelo V2 propuesto

Ya existen `workspaces`, `workspace_memberships` y `social_account_memberships`.

```text
workspace_invitations
  id, workspace_id, invited_by_user_id
  email_normalized, role
  token_hash, status: pending | accepted | revoked | expired
  expires_at, accepted_by_user_id nullable, accepted_at nullable
  created_at, updated_at

workspace_membership_audit_events
  id, workspace_id, actor_user_id nullable, subject_user_id nullable
  type, metadata_safe jsonb, created_at
```

`workspace_memberships.permissions` se mantiene temporalmente por compatibilidad del schema actual, pero no es fuente de autorización para Teams/Publishing nuevo. Una migración posterior lo depreca cuando no tenga consumidores.

## REST propuesto

```text
GET    /v1/teams/members
POST   /v1/teams/invitations
POST   /v1/teams/invitations/:id/revoke
POST   /v1/teams/invitations/accept
PATCH  /v1/teams/members/:userId/role
PUT    /v1/teams/members/:userId/account-grants
DELETE /v1/teams/members/:userId
GET    /v1/teams/audit-events
```

Errores públicos: `TEAM_ACCESS_DENIED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `ROLE_CHANGE_NOT_ALLOWED`, `ACCOUNT_GRANT_NOT_ALLOWED` y `MEMBER_LIMIT_REACHED`.

## Superficies V2

- `/portal/teams`: miembros, invitaciones pendientes, búsqueda y resumen de cuentas.
- Diálogo de invitación: correo requerido, rol permitido y texto claro sobre expiración/acceso.
- Diálogo de acceso por miembro: rol y cuentas asignadas; muestra restricciones del actor sin revelar detalles internos.
- Publishing consume los grants y roles, pero no replica UI de permisos.

Estados: normal, loading, vacío, búsqueda sin resultados, error, sin permiso, móvil y claro/oscuro.

## Secuencia

1. [x] Auditar Laravel y divergencias de seguridad.
2. [x] Implementar UI mock con fixtures sintéticas. Evidencia: `apps/web/features/teams/` y `apps/web/app/portal/teams/`.
3. [x] Definir contratos Zod, capacidades y errores públicos.
4. [x] Añadir migración aditiva para invitaciones y auditoría; aplicada y verificada en `zapi_v2_local` y en `zapi_v2` remoto. La remota estaba en `0017`, por lo que se aplicó también su dependencia aditiva `0018` dentro de la misma transacción y se registraron ambos hashes de Drizzle; el historial remoto quedó en 20 migraciones.
5. [ ] Implementar Nest, autorización central y tests de ownership/roles. Nest ya cubre listado, invitación/envío SMTP, aceptación, revocación, cambio de rol, grants y revocación de miembro; falta la prueba focal de ownership/roles.
6. [ ] Sustituir mocks y conectar Publishing/Channels a la política central.
7. [ ] Implementar transferencia de ownership y excepciones auditadas, si el producto las requiere.
