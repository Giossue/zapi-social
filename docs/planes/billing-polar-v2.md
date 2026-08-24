# Billing Admin y Polar.sh V2

## Estado

La vertical Admin y el catálogo de planes del Portal están operativos sobre
PostgreSQL y **Polar.sh es la única pasarela**. Usuarios, planes, créditos,
afiliados, cupones, pagos y suscripciones ya leen datos reales; la
configuración Polar se cifra en API y los webhooks firmados son la fuente de
verdad para activar planes, acreditar compras, registrar pagos y crear
comisiones.

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
- El sistema opera en una sola moneda: USD. El catálogo ISO completo de Laravel (`modules/AdminPlans/Support/CurrencyCatalog.php`) no se porta y `/admin/plans` no ofrece selector de moneda; `plans.currency` queda fijado por constraint y no existe conversión en ninguna capa.

## Superficies

| Ruta                   | Alcance del mockup                                                              |
| ---------------------- | ------------------------------------------------------------------------------- |
| `/admin/integrations`  | Configuración Polar: estado, ambiente, credenciales, productos y checkout.      |
| `/admin/users`         | Cuentas Portal, acceso, plan, workspace y estado.                               |
| `/admin/plans`         | Catálogo operativo con métricas, filtros, tabla paginada, permisos y CRUD real. |
| `/admin/credits`       | Tabs Paquetes, Movimientos y Uso.                                               |
| `/admin/affiliate`     | Tabs Afiliados, Comisiones y Retiros.                                           |
| `/admin/coupons`       | Descuentos, límites, planes y vigencia.                                         |
| `/admin/payments`      | Historial exclusivo de Polar, detalle, sincronización y reembolsos.             |
| `/admin/subscriptions` | Renovaciones, mora, cancelación al final y revocación inmediata.                |
| `/admin/payment-report` | Reporte agregado del periodo: bruto, neto, reembolsos, ticket medio, evolución, producto, estado y espacios. |
| `/admin/manual-payments` | Cobros fuera de Polar: registro, aprobación, rechazo y configuración de instrucciones. |
| `/portal/plans` | Catálogo activo de Admin, plan vigente, límites y checkout para el propietario. |
| `/portal/billing/success` y `/portal/billing/cancel` | Retornos del checkout; la activación sigue dependiendo del webhook. |

## Fuente visual

`template-shadcn-superdashboard` conserva el catálogo general en `/dashboard/platform`, la
composición unificada de proveedores en `/dashboard/platform/integrations` y la
superficie exacta de Planes en `/dashboard/platform/plans`. Esta última es la
fuente canónica navegable de métricas, filtros, tabla, formulario y
confirmación destructiva; sus estados alternos se revisan con
`?state=loading`, `?state=error` y `?state=forbidden`. Zapi V2 copia esa
composición sobre `/admin/plans` y mantiene el REST/CRUD existente.
Las cuatro métricas de Planes reutilizan el `MetricCard` compartido de
`/admin/users`; la fuente y V2 ya no mantienen JSX paralelo para esas cards.

El catálogo de cliente tiene su composición canónica en
`/dashboard/portal-plans`: resumen del plan vigente, selector mensual/anual,
cards comparables y estados de carga, error y checkout no disponible. Zapi V2
copia esa composición en `/portal/plans` y sustituye únicamente fixtures por
el contrato real de billing.

En `/admin/integrations`, Polar se presenta como una card de resumen igual que
los demás proveedores. Credenciales, productos y opciones de checkout se
editan en un `Sheet` lateral derecho basado en el patrón operativo de
`/portal/teams`. Webhooks, retornos y eventos requeridos se muestran fuera del
sheet como secciones de solo lectura dentro de la misma card de resumen de
Polar, con icono junto a cada título, y no forman parte del formulario. El
sheet usa el mismo ancho ampliado que Meta, WhatsApp Status y SMTP para admitir
etiquetas extensas sin colisiones, encabezado con divisor y la misma card de
disponibilidad compartida por todos los proveedores; no existe un formulario
Polar incrustado en la página ni un diálogo modal de configuración.

