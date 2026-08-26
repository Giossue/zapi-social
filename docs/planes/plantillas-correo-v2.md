# Plantillas de correo V2

## Estado

Implementado el 22 de agosto de 2026: contrato, API Nest, cliente REST,
superficie Admin y sustitución real en el envío. La migración aditiva
`0037_needy_steel_serpent` está aplicada en `zapi_v2_local` y en la remota.

Ampliado el 23 de agosto de 2026 con la dimensión de idioma
([`i18n-v2.md`](./i18n-v2.md), fase 4): cada correo sale en el idioma del
destinatario. La migración `0038_reflective_tombstone` **está generada pero no
aplicada**: la base local no era alcanzable en el entorno donde se escribió.

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
- El idioma sale de `users.locale` del destinatario, no de quien dispara la
  acción. Una invitación puede ir a un correo que todavía no tiene cuenta: en
  ese caso, y ante un valor desconocido, se usa español.
- La personalización es por idioma. Un override guardado en español no se
  aplica a los destinatarios en inglés: cada idioma tiene su propia fila y su
  propio estado «personalizado». Restablecer desde la tabla limpia todos los
  idiomas de ese correo.
- La vista previa del cliente de correo, las etiquetas de detalle («Espacio»,
  «Rol»), los nombres de rol y el pie siguen el idioma pero **no** son
  editables desde Admin: un cuerpo en inglés con etiquetas en español se ve
  roto, y exponerlas multiplicaría los campos del editor sin necesidad.
- Cada plantilla declara sus variables (`{{workspaceName}}`, `{{actorName}}`…)
  y la sustitución solo reemplaza tokens conocidos. Un token inventado se
  queda literal en vez de romper el envío o vaciar la frase.
- La transferencia de propiedad se divide en dos claves —nuevo propietario y
  propietario anterior— porque su asunto y su mensaje siempre difirieron.
- Un fallo al resolver la plantilla no debe impedir el correo: la resolución
  parte siempre del catálogo y solo lo pisa una fila existente.

## Modelo durable

`email_templates`: clave, idioma, asunto, título, cuerpo, texto de botón,
aviso, estado, autor de la última edición y timestamps. El índice único es
`(key, locale)`: una fila por correo e idioma personalizado.

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

## Texto por defecto y anulaciones por idioma

Hasta el 26 de agosto de 2026 los correos solo existían en `es` y `en`, porque `supportedLocaleSchema` es un enum cerrado y el diálogo pintaba una pestaña por cada uno. Con 30 idiomas añadidos desde Admin el diálogo no crecía: los 30 recibían el correo en español, porque `users.locale` es un `varchar(8)` libre y el catálogo no los tenía.

Ahora cada plantilla tiene:

- **Un texto por defecto**, guardado con el idioma reservado `"*"`. Es el que se usa en cualquier idioma sin versión propia.
- **Anulaciones por idioma**, opcionales, para cualquier código de idioma. Solo existen las que el administrador crea.

El diálogo cambia la tira de pestañas por un selector con los idiomas activos, así que escala igual con 2 que con 300. La lista muestra el estado del texto por defecto y un contador de idiomas propios.

No hizo falta migración: las filas `es`/`en` que ya existían pasan a ser anulaciones por idioma, que es justo lo que eran.

### Orden de resolución al enviar

1. Anulación del idioma del destinatario, si está activa.
2. Texto por defecto (`"*"`), si está activo.
3. Catálogo incluido en el código, para ese idioma.
4. Catálogo incluido en español.

El paso 2 va antes del 3 a propósito: si el administrador editó el texto por defecto, ha expresado una intención para todos los idiomas y debe ganar al texto de fábrica. Las seis reglas están cubiertas en `apps/api/src/email/email-templates-resolution.spec.ts`.
