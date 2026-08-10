# Billing Admin y Polar.sh V2

## Estado

La vertical Admin está operativa sobre PostgreSQL y **Polar.sh es la única pasarela**. Usuarios, planes, créditos, afiliados, cupones, pagos y suscripciones ya leen datos reales; la configuración Polar se cifra en API y los webhooks firmados son la fuente de verdad para activar planes, acreditar compras, registrar pagos y crear comisiones.

## Evidencia recuperada de Laravel

El módulo observado es `modules/PaymentPolar`. La especificación histórica estaba en `documentos/resumen-pasarela-polar.md` (commit `314d20f2`) y la evolución específica se encuentra en `f4f555fe`, `007c15bf`, `3ea32148`, `1fb7cc73`, `d8d3edb1` y `92fffd80`.

Comportamiento observado:

- gateways `polar` para pago único y `polar_recurring` para suscripción;
- ambientes sandbox y producción;
- Organization Access Token y secreto de Standard Webhooks;
- producto de pago único y productos mensuales/anuales;
- precio local enviado como precio dinámico en unidad menor;
- importe mínimo validado en USD 0.50 después de descuentos;
- checkout asociado al usuario y plan mediante metadata;
- verificación del checkout antes de activar el plan;
- webhooks firmados con tolerancia temporal de cinco minutos;
- cancelación remota existente mediante revocación inmediata;
- historial de pagos, suscripciones, cupones, créditos y afiliados como módulos Admin separados.

No se recuperan Stripe, PayPal, pagos manuales ni ningún otro gateway eliminado del árbol de trabajo Laravel.

## Diferencias y mejoras V2

- Polar se presenta como Merchant of Record, no como un selector entre múltiples procesadores.
- Admin distingue **cancelar al final del período** de **revocar inmediatamente**; la segunda acción es irreversible y no equivale a un reembolso.
- La sincronización futura contemplará estados `trialing`, `active`, `past_due`, `canceled` y `unpaid`.
- La lista futura de eventos incluye `checkout.expired`, `subscription.past_due` y `subscription.uncanceled`, además de los eventos históricos.
- Los secretos permanecen solo en API; Web recibirá exclusivamente indicadores como `configured` y valores redactados.
- Un pago confirmado será la única fuente que pueda activar un plan pagado o volver disponible una comisión.
- Los cupones deben respetar el mínimo aceptado por Polar antes de abrir checkout.

## Superficies Admin

| Ruta                   | Alcance del mockup                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `/admin/integrations`  | Configuración Polar: estado, ambiente, credenciales, productos, checkout y endpoints. |
| `/admin/users`         | Cuentas Portal, acceso, plan, workspace y estado.                                     |
| `/admin/plans`         | Catálogo operativo con métricas, filtros, tabla paginada, permisos y CRUD real.       |
| `/admin/credits`       | Tabs Paquetes, Movimientos y Uso.                                                     |
| `/admin/affiliate`     | Tabs Afiliados, Comisiones y Retiros.                                                 |
| `/admin/coupons`       | Descuentos, límites, planes y vigencia.                                               |
| `/admin/payments`      | Historial exclusivo de Polar, detalle, sincronización y reembolsos.                   |
| `/admin/subscriptions` | Renovaciones, mora, cancelación al final y revocación inmediata.                      |

## Fuente visual

`diseño ideal` ya contiene el patrón de tabla de usuarios. Para las superficies sin equivalente exacto se creó el demo canónico `/dashboard/platform`, reutilizando su densidad de card, toolbar, filtros, tabla, menú contextual y `TablePagination`. El demo incluye ahora Planes como superficie canónica; Zapi V2 copia esa composición sobre `/admin/plans` y conserva sus filtros adicionales de cobro y visibilidad, además del REST/CRUD existente.

Todas las tablas de Usuarios, Créditos, Afiliados, Cupones, Pagos y Suscripciones usan `TablePagination` en modo detallado. El cambio de tab, búsqueda, estado o tamaño reinicia la página para evitar rangos vacíos.

La única divergencia visual deliberada al copiar a V2 es el color semántico de estados: Zapi V2 usa las variantes globales `success`, `warning`, `neutral` y `destructive` de `Badge`; el repositorio fuente todavía no expone todas esas variantes.