Todas las tablas de Usuarios, Créditos, Afiliados, Cupones, Pagos y
Suscripciones usan el patrón canónico de Channels: `DataTableHeader` para
título, búsqueda y acción; `DataTableToolbar`/`DataTableFilter` para filtros
sin anchos fijos; y el único `TablePagination` compacto. El cambio de tab,
búsqueda o estado reinicia la página para evitar rangos vacíos.

La única divergencia visual deliberada al copiar a V2 es el color semántico de estados: Zapi V2 usa las variantes globales `success`, `warning`, `neutral` y `destructive` de `Badge`; el repositorio fuente todavía no expone todas esas variantes.

## Contrato operativo

```text
GET  /v1/admin/operations/:module
POST /v1/admin/operations/:module
POST /v1/admin/operations/:module/:tab/:id/actions

GET  /v1/portal/billing/plans
POST /v1/portal/billing/checkout

GET   /v1/admin/integrations/polar
POST  /v1/admin/integrations/polar/test
PATCH /v1/admin/integrations/polar
POST  /v1/webhooks/polar
```

- Todas las rutas Admin exigen `PlatformAdmin`; el webhook es público pero requiere firma Standard Webhooks válida.
- `POST /test` combina el borrador con los secretos write-only ya guardados,
  valida credenciales y productos contra el ambiente Polar seleccionado y
  persiste únicamente su fingerprint y la fecha de prueba. Un `PATCH` activo
  se rechaza si el borrador no coincide exactamente con esa última prueba.
- Los secretos se guardan cifrados en `provider_integrations` y Web sólo recibe indicadores redactados.
- `billing_webhook_events.external_event_id` hace idempotente cada entrega; un evento fallido con el mismo hash puede reintentarse y un ID reutilizado con otro payload se rechaza.
- `order.paid` crea el pago una sola vez y, según metadata validada, asigna plan o acredita el paquete en el libro existente de créditos.
- `order.refunded` reconcilia el importe, revierte créditos todavía disponibles, devuelve el workspace al plan gratuito cuando corresponde y cancela comisiones aún no pagadas.
- Las suscripciones se sincronizan con estados Polar, cancelación al final, reactivación y revocación inmediata.
- Cupones se conservan localmente y se sincronizan con Discounts de Polar cuando la integración está disponible.
- Retiros de afiliados usan transiciones `requested → approved → paid` o `requested → rejected`; lo pagado permanece descontado del saldo retirable.
- El catálogo Portal expone solo planes activos y no filtra secretos, IDs de
  producto ni permisos internos de Admin. Solo el propietario puede crear un
  checkout; precio, producto, prueba y metadata se reconstruyen en API.
- Una suscripción activa bloquea un segundo checkout para evitar cobros
  duplicados. El cambio entre planes pagos y el downgrade diferido siguen el
  ciclo pendiente documentado en
  [`limites-de-plan-v2.md`](./limites-de-plan-v2.md).

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

La migración `0031_plans_currency_usd_only` reduce `plans_currency_check` a `currency = 'USD'`.

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
- [x] Añadir el reporte agregado de pagos equivalente a `AdminPaymentReport` de Laravel.
- [x] Añadir pagos manuales y su configuración, equivalentes a `AdminManualPayments` y `AdminPaymentManualConfig`.
- [x] Publicar el catálogo de planes en Portal e iniciar upgrades seguros con Polar.

## Evidencia de la fase mock

- `template-shadcn-superdashboard`: `bun run build` correcto; rutas `/dashboard/platform` y `/dashboard/platform/polar` generadas.
- Zapi V2 Web: typecheck y build correctos; rutas Admin de los ocho módulos generadas.
- Lint Web completo sin errores; conserva advertencias previas ajenas a esta superficie.
- `git diff --check` correcto.

## Evidencia de la iteración de tablas

- Planes reemplaza la cuadrícula de cards por la composición operativa canónica y mantiene `plansApi.list/create/update/remove`.
- La paginación local actúa sobre el resultado ya filtrado; no cambia contratos REST ni persistencia.
- `template-shadcn-superdashboard`: check focal del demo y `bun run build` correctos; el check completo conserva errores previos ajenos en Auth/Profile.
- Zapi V2 Web: typecheck y build correctos; lint completo con 0 errores y 50 advertencias previas.
- `git diff --check` correcto en ambos repositorios.

