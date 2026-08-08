# AI Studio V2

## Estado

El backend AI de Portal está implementado con contrato Zod, API Nest, persistencia Drizzle, colas BullMQ, ledger de créditos y Worker. La UI de las rutas AI todavía debe sustituir sus fixtures por `aiApi` y validar el flujo autenticado con un proveedor configurado.

No se simulan respuestas: las tareas de texto e imagen requieren un proveedor compatible con OpenAI. `timing` usa histórico local de Publishing y `search` puede operar en modo léxico local o híbrido cuando existe proveedor.

## Alcance implementado

- Solicitudes `content`, `image`, `repurpose`, `planner`, `review`, `timing`, `search` y `ai_publishing`.
- Historial paginado y aislado por workspace y usuario.
- Cancelación sólo mientras la solicitud sigue en cola, con devolución idempotente de créditos. Una vez procesando no se devuelve crédito mientras el proveedor puede estar consumiendo la petición.
- Voz de marca, idioma y tono por workspace; preferencias personales por usuario.
- Generación de imágenes persistida como `file_assets`, con miniatura WebP y metadata de procedencia.
- Conversión de resultados terminados en borradores de Publishing, uno por cuenta destino.
- Programaciones AI diarias o semanales, timezone IANA, ejecución manual, pausa y despacho periódico.

## REST

Base: `/v1/portal/ai`. Todos los endpoints exigen sesión Portal y aplican scope de workspace.

| Método y ruta                            | Responsabilidad                                                       |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `GET /requests`                          | Listar solicitudes propias, paginadas y filtrables por tipo/estado.   |
| `POST /requests`                         | Crear y encolar una solicitud con `idempotencyKey`.                   |
| `GET /requests/:id`                      | Consultar estado y resultado seguro.                                  |
| `POST /requests/:id/cancel`              | Cancelar únicamente si todavía está en cola y compensar créditos.     |
| `POST /requests/:id/use-as-draft`        | Crear borradores Publishing en cuentas y media válidas del workspace. |
| `GET/PATCH /settings`                    | Leer settings efectivos y actualizar settings de usuario/workspace.   |
| `GET /credits`                           | Consultar saldo y últimas entradas del ledger.                        |
| `GET/POST /publishing-schedules`         | Listar o crear programaciones AI.                                     |
| `PATCH/DELETE /publishing-schedules/:id` | Editar o eliminar una programación propia del workspace.              |
| `POST /publishing-schedules/:id/run`     | Crear una ejecución manual.                                           |

`owner` y `admin` administran settings de workspace y programaciones; cualquier miembro con sesión puede mantener sus preferencias y solicitudes propias.

## Persistencia

- `workspace_credit_accounts`: saldo durable, ciclos y opción `unlimited` por workspace.
- `credit_ledger_entries`: `grant`, `debit`, `refund` y `adjustment`, con clave idempotente.
- `ai_workspace_settings` y `ai_user_settings`: configuración colectiva y personal separada.
- `ai_requests`: entrada, resultado seguro, coste, proveedor/modelo, estado, job y error público.
- `ai_publishing_schedules` y `ai_publishing_schedule_targets`: recurrencia y cuentas destino normalizadas.
- `file_assets.metadata`: procedencia de imágenes generadas o importadas.

La migración Drizzle que materializa este slice es `0020_mushy_peter_parker`; `0021_pale_thor` endurece créditos por defecto e integridad cross-workspace de Publishing.

## Worker e idempotencia

- Cola `ai-requests`, job estable `ai-<requestId>`, tres intentos y backoff exponencial de 5 segundos.
- La unicidad `(workspace_id, requested_by_user_id, idempotency_key)` evita solicitudes y débitos duplicados, incluso ante carreras concurrentes.
- El débito y la solicitud se crean en una transacción; una caída de cola o un fallo definitivo generan una sola devolución `ai-refund-<requestId>`.
- Una cuenta de créditos nueva inicia con saldo `0` y `unlimited=false`; el alta de saldo o cuota requiere una política administrativa aprobada. La API limita a 10 solicitudes nuevas por usuario/workspace/minuto (`AI_REQUEST_RATE_LIMITED`), sin afectar reintentos idempotentes.
- El dispatcher `ai-schedule-dispatch` revisa cada minuto programaciones vencidas, reclama el siguiente slot con actualización condicional y usa `ai-schedule-<scheduleId>-<nextRunAt>` como clave estable.
- El Worker recupera solicitudes `queued` persistidas al arrancar; PostgreSQL sigue siendo la fuente de verdad.
- `ai_publishing` genera borradores editables y emite `post.created`; no publica contenido sin revisión del usuario.

## Seguridad y despliegue

- El prompt de sistema, la clave y la respuesta cruda del proveedor no se exponen al navegador.
- Cada consulta valida usuario, workspace, cuentas activas y archivos `ready` del mismo workspace.
- Las imágenes se validan con `sharp`, tienen límite de 25 MB y se limpian del volumen si falla la persistencia.
- API y Worker comparten PostgreSQL, Redis y el mismo volumen/ruta `FILES_STORAGE_PATH`.
- Variables opcionales del Worker: `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`, `AI_TEXT_MODEL` y `AI_IMAGE_MODEL`. Sin ellas, las tareas que requieren proveedor fallan con código público explícito; `timing` y búsqueda léxica siguen siendo locales.
- Nunca versionar valores de esas variables ni claves del proveedor.

## Evidencia y pendientes

- [x] Contratos, API, cliente, schema y Worker implementados.
- [x] `0020_mushy_peter_parker` y `0021_pale_thor` aplicadas en `zapi_v2_local`; existen `ai_requests`, cuentas de crédito y ledger.
- [x] Typecheck de Database, Contracts, API Client, API y Worker.
- [x] Prueba local de idempotencia: dos solicitudes con la misma clave crean una fila, un débito y consumen una unidad (`portal-backend-v2`, 3/3 en el conjunto).
- [ ] Conectar todas las rutas Web AI a `aiApi` y retirar fixtures.
- [ ] Smoke autenticado con un proveedor aprobado y presupuestos/modelos de producción definidos.
- [ ] Añadir políticas administrativas para grants, ajustes y ciclos de créditos; el backend no inventa compras de créditos.
