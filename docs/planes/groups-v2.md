# Groups V2

## Estado

El backend de grupos de cuentas está implementado; `/portal/groups` ya tiene un mockup source-first navegable con métricas, búsqueda, filtro, listado y sheet de creación. La siguiente fase es conectarlo a `groupsApi`.

Las métricas del mockup siguen el patrón de `/admin/users`: cards `subtle` individuales con etiqueta e icono en el header, valor y contexto breve en el contenido. La tabla de grupos conserva el foco visual y sus interacciones locales.

Un grupo es una clasificación privada del workspace sobre cuentas sociales existentes. No crea equipos, membresías ni permisos nuevos.

## REST

Base: `/v1/portal/groups`, siempre con sesión Portal.

| Método y ruta      | Responsabilidad                                           |
| ------------------ | --------------------------------------------------------- |
| `GET /?q=&status=` | Listar grupos, cuentas visibles y métricas del workspace. |
| `POST /`           | Crear grupo con nombre, color, estado y cuentas.          |
| `PATCH /:id`       | Editar datos o reemplazar la selección de cuentas.        |
| `DELETE /:id`      | Eliminar el grupo y sus relaciones.                       |

`owner` y `admin` pueden mutar. En lecturas, un miembro no administrador sólo recibe cuentas concedidas mediante `social_account_memberships`; las asociaciones sin permiso no aparecen en la respuesta.

## Persistencia y reglas

- `account_groups`: workspace, creador, slug único por workspace, nombre, descripción, color y estado.
- `account_group_social_accounts`: relación normalizada con cuenta y workspace; unicidad por grupo/cuenta.
- Crear/editar valida que todas las cuentas estén activas y pertenezcan al workspace.
- El slug se normaliza y desambigua; no lo controla el navegador.
- Las mutaciones se auditan como `group.created`, `group.updated` y `group.deleted`.
- No usa Worker: son transacciones cortas de PostgreSQL.

## Evidencia y pendientes

- [x] Contratos, API, cliente, schema y migración `0020_mushy_peter_parker`.
- [x] Migración aplicada en `zapi_v2_local` y typecheck de Database, Contracts, API Client y API.
- [x] Prueba local confirma aislamiento: otro workspace no lista ni elimina el grupo (`portal-backend-v2`, 3/3 en el conjunto).
- [x] Sustituir el placeholder genérico por un mockup source-first navegable, copiado desde `template-shadcn-superdashboard/src/app/(main)/dashboard/portal-modules`.
- [ ] Conectar el mockup a `groupsApi` y validar estados de carga, error y permisos con respuestas reales.
