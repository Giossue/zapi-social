# Anuncios y notificaciones V2

## Estado

Implementado de extremo a extremo el 22 de agosto de 2026: contrato, API Nest,
cliente REST, superficie Admin y campana del Portal. La migración aditiva
`0035_lucky_chat` está aplicada en `zapi_v2_local` y en la base remota.

## Referencia Laravel

`AdminNotifications` guarda avisos manuales en `notification_manual` (título,
mensaje, URL, tipo, `is_global`, autor) y su estado por persona en
`notification_manual_states` (leído, archivado). El panel del usuario expone
feed, marcar una, marcar todas y archivar todas.

## Decisiones V2

- Un anuncio no genera una fila por destinatario al publicarse. La tabla de
  estado solo crece cuando alguien lee o archiva, de modo que un aviso global
  no escribe una fila por cada cuenta del sistema.
- La audiencia es explícita y está protegida por constraint: `all` sin destino,
  `workspace` con espacio y sin persona, `user` con persona y sin espacio. Un
  registro incoherente no puede existir aunque la API falle.
- `draft` frente a `published` sustituye al borrado como forma de retirar un
  aviso. Un anuncio en borrador no es visible para nadie en Portal.
- Republicar no reescribe `published_at`: la fecha original de publicación se
  conserva para que el orden del feed sea estable.
- El feed del Portal filtra siempre por la sesión: espacio activo y persona. No
  existe lectura de anuncios de otro workspace.
- El selector de destinatario devuelve como máximo diez coincidencias por
  búsqueda; no se expone el padrón completo de cuentas ni de espacios.
- El tipo `news` de Laravel no se replica: no aportaba comportamiento.

## Modelo durable

1. `platform_announcements`: título, cuerpo, URL opcional, audiencia, destino,
   estado, publicación, autor y timestamps.
2. `platform_announcement_reads`: anuncio, persona, `read_at`, `archived_at`,
   único por par anuncio/persona.

## Contrato REST

- `GET /v1/admin/notifications` — listado con búsqueda, estado, métricas.
- `GET /v1/admin/notifications/targets` — buscador acotado de destinatarios.
- `POST /v1/admin/notifications` — crear como borrador o publicado.
- `PATCH /v1/admin/notifications/:id` — editar y publicar o despublicar.
- `DELETE /v1/admin/notifications/:id` — eliminar con su historial.
- `GET /v1/portal/notifications` — feed de la sesión con contador sin leer.
- `POST /v1/portal/notifications/:id/read` — marcar una.
- `POST /v1/portal/notifications/read-all` — marcar todas.
- `POST /v1/portal/notifications/archive-all` — archivar todas.

## Superficies

| Ruta                   | Alcance                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `/admin/notifications` | Métricas, tabla paginada, alta y edición en sheet, borrado confirmado.     |
| Campana del Portal     | Popover en el encabezado con feed, no leídos, marcar todo y archivar todo. |

La campana solo se monta cuando la sesión tiene espacio de trabajo activo, así
que no aparece en el shell de Admin.

## Fuera de alcance

- Notificaciones automáticas de producto (publicación fallida, cuota, canal
  desconectado): este módulo cubre solo avisos manuales.
- Envío por correo o push del anuncio.
- Programar la publicación en una fecha futura.

## Evidencia — 22 de agosto de 2026

- Migración probada en `BEGIN … ROLLBACK` y luego aplicada; historial 35 → 36
  en `zapi_v2_local` y en la remota, con las dos tablas, sus cuatro checks, el
  índice único y las claves foráneas verificados en ambas.
- `packages/database`, `packages/contracts`, `packages/api-client`, `apps/api` y
  `apps/web` pasan `tsc --noEmit`; `bun run build` correcto en los 6 workspaces
  con `/admin/notifications` en la salida de Next.
- `bun run audit:portal-admin-ui` sin hallazgos.
- No hay prueba de integración: no existe todavía suite focal para este módulo.
- Falta la aprobación visual del usuario.
