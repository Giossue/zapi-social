# Pasarelas de pago V2

## Estado

**Investigación cerrada el 23 de agosto de 2026; implementación sin empezar.**
V2 tiene una sola pasarela, Polar.sh, con su vertical Admin operativa
([`billing-polar-v2.md`](./billing-polar-v2.md)). ZapiSocial tiene catorce.

Este documento recoge cómo lo resuelve Laravel —leído del código, no de la
documentación de producto— y qué equivalencia toca en V2.

## Cómo lo hace ZapiSocial

### Un módulo por pasarela, registrado en arranque

Cada pasarela es un módulo Laravel independiente
(`modules/PaymentStripe/`, `modules/PaymentRazorpay/`…) con la misma forma:

```text
module.json                      # nombre, alias, service provider
Providers/…ServiceProvider.php   # registra la pasarela y su pantalla Admin
Services/…PaymentGateway.php     # la implementación
Public/logos/…svg                # el logo que se pinta en el checkout
Resources/views/admin/settings.blade.php
```

El `ServiceProvider` hace exactamente tres cosas en `boot()`:

1. `PaymentManager::register(PaymentGatewayDefinition, GatewayClass)` — una vez
   por variante. Stripe registra dos: `stripe` y `stripe_recurring`.
2. `PaymentGatewaySettingsRegistry::register(key, [...])` — **declara su
   pantalla de Admin entera como datos**: campos, valores por defecto, reglas de
   validación, URLs de webhook, avisos y lista de eventos a suscribir.
3. Cargar sus vistas.

Añadir una pasarela nueva no toca ni el núcleo ni la interfaz. Es el punto
fuerte del diseño y lo que hay que conservar.

### El contrato

```php
interface PaymentGateway
{
    public function start(PaymentCheckout $checkout): PaymentStartResult;
    public function complete(Request $request, PaymentCheckout $checkout): PaymentCallbackResult;
    public function webhook(Request $request): mixed;
}
```

Tres objetos de intercambio, todos inmutables:

| Objeto                  | Lleva                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `PaymentCheckout`       | `gateway`, `gatewayType`, `userId`, `planId`, `amount`, `currency`, `returnUrl`, `cancelUrl`, `meta` |
| `PaymentStartResult`    | `redirectUrl` y `meta` que se guarda para el retorno                                     |
| `PaymentCallbackResult` | `status` (`success`/`pending`/`failed`), `transactionId`, `amount`, `currency`, `message`, `subscriptionId`, `customerId`, `meta` |

`PaymentGatewayDefinition` describe la pasarela sin código: `key`, `title`,
`type` (`one_time` o `recurring`), `capabilities`, `callbacks`, `sort` y un
`enabled` que es un *closure* leyendo las opciones guardadas. Así el checkout
solo ofrece las pasarelas configuradas de verdad.

### El flujo

```text
CheckoutPage → PaymentCheckoutStore (sesión) → gateway->start()
  → redirección al proveedor
  → vuelta a /payment/success/{gateway} → gateway->complete()
  → PaymentLifecycleService::finalize() → PaymentHistory + plan + notificación
```

### Las catorce, con lo que pide cada una

| Módulo             | Claves                        | Credenciales                                            |
| ------------------ | ----------------------------- | ------------------------------------------------------- |
| PaymentStripe      | `stripe`, `stripe_recurring`  | publishable key, secret key, webhook secret             |
| PaymentPaypal      | `paypal`, `paypal_recurring`  | client id, client secret                                |
| PaymentRazorpay    | `razorpay`, `razorpay_recurring` | key id, key secret, webhook secret                   |
| PaymentPaystack    | `paystack`                    | public key, secret key                                  |
| PaymentFlutterwave | `flutterwave`                 | public key, secret key, encryption key                  |
| PaymentPayU        | `payu`                        | merchant key, salt                                      |
| PaymentPaytm       | `paytm`                       | merchant id, merchant key                               |
| PaymentPayTR       | `paytr`                       | merchant id, merchant key, merchant salt                |
| PaymentIyzico      | `iyzico`                      | api key, secret key                                     |
| PaymentInstamojo   | `instamojo`                   | client id, client secret, salt                          |
| PaymentSslCommerz  | `sslcommerz`                  | store id, store password                                |
| PaymentCCAvenue    | `ccavenue`                    | merchant id, access code, working key                   |
| Payment2Checkout   | `2checkout`                   | seller id, secret key                                   |
| PaymentYooMoney    | `yoomoney`                    | shop id, secret key                                     |