## Evidencia de seguridad de acciones en Planes — 12 de agosto de 2026

- Guardar y eliminar exponen estado pendiente, deshabilitan sus controles y
  usan un bloqueo inmediato para impedir solicitudes duplicadas.
- Eliminar usa `AlertDialog`; si `subscriberCount` es mayor que cero explica
  cuántas asignaciones bloquean la operación y no ofrece una eliminación que
  la API rechazará. Un conflicto por conteo desactualizado también se comunica
  mediante toast.
- Los campos obligatorios muestran asterisco semántico, `aria-required` y
  mantienen deshabilitada la acción principal hasta estar completos.
- Los estados superiores de error y acceso restringido usan la superficie
  estándar `Card variant="subtle"`.

## Evidencia de cierre funcional

- Migraciones `0028` y `0029` probadas con `BEGIN/ROLLBACK` y aplicadas en `zapi_v2_local` y el servicio remoto `zapi_v2`; ambas bases registran 30 migraciones, siete tablas nuevas y los constraints críticos esperados.
- Typecheck de Database, Contracts, API Client, API y Web correcto.
- Prueba transaccional reversible: crear, listar, duplicar y ocultar un paquete de créditos; no dejó fixtures.
- Prueba transaccional reversible: guardar credenciales Polar y comprobar que el ciphertext no contiene el secreto ni la respuesta lo expone.
- Prueba focal: una firma Polar inválida responde como prohibida antes de tocar persistencia.
- Los diez listados Admin ejecutaron consultas reales contra la base local sin errores.

## Evidencia del refactor de Integraciones

- Meta, WhatsApp Status, SMTP y Polar usan `Sheet` lateral derecho para editar
  configuración, con ancho ampliado y secciones verticales; la ruta ya no
  importa ni renderiza diálogos de configuración.
- Los scopes de Meta se muestran como checkboxes persistentes y adaptables;
  los obligatorios se identifican únicamente con un asterisco rojo, sin badge.
- Cada sheet usa `SheetContent` como única región de scroll vertical, sin
  contenedores desplazables anidados, para alcanzar todos los campos y
  acciones en formularios largos. Todos los campos obligatorios muestran el
  asterisco semántico rojo definido por la regla UI.
- Polar conserva el contrato `GET/PATCH /v1/admin/integrations/polar`; el cambio
  añade `POST /test`, mantiene secretos write-only e impide guardar una
  configuración activa sin comprobación vigente.
- La prueba focal de `BillingPolarService` confirma que API rechaza un borrador
  activo cuyo fingerprint no coincide con la última comprobación Polar.
- Typecheck, lint focal y build Web correctos; lint focal sin errores.

## Reporte de pagos — 21 de agosto de 2026

Equivalencia del módulo Laravel `AdminPaymentReport`. Es una superficie de solo
lectura: no crea tablas ni muta pagos, agrega sobre `billing_payments`.

- `GET /v1/admin/payment-report` con `range` (`30d`, `90d`, `12m`) y
  `productType` (`all`, `plan`, `credits`); exige `requirePlatformAdmin`.
- Un pago cuenta como liquidado cuando su estado es `paid`,
  `partially_refunded` o `refunded`; el bruto suma `amount_minor` de ese
  conjunto y el neto le resta `refunded_amount_minor`. Pendientes y fallidos
  aparecen en el desglose por estado pero no suman al bruto, para no inflar la
  facturación con intentos que nunca se cobraron.
- El pago se imputa a `coalesce(paid_at, created_at)`, de modo que la serie
  refleja la fecha real de liquidación y no la de creación del checkout.
- La respuesta agrega una sola moneda —la dominante del periodo— y declara en
  `currencies` las demás presentes. Sumar monedas distintas daría un total sin
  significado; la UI lo indica explícitamente.
- Todos los importes viajan en unidades menores enteras y se formatean en Web.

