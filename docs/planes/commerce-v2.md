# Commerce y afiliados V2

## Estado

El backend operativo de catálogo, inventario, órdenes, devoluciones y afiliados está implementado. `/portal/commerce` todavía usa su repositorio mock; `/portal/affiliate` cae en el placeholder genérico. Deben conectarse a `commerceApi` y `affiliateApi` respectivamente.

Este slice **no es billing ni checkout**. Polar.sh fue elegido como única pasarela, pero su implementación pertenece al plan [`billing-polar-v2.md`](./billing-polar-v2.md). Mientras ese backend no exista, Commerce no crea cobros, suscripciones, facturas, reembolsos ni webhooks de pago sintéticos.

## Alcance Commerce

Base: `/v1/portal/commerce`; todos los endpoints exigen sesión Portal y scope de workspace.

| Método y ruta         | Responsabilidad                                             |
| --------------------- | ----------------------------------------------------------- |
| `GET /`               | Dashboard por período (`month`, `quarter`, `year`) y canal. |
| `GET /products`       | Listar productos e inventario del workspace.                |
| `POST /products`      | Crear producto y nivel de inventario.                       |
| `PATCH /products/:id` | Editar catálogo, estado y cantidades.                       |
| `POST /orders`        | Crear orden e ítems; reservar stock de forma atómica.       |
| `PATCH /orders/:id`   | Transicionar el estado de una orden no terminal.            |
| `POST /returns`       | Registrar una solicitud sobre una orden completada.         |

Sólo `owner` y `admin` mutan catálogo, órdenes y devoluciones. Las lecturas siempre filtran por workspace.

### Reglas de inventario

- Cada producto mantiene `available`, `reserved` y `low_stock_threshold` en una fila independiente.
- Crear una orden incrementa `reserved` únicamente si `available - reserved` alcanza para todos sus ítems; la transacción revierte completa ante falta de stock.
- Completar una orden decrementa `available` y `reserved`; cancelarla sólo libera `reserved`.
- `completed` y `cancelled` son terminales. La fila de orden se bloquea `FOR UPDATE` para impedir aplicar el efecto de inventario dos veces.
- SKU es único por workspace y las referencias externas, cuando existen, también son únicas dentro del workspace.

## Alcance Afiliados

| Método y ruta                           | Responsabilidad                                             |
| --------------------------------------- | ----------------------------------------------------------- |
| `GET /v1/portal/affiliate`              | Dashboard personal, métricas, comisiones y retiros.         |
| `POST /v1/portal/affiliate/activate`    | Crear de forma idempotente el perfil y código del usuario.  |
| `POST /v1/portal/affiliate/withdrawals` | Reservar una solicitud contra saldo disponible.             |
| `POST /v1/public/affiliate/referrals`   | Capturar visita pública por código y devolver `referralId`. |

- Registro acepta opcionalmente `referralId` y vincula el usuario si la referencia sigue en estado `visited` y el perfil está activo.
- Al completar una orden con email asociado a una referencia registrada, se crea una comisión única por orden.
- La comisión queda `pending` por 30 días; el dashboard promueve a `available` las entradas elegibles.
- Una solicitud de retiro bloquea la fila del perfil durante la transacción y descuenta retiros `requested/approved` del saldo retirable para evitar sobregiros concurrentes.
- Revisar/aprobar/pagar retiros es una capacidad administrativa posterior; Portal sólo solicita y consulta.

## Persistencia

- Commerce: `commerce_products`, `commerce_inventory_levels`, `commerce_orders`, `commerce_order_items`, `commerce_return_requests`.
- Afiliados: `affiliate_profiles`, `affiliate_referrals`, `affiliate_referral_visits`, `affiliate_commissions`, `affiliate_withdrawals`.
- `api_audit_logs` registra creación/edición de productos, órdenes, activación de afiliado y solicitudes de retiro.
- Valores monetarios usan enteros en unidad menor más código ISO de tres letras; no se guardan flotantes.

La migración Drizzle del slice es `0020_mushy_peter_parker`; `0021_pale_thor` añade el `CHECK (reserved <= available)`.

## Seguridad y privacidad

- Ownership se deriva de sesión/workspace; un ID de otro espacio responde como recurso no disponible.
- Captura pública no acepta `userId`: registra un identificador de visita y un hash SHA-256 diario de IP + user-agent; no expone esos datos en Portal.
- No se almacenan credenciales de pago porque el gateway todavía no existe.
- Auditoría conserva importes, moneda y transiciones, pero no datos financieros sensibles.

## Evidencia y pendientes

- [x] Contratos Zod, API Nest, cliente REST y schema Drizzle.
- [x] `0020_mushy_peter_parker` y `0021_pale_thor` aplicadas en `zapi_v2_local`; existen órdenes, inventario, perfiles, referencias, comisiones y retiros.
- [x] Las métricas usan agregados completos, devoluciones se serializan por orden y una orden manual completada no genera comisiones: sólo un pago verificado podrá hacerlo en el futuro.
- [x] Typecheck de Database, Contracts, API Client y API.
- [x] Prueba local transaccional: reserva tres unidades, completa una sola vez y termina con `available=7`, `reserved=0` (`portal-backend-v2`, 3/3 en el conjunto).
- [ ] Conectar Commerce a REST y sustituir el placeholder Affiliate por una página operativa.
- [x] Aprobar Polar.sh como gateway único y separar su alcance en `billing-polar-v2.md`.
- [ ] Implementar impuestos, moneda, renovaciones y política idempotente de webhooks dentro de Billing.
- [x] Crear flujo Admin para revisar comisiones y retiros; devoluciones de Commerce continúan como pendiente de su propia UI Admin.