## Contrato operativo

```text
GET  /v1/admin/operations/:module
POST /v1/admin/operations/:module
POST /v1/admin/operations/:module/:tab/:id/actions

GET   /v1/admin/integrations/polar
PATCH /v1/admin/integrations/polar
POST  /v1/webhooks/polar
```

- Todas las rutas Admin exigen `PlatformAdmin`; el webhook es público pero requiere firma Standard Webhooks válida.
- Los secretos se guardan cifrados en `provider_integrations` y Web sólo recibe indicadores redactados.
- `billing_webhook_events.external_event_id` hace idempotente cada entrega; un evento fallido con el mismo hash puede reintentarse y un ID reutilizado con otro payload se rechaza.
- `order.paid` crea el pago una sola vez y, según metadata validada, asigna plan o acredita el paquete en el libro existente de créditos.
- `order.refunded` reconcilia el importe, revierte créditos todavía disponibles, devuelve el workspace al plan gratuito cuando corresponde y cancela comisiones aún no pagadas.
- Las suscripciones se sincronizan con estados Polar, cancelación al final, reactivación y revocación inmediata.
- Cupones se conservan localmente y se sincronizan con Discounts de Polar cuando la integración está disponible.
- Retiros de afiliados usan transiciones `requested → approved → paid` o `requested → rejected`; lo pagado permanece descontado del saldo retirable.

## Persistencia

Las migraciones `0028_nappy_ulik` y `0029_curly_shadowcat` añaden:

```text
workspace_plan_assignments
credit_packages
billing_coupons
billing_payments
billing_subscriptions
billing_refunds
billing_webhook_events
affiliate_commissions.external_reference
```

Importes se guardan en unidad menor e ISO-4217. Pagos y reembolsos no se borran; se actualizan mediante estados y auditoría HTTP.

## Fases

- [x] Auditar módulos Laravel y commits Polar.
- [x] Decidir Polar como único gateway y separar billing de Commerce Portal.
- [x] Construir el demo canónico y los mockups Admin con fixtures sintéticos.
- [x] Aprobar mockups Admin.
- [x] Definir contratos REST/Zod y permisos PlatformAdmin.
- [x] Implementar configuración cifrada, adapter oficial Polar y verificación de webhooks.
- [x] Persistir pagos, suscripciones, reembolsos y eventos idempotentes.
- [x] Conectar planes, cupones, créditos y comisiones al ciclo de pago verificado.

## Evidencia de la fase mock

- `diseño ideal`: `bun run build` correcto; rutas `/dashboard/platform` y `/dashboard/platform/polar` generadas.
- Zapi V2 Web: typecheck y build correctos; rutas Admin de los ocho módulos generadas.
- Lint Web completo sin errores; conserva advertencias previas ajenas a esta superficie.
- `git diff --check` correcto.

## Evidencia de la iteración de tablas

- Planes reemplaza la cuadrícula de cards por la composición operativa canónica y mantiene `plansApi.list/create/update/remove`.
- La paginación local actúa sobre el resultado ya filtrado; no cambia contratos REST ni persistencia.
- `diseño ideal`: check focal del demo y `bun run build` correctos; el check completo conserva errores previos ajenos en Auth/Profile.
- Zapi V2 Web: typecheck y build correctos; lint completo con 0 errores y 50 advertencias previas.
- `git diff --check` correcto en ambos repositorios.

## Evidencia de cierre funcional

- Migraciones `0028` y `0029` probadas con `BEGIN/ROLLBACK` y aplicadas en `zapi_v2_local` y el servicio remoto `zapi_v2`; ambas bases registran 30 migraciones, siete tablas nuevas y los constraints críticos esperados.
- Typecheck de Database, Contracts, API Client, API y Web correcto.
- Prueba transaccional reversible: crear, listar, duplicar y ocultar un paquete de créditos; no dejó fixtures.
- Prueba transaccional reversible: guardar credenciales Polar y comprobar que el ciphertext no contiene el secreto ni la respuesta lo expone.
- Prueba focal: una firma Polar inválida responde como prohibida antes de tocar persistencia.
- Los diez listados Admin ejecutaron consultas reales contra la base local sin errores.
