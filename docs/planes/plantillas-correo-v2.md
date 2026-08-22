# Plantillas de correo V2

## Estado

Implementado el 22 de agosto de 2026: contrato, API Nest, cliente REST,
superficie Admin y sustitución real en el envío. La migración aditiva
`0037_needy_steel_serpent` está aplicada en `zapi_v2_local` y en la remota.

## Referencia Laravel

`AdminMailServer` solo configura el transporte (protocolo, SMTP, remitente,
prueba de envío). ZapiSocial no permite editar el texto de sus correos: las
vistas Blade son código. Esta superficie es una mejora deliberada de V2, no una
equivalencia.

En V2 el transporte ya vive en `/admin/integrations` como integración SMTP
cifrada, así que este plan cubre exclusivamente el contenido.

## Decisiones V2

- Se editan cadenas, no HTML. Un administrador cambia asunto, título, mensaje,
  texto del botón y aviso final; la maquetación, los colores, el destino del
  botón y los detalles calculados siguen en el código. Esto elimina la
  superficie de inyección que tendría un editor HTML libre.
- El catálogo del código es la fuente de verdad. La tabla solo guarda
  personalizaciones: si no hay fila, el correo usa el texto por defecto y la UI
  lo muestra como «Texto por defecto». Restablecer borra la fila.
- Cada plantilla declara sus variables (`{{workspaceName}}`, `{{actorName}}`…)
  y la sustitución solo reemplaza tokens conocidos. Un token inventado se
  queda literal en vez de romper el envío o vaciar la frase.
- La transferencia de propiedad se divide en dos claves —nuevo propietario y
  propietario anterior— porque su asunto y su mensaje siempre difirieron.
- Un fallo al resolver la plantilla no debe impedir el correo: la resolución
  parte siempre del catálogo y solo lo pisa una fila existente.

## Modelo durable

`email_templates`: clave única, asunto, título, cuerpo, texto de botón, aviso,
estado, autor de la última edición y timestamps.

## Contrato REST

- `GET /v1/admin/email-templates` — las siete plantillas con su texto vigente,
  sus variables y si están personalizadas.
- `PATCH /v1/admin/email-templates/:key` — sobrescribir textos.
- `DELETE /v1/admin/email-templates/:key` — restablecer el texto por defecto.

## Plantillas cubiertas

`password_reset`, `team_invitation`, `team_invitation_accepted`,
`team_access_updated`, `team_member_removed`, `team_ownership_new_owner` y
`team_ownership_previous_owner`.

## Fuera de alcance

- Editar la maquetación, el logotipo o los colores del correo.
- Traducir la plantilla por idioma del destinatario.
- Previsualizar el correo renderizado desde Admin.
- Plantillas de correos que todavía no existen en V2.

## Evidencia — 22 de agosto de 2026

- Migración probada en `BEGIN … ROLLBACK` y aplicada; historial 37 → 38 en
  `zapi_v2_local` y en la remota.
- `apps/api` pasa `tsc --noEmit` y su suite: 12 pruebas correctas y 40 omitidas
  por falta de base de datos de test, incluida `email.templates.spec.ts`.
- `bun run build` correcto en los 6 workspaces con `/admin/email-templates` en
  la salida de Next; `audit:portal-admin-ui` sin hallazgos.
- No se envió un correo real de verificación: requiere SMTP configurado.
- Falta la aprobación visual del usuario.
