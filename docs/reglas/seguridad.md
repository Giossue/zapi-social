# Reglas de seguridad

Este documento define qué significan en Zapi V2 los criterios que [`calidad.md`](./calidad.md) exige revisar: sesión, autorización, ownership, secretos y validación de entrada. La matriz de validación y el orden de revisión viven allí; aquí está la norma concreta.

## Sesión y área

- La sesión se resuelve **siempre** desde `SessionAccessService`, nunca leyendo la cookie ni consultando la tabla de sesiones dentro de un servicio de dominio.
- Un controlador Portal empieza cada handler con `requirePortalSession(request)`; uno de plataforma, con `requirePlatformAdmin(request)`. No existe handler autenticado sin una de las dos llamadas.
- Portal y Admin son áreas distintas: una sesión Portal no accede a rutas `/v1/admin` aunque el usuario sea administrador, y a la inversa. Esa separación se comprueba en API, no en la navegación.
- Los fallos de sesión y área usan `AppException` con los códigos existentes (`AUTH_SESSION_EXPIRED`, `AUTH_PORTAL_ACCESS_REQUIRED`, `AUTH_ADMIN_ACCESS_REQUIRED`). No inventar códigos ni devolver 500 para un problema de permisos.

## Ownership

- Toda lectura y toda escritura filtran por el workspace de la sesión dentro de la consulta Drizzle: `eq(tabla.workspaceId, session.workspace.id)`. Filtrar en memoria después de traer filas ajenas no es ownership.
- Recibir un identificador en la ruta no autoriza nada. Un `:id` se resuelve junto a su workspace en la misma consulta; si no aparece, la respuesta es "no encontrado", no "prohibido".
- Un permiso comprobado en Web es presentación. La misma comprobación se repite en API para cada registro y, cuando el trabajo continúa en background, también en Worker.
- Los recursos que cruzan workspaces —archivos, cuentas conectadas, plantillas— se validan por su FK real, no por confianza en el identificador recibido.

## Entrada y contrato

- Todo cuerpo, query y parámetro entra al servicio como `unknown` y se valida con el schema Zod de `packages/contracts`. No se accede a una propiedad antes de parsear.
- Los schemas de escritura usan `.strict()` para que un campo desconocido falle en vez de ignorarse en silencio.
- La API no expone entidades Drizzle: devuelve el DTO del contrato. Un campo nuevo se agrega primero al schema y luego a la respuesta.
- La validación de binarios usa `packages/file-ingestion`; no reimplementar comprobaciones de MIME, extensión, firma o límite por feature.

## Secretos

- Credenciales de providers, claves de cifrado, `DATABASE_URL` y configuración de Redis permanecen en API y Worker. Web nunca las recibe, ni siquiera para renderizar en servidor.
- Un secreto guardado se cifra con `Aes256GcmService`; no se almacena en claro ni se devuelve al cliente. La respuesta indica estado (`configured`, `ready`) o un valor redactado.
- Los logs redactan tokens, claves y cuerpos con credenciales. Un error de provider se registra por su código y mensaje normalizado.
- No se escriben secretos ni valores de `.env` en documentación, planes, fixtures, mensajes de commit ni descripciones de PR. Esta norma vale también para las credenciales de base de datos descritas en [`workflow.md`](./workflow.md).

## Fronteras externas

- Toda llamada a un provider sale de un adapter server-side con timeout, error normalizado y límite de reintentos.
- Un webhook entrante verifica su firma antes de leer el cuerpo y es idempotente por identificador de evento.
- El trabajo asíncrono conserva su estado en PostgreSQL: el job no es la única evidencia de progreso ni de autorización.

## Al cerrar un cambio

Antes de dar por terminado un cambio que toque datos, sesión o providers, comprobar en este orden: pérdida de datos, secretos expuestos, sesión y área, ownership por registro, idempotencia. El detalle del cierre está en [`calidad.md`](./calidad.md).
