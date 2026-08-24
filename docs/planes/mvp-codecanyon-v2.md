# MVP CodeCanyon V2

## Estado

**Hoja de ruta definida el 23 de agosto de 2026.** Este plan no implementa
nada: ordena lo que falta para que V2 se venda en CodeCanyon como producto
igual o mejor que ZapiSocial, y enlaza el plan propio de cada bloque. Cada
bloque se marca aquí solo cuando su plan declara la vertical cerrada con
evidencia.

## Qué ya está al nivel (o por encima) de ZapiSocial

Publishing con calendario, siete conectores de canales con OAuth real y
refresco de tokens ([`canales-publicacion-v2.md`](./canales-publicacion-v2.md)),
tableros ([`tableros-v2.md`](./tableros-v2.md)), AI Studio, captions,
watermarks, bulk posts, RSS, link-bio, Files con Google Drive, equipos,
soporte, blogs, plantillas de correo editables
([`plantillas-correo-v2.md`](./plantillas-correo-v2.md)) e idiomas gestionados
desde Admin sin tocar código
([`idiomas-admin-v2.md`](./idiomas-admin-v2.md)) — mejor que ZapiSocial, que
escribe archivos en disco y los pierde en un contenedor.

Los seis módulos operativos de Admin —usuarios, créditos, afiliados, cupones,
pagos y suscripciones— ya operan sobre datos reales con acciones reales
(`AdminOperationsService`); no son maquetas, aunque su motor visual sí tenga
la deuda anotada en [`deuda-tecnica.md`](./deuda-tecnica.md).

## Los bloques del MVP, por orden

| #   | Bloque                    | Plan                                                           | Por qué este orden                                                                                                                                                                                             |
| --- | ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Admin operativo completo  | [`admin-operativo-v2.md`](./admin-operativo-v2.md)             | Cerrar las tres superficies que siguen en maqueta (user-report, user-roles, teams) y las acciones que a los seis módulos reales les falten frente a ZapiSocial. Sin panel completo no hay producto que operar. |
| 2   | Pasarelas de pago         | [`pasarelas-pago-v2.md`](./pasarelas-pago-v2.md)               | Polar solo no vende fuera de Occidente. Stripe y PayPal primero; Razorpay/Paystack después, que es donde más se compra este tipo de script.                                                                    |
| 3   | Límites de plan           | [`limites-de-plan-v2.md`](./limites-de-plan-v2.md)             | Los planes hoy no limitan nada: son cosméticos. Este bloque convierte el billing en producto real.                                                                                                             |
| 4   | Instalación del comprador | [`instalacion-comprador-v2.md`](./instalacion-comprador-v2.md) | Define el paquete que se sube a CodeCanyon: compose, seed, guía. Va al final porque empaqueta lo anterior.                                                                                                     |

## Cierre fino (no bloquea la publicación)

- Foto en TikTok y vídeo en LinkedIn — anotados en
  [`canales-publicacion-v2.md`](./canales-publicacion-v2.md); necesitan apps
  reales para validar.
- Traducción automática con proveedor configurable y RTL — fases 3 y 4 de
  [`idiomas-admin-v2.md`](./idiomas-admin-v2.md).
- Correos en idiomas dinámicos (hoy caen a español).
- Papelera de Files y demás huecos de schema — inventariados en
  [`deuda-tecnica.md`](./deuda-tecnica.md).

## Criterio de "publicable"

1. Un administrador opera usuarios, pagos, suscripciones, créditos, cupones,
   afiliados, roles y equipos sin tocar la base de datos.
2. Un comprador cobra con al menos Stripe, PayPal o Polar configurados desde
   Admin con su propia cuenta.
3. Un plan gratuito y uno de pago se comportan distinto de verdad (límites y
   módulos).
4. Un comprador instala el producto con la guía y un `docker compose up`, y
   crea su primer administrador sin ayuda.
5. Las validaciones de [`calidad.md`](../reglas/calidad.md) en verde y la demo
   con datos de ejemplo funcionando.