Solo tres soportan recurrencia —Stripe, PayPal y Razorpay—, y las tres declaran
`capabilities: ['user_cancel_recurring', 'system_cancel_recurring']` con un
`callback` `cancel_recurring`. Las once restantes son pago único.

## El fallo que **no** hay que copiar

**Ninguna de las catorce cierra el pago en el webhook.** Se comprobó una a una:
`PaymentLifecycleService::finalize()` solo se llama desde
`PaymentController::success`, es decir, desde la redirección del navegador. El
método `webhook()` de cada pasarela se limita a devolver un resumen del evento
que el controlador responde en JSON; no acredita nada.

Consecuencia: si el cliente paga y cierra el navegador antes de volver, **el
pago queda cobrado en la pasarela y sin registrar en la aplicación**. Es un
agujero real, y en pasarelas asíncronas —transferencia, PayTR, SslCommerz— es
el caso normal, no el raro.

V2 ya lo hace bien con Polar: el webhook firmado es la fuente de verdad. La
migración debe mantener ese criterio y tratar la redirección solo como una
mejora de experiencia.

## Equivalencia en V2

### Lo que cambia respecto a Laravel

No hay módulos que se autodescubran ni `ServiceProvider` que corra en arranque.
El equivalente honesto es **un registro en la API alimentado por definiciones
estáticas**, una por pasarela, en `apps/api/src/billing/gateways/`.

```text
apps/api/src/billing/gateways/
  gateway.contract.ts      # la interfaz y los tres objetos de intercambio
  gateway.registry.ts      # registro por clave, con `enabled` resuelto en runtime
  stripe/stripe.gateway.ts
  stripe/stripe.definition.ts
  …
```

La definición es un objeto plano, no una clase: clave, tipo, capacidades,
campos de credencial y su validación Zod. La interfaz **no** conoce las
pasarelas: pide el catálogo a la API y pinta lo que reciba, igual que hace hoy
con las capabilities de canales.

### Contrato propuesto

```ts
export interface PaymentGateway {
  start(checkout: PaymentCheckout): Promise<PaymentStartResult>
  /** Solo mejora la experiencia; no acredita. */
  complete(query: Record<string, string>, checkout: PaymentCheckout): Promise<PaymentCallbackResult>
  /** La fuente de verdad. Verifica la firma y devuelve el efecto. */
  webhook(raw: Buffer, headers: Record<string, string>): Promise<PaymentWebhookResult>
}
```

La diferencia con Laravel está en `webhook`: recibe el **cuerpo crudo**, porque
verificar una firma exige los bytes tal cual llegaron, y devuelve un efecto
tipado —`payment_succeeded`, `payment_failed`, `subscription_cancelled`— que el
servicio de facturación aplica de forma idempotente sobre `billing_payments` y
`billing_subscriptions`.

### Datos

Casi todo está: `billing_payments`, `billing_subscriptions`, `billing_refunds`,
`billing_webhook_events` y `provider_integrations` ya existen. Hacen falta dos
cosas:

- **Generalizar `provider_integrations`** para guardar credenciales de pasarela
  cifradas, no solo de canales. Ya cifra y ya tiene la forma correcta.
- **Una columna de pasarela** en `billing_payments` y `billing_subscriptions`
  si hoy asumen Polar. Hay que comprobarlo antes de tocar nada.

### Orden sugerido

Por cobertura de mercado y por lo bien documentadas que están sus APIs:

1. **Stripe** y **PayPal** — cubren la mayoría de Occidente y ambos tienen
   recurrencia. Además validan que el contrato aguanta las dos formas.
2. **Razorpay** y **Paystack** — India y Nigeria, que es donde más se compra
   este tipo de script.
3. **Flutterwave**, **PayU**, **Iyzico** — África, Latinoamérica y Turquía.
4. El resto, según lo pidan los compradores.

Cada una entra con su prueba de integración de firma de webhook. Es lo único
que se puede verificar sin una cuenta real de la pasarela, y es justo la parte
donde un error cuesta dinero.

## Fuera de alcance

- Reembolsos automáticos desde el panel para pasarelas que no los expongan.
- Migrar pagos históricos de ZapiSocial.
