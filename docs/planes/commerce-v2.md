# Commerce V2

## Estado

`/portal/commerce` es un dashboard mock. Plans sólo existe hoy como módulo
administrativo; no hay checkout, proveedor de pagos ni ledger de créditos V2.

## Referencia Laravel observada

Laravel separa `AppPayments`, `AppCredits`, `AppAffiliate` y los módulos
administrativos de planes/historial. Polar es un gateway específico, no una
dependencia que V2 deba asumir.

## Decisión V2

El backend debe dividirse en tres verticales: catálogo/suscripción, pagos y
créditos. El dashboard Portal sólo podrá leer datos consolidados después de
que esas fuentes sean durables. No se crean órdenes ni pagos sintéticos.

## Dependencias antes de implementar

1. Definir gateway(s), moneda, impuestos, renovación y webhooks firmados.
2. Definir planes publicables, límites y transición de suscripción.
3. Definir ledger de créditos y relación con AI.
4. Definir retención/auditoría de facturas y reembolsos.

## Fuera de alcance actual

- Cobro real, callbacks y afiliados sin las decisiones anteriores.
- Reutilizar tokens, clientes o registros de pago de Laravel.
