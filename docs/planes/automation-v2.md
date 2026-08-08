# Automation V2

## Estado

El backend de API keys, API externa y webhooks salientes está implementado. `/portal/automation` todavía cae en el placeholder genérico de rutas y debe construir su página sobre `automationApi`.

## Administración Portal

Base: `/v1/portal/automation`, con sesión Portal. `owner` y `admin` crean/revocan claves y administran webhooks; cualquier miembro puede leer la configuración visible del workspace.

| Método y ruta          | Responsabilidad                                                               |
| ---------------------- | ----------------------------------------------------------------------------- |
| `GET /`                | Listar keys redactadas, webhooks, últimos 100 logs y `canManage`.             |
| `POST /api-keys`       | Crear key con permisos y expiración opcional; devuelve el token una sola vez. |
| `DELETE /api-keys/:id` | Revocar una key.                                                              |
| `POST /webhooks`       | Crear endpoint y secret de firma.                                             |
| `PATCH /webhooks/:id`  | Editar, habilitar/pausar o rotar secret.                                      |
| `DELETE /webhooks/:id` | Eliminar endpoint y entregas asociadas.                                       |

## API para integradores

Autenticación con `Authorization: Bearer <token>` o `X-API-Key`:

| Método y ruta                 | Permiso                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `GET /v1/automation/me`       | Key activa; devuelve workspace y permisos.                                     |
| `GET /v1/automation/accounts` | `accounts:read`.                                                               |
| `GET /v1/automation/posts`    | `posts:read`.                                                                  |
| `POST /v1/automation/posts`   | `posts:write`; crea draft, programación o publicación inmediata en Publishing. |

`externalReference` hace idempotente la creación por workspace, cuenta y origen Automation. Cuentas y media se revalidan como activas/`ready` del mismo workspace.

## Webhooks y seguridad

- Eventos actuales: `post.created`, `post.published` y `post.failed`.
- Cada suscripción crea una entrega durable única por webhook + evento + sujeto; los eventos repetibles incluyen una ocurrencia para no ocultar fallos posteriores de un mismo post.
- El cuerpo se firma HMAC-SHA256 sobre `<timestamp>.<body>` y se envían `X-Zapi-Delivery`, `X-Zapi-Event`, `X-Zapi-Timestamp` y `X-Zapi-Signature`.
- El secret se cifra AES-256-GCM con `PROVIDER_INTEGRATIONS_ENCRYPTION_KEY`; sólo se muestra al crear o rotar.
- Las API keys se almacenan como SHA-256 y sólo se conserva un prefijo visible.
- La validación SSRF rechaza credenciales en URL, localhost, puertos distintos de 80/443, direcciones privadas/reservadas IPv4/IPv6, resoluciones DNS privadas y redirecciones. En producción exige HTTPS y el Worker fija la IP DNS validada al conectar para evitar DNS rebinding.
- Timeout de entrega: 15 segundos. Máximo cinco intentos, con esperas de 1 min, 5 min, 30 min y 2 h.

## Persistencia y Worker

- `automation_api_keys`, `automation_webhooks`, `automation_webhook_deliveries` y `automation_logs`.
- El dispatcher `automation-webhooks` revisa entregas vencidas cada 30 segundos, recupera claims `processing` caducados y usa `webhook-<deliveryId>-<attemptCount>` como job estable.
- Logs inbound/outbound registran evento, resultado, status HTTP y metadata acotada; no almacenan tokens ni secrets.
- Productores actualmente conectados: Publishing, Bulk, RSS, AI Publishing y API Automation.

## Evidencia y pendientes

- [x] Contratos, API, cliente, schema y Worker en `0020_mushy_peter_parker`; `0021_pale_thor` aporta las restricciones cross-workspace de los posts producidos.
- [x] Migración aplicada localmente y typecheck de Database, Contracts, API Client, API y Worker.
- [x] Lint focalizado del código nuevo API/Worker sin errores.
- [ ] Sustituir el placeholder por una página conectada a `automationApi`.
- [x] Pruebas unitarias de rechazo SSRF, HTTPS obligatorio y validación de IP pública; queda pendiente el smoke HTTP firmado de extremo a extremo.
- [ ] Añadir rate limit por key antes de exponer la API a terceros.