### Evidencia — 21 de agosto de 2026

- `packages/contracts`, `packages/api-client`, `apps/api` y `apps/web` pasan
  `tsc --noEmit`; `bun run build` correcto en los 6 workspaces y la salida de
  Next incluye `/admin/payment-report`.
- `bun run audit:portal-admin-ui` sin hallazgos.
- No se ejecutó prueba de integración contra PostgreSQL: la superficie es de
  solo lectura y no existe todavía una suite focal para reporting.
- Falta la aprobación visual del usuario.

## Pagos manuales — 22 de agosto de 2026

Equivalencia de `AdminManualPayments` y `AdminPaymentManualConfig`. Cubre el
cobro recibido fuera de Polar: transferencia, depósito o efectivo.

- Aprobar **no es solo cambiar un estado**: dentro de una transacción registra
  el `billing_payments` equivalente (`external_order_id` = `manual-<id>`,
  estado `paid`, `metadata.source = 'manual'`) y concede el plan o los créditos
  con la misma lógica que el webhook de Polar. Así el pago aparece en Pagos y
  en el Reporte, y la facturación conserva una sola fuente de verdad.
- La concesión de créditos usa `idempotencyKey = manual-payment-<id>` y
  `onConflictDoNothing`: aprobar dos veces no duplica saldo.
- El plan concedido se marca con `source: 'admin'`, no `subscription`, para
  distinguir una asignación manual de una suscripción viva de Polar.
- Un pago aprobado no se puede borrar: ya movió saldo o plan y queda como
  historial. Solo se eliminan pendientes y rechazados.
- `reference` es único: impide registrar dos veces el mismo comprobante.
- El pago se atribuye al propietario del espacio de trabajo, no a quien lo
  registra.
- La configuración —aceptar pagos manuales, prefijo de referencia e
  instrucciones— vive en `platform_settings` bajo la clave `manual_payments`;
  no necesitó tabla propia.

Fuera de alcance: que el cliente suba el comprobante desde Portal, adjuntos,
recibo por correo y conciliación bancaria.

### Evidencia — 22 de agosto de 2026

- Migración `0036_mean_red_skull` probada en `BEGIN … ROLLBACK` y aplicada;
  historial 36 → 37 en `zapi_v2_local` y en la remota.
- `packages/database`, `packages/contracts`, `packages/api-client`, `apps/api` y
  `apps/web` pasan `tsc --noEmit`; `bun run build` correcto en los 6 workspaces
  con `/admin/manual-payments` en la salida de Next.
- `bun run audit:portal-admin-ui` sin hallazgos.
- No se ejecutó una aprobación real contra la base: no existe suite focal de
  billing y hacerlo movería saldo de un espacio real.
- Falta la aprobación visual del usuario.

## Catálogo de planes en Portal — 24 de agosto de 2026

- `/portal/plans` consume `GET /v1/portal/billing/plans`, resalta el plan
  vigente y compara precio, periodo, prueba y límites tipados del catálogo que
  mantiene Admin. La navegación y los retornos de Polar ya apuntan a rutas
  reales del Portal.
- `POST /v1/portal/billing/checkout` exige propietario, vuelve a consultar el
  plan activo y construye en API el producto, precio dinámico, prueba,
  cliente y metadata. Una suscripción viva bloquea un segundo checkout.
- Tres pruebas focales cubren precio en unidad menor y metadata, ownership y
  prevención de suscripciones duplicadas. La suite API termina con 65 pruebas
  ejecutadas en verde y 45 integraciones omitidas por no habilitar su base de
  prueba.
- Build del monorepo, typecheck de Contracts, API Client, API y Web, auditorías
  de UI/i18n y `git diff --check` correctos. El lint Web conserva únicamente
  dos advertencias previas en `channels-page.tsx`.
- El preview canónico `/dashboard/portal-plans` pasa Biome y compila en el
  template. Su build global llega a TypeScript y conserva dos errores previos
  ajenos en `chart-area-interactive.tsx` y `store-traffic.tsx`.
- Falta la aprobación visual del usuario.
