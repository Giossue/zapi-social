# Canales de publicación V2

## Estado

**Investigación cerrada el 23 de agosto de 2026.** V2 declara seis capabilities
en `packages/contracts/src/channels-v2.ts` pero solo tiene conectores reales de
**Meta** y **WhatsApp Status**. ZapiSocial publica en siete redes.

Este documento recoge cómo están construidos esos siete conectores y qué falta
en V2. La arquitectura de canales de V2 vive en
[`channels-v2.md`](./channels-v2.md); esto no la reemplaza, la completa con la
lectura del código Laravel.

## Cómo lo hace ZapiSocial

### Un módulo por red, registrado con una sola llamada

```php
register_channel_module('facebook_page', [
    'provider'   => [ /* la integración compartida */ ],
    'capability' => [ /* lo que se puede conectar */ ],
]);
```

La distinción **provider ↔ capability** es la misma que ya usa V2, y es
correcta: `facebook_page` e `instagram_profile` comparten el provider
`facebook` —una sola app de Meta, un solo App ID— pero son dos capabilities
distintas.

El bloque `provider` declara **el formulario de Admin como datos**:

```php
'required_fields' => ['app_id', 'app_secret'],
'account_types'   => ['oauth', 'manual'],
'fields' => [
    ['key' => 'status',       'type' => 'toggle',   'default' => '0'],
    ['key' => 'app_id',       'type' => 'text',     'default' => ''],
    ['key' => 'app_secret',   'type' => 'secret',   'default' => ''],
    ['key' => 'graph_version','type' => 'text',     'default' => 'v25.0'],
    ['key' => 'permissions',  'type' => 'textarea', 'default' => 'pages_read_engagement,…'],
    ['key' => 'callback_url', 'type' => 'text',     'readonly' => true],
],
```

El bloque `capability` declara el driver de conexión, si soporta publicación,
sus categorías y su rótulo.

### Los dos contratos

```php
interface ChannelDriver {
    public static function key(): string;
    public static function authorizeUrl(User $user, array $context = []): ?string;
}

interface PostPublisher {
    public function publish(PublishingPost $post, SocialAccount $account): array;
}

interface PostDeletionCapable {          // opcional
    public function delete(PublishingPost $post, SocialAccount $account): array;
}
```

### Seis registros por red en Publishing

Cada módulo se engancha a `AppPublishing` con seis registros, y aquí está la
parte que V2 no tiene todavía:

| Registro                             | Qué aporta                                                        |
| ------------------------------------ | ----------------------------------------------------------------- |
| `PublishingChannelRegistry`          | El publicador                                                     |
| `PublishingNetworkConfigRegistry`    | Los destinos: Feed, Reels, Stories…                               |
| `PublishingOptionsRegistry`          | La vista de opciones propias de la red                            |
| `PublishingPreviewRegistry`          | La vista de vista previa                                          |
| `PublishingNetworkOptionsRegistry`   | Normalización de las opciones antes de guardar                    |
| `PublishingMediaValidationRegistry`  | **Las reglas de media, por destino**                              |

Ese último es el que más valor tiene y el más fácil de pasar por alto. Ejemplo
literal de Facebook:

- **Reels**: exactamente un vídeo, sin imágenes.
- **Stories**: exactamente un elemento, imagen o vídeo.
- **Feed**: no se pueden mezclar imágenes y vídeos, y solo un vídeo por
  publicación.

Son reglas de la API de Meta, no decisiones de producto. Si V2 no las replica,
el usuario compone una publicación que la red rechaza y el fallo aparece tarde,
en el worker, con un error del proveedor difícil de leer.

### Las siete redes

| Capability                     | Provider   | Tipos de cuenta   | Credenciales                    |
| ------------------------------ | ---------- | ----------------- | ------------------------------- |
| `facebook_page`                | `facebook` | `oauth`, `manual` | app id, app secret              |
| `instagram_profile`            | `facebook` | `oauth`, `manual` | app id, app secret              |
| `instagram_unofficial_profile` | propio     | `manual`          | ninguna                         |
| `linkedin_page`                | `linkedin` | `oauth`           | app id, app secret              |
| `linkedin_profile`             | `linkedin` | `oauth`           | app id, app secret              |
| `tiktok_profile`               | `tiktok`   | `oauth`           | client key, client secret       |
| `x_profile`                    | `x`        | `oauth`           | client id, client secret        |

Endpoints que usa cada una, leídos del código:

- **Facebook / Instagram**: Graph API, `graph.facebook.com`, versión
  configurable (`v25.0` por defecto).
- **LinkedIn**: `api.linkedin.com/v2/ugc*`, `/v2/assets` para subir media y
  `/v2/userinfo` para el perfil.
- **TikTok**: `open.tiktokapis.com` con autorización en
  `www.tiktok.com/v2/auth/authorize/`.
- **X**: `api.x.com/2/tweets`, subida de media en tres pasos por
  `api.x.com/2/media/upload/initialize`, OAuth2 en `api.x.com/2/oauth2/token`.
- **Instagram no oficial**: `i.instagram.com/api/v1`, la API privada.

## Lo que hay que decidir antes de implementar

**Instagram no oficial usa la API privada de Instagram.** No requiere
credenciales porque no pasa por la API pública: inicia sesión con usuario y
contraseña del cliente. Funciona, y por eso está en ZapiSocial, pero conviene
saber lo que implica antes de venderlo: va contra los términos de uso de Meta,
las cuentas pueden ser bloqueadas, y la aplicación guarda contraseñas de
terceros. **Recomiendo dejarlo fuera de V2**, o marcarlo explícitamente como no
soportado. La decisión es tuya, pero no debería tomarse sin saber esto.

## Equivalencia en V2

### Lo que ya está y lo que falta

Ya existe: el modelo `provider ↔ capability`, `social_accounts` con sus
credenciales cifradas, `channel_oauth_states`, `channel_connection_sessions`,
`publishing_posts` con reintentos, y el worker que entrega.

Falta lo que hace que añadir una red sea barato:

1. ~~Un registro de providers en la API~~ **hecho el 23 de agosto de 2026.**
   `channelProviderCatalog` declara los campos de cada red y
   `channelProviderValuesSchema()` deriva de ahí su validación;
   `ChannelProviderIntegrationsService` sirve la pantalla genérica en
   `/v1/admin/integrations/channel-providers`. Meta y WhatsApp conservan su
   pantalla propia —lo declaran con `hasCustomScreen`— porque guardan su
   configuración bajo otra clave y con su propio contrato: Meta se almacena como
   `facebook`, no como `meta`.

   La tarjeta genérica vive en
   `apps/web/features/integrations/components/channel-provider-integration-card.tsx`
   y se pinta desde la definición: campos, tipos y capabilities. Añadir una red
   no la toca.

   Un proveedor **no llega a `ready` sin verificador**. Dar por buenas unas
   credenciales sin comprobarlas abriría el canal en el Portal y el fallo
   aparecería al publicar, que es el peor momento. Por eso añadir una red es:
   entrada en el catálogo, verificador, flujo OAuth y publicador.
2. ~~El contrato del publicador~~ **hecho.** `ChannelPublisher` y
   `ChannelPublisherRegistry` en el worker, con Meta y WhatsApp migrados encima.
3. ~~Las reglas de media por destino~~ **declaradas** en
   `channelCapabilityCatalog`, con `validateChannelMedia()` en contratos para
   que la interfaz avise antes de guardar y la API lo compruebe antes de
   encolar. Falta engancharlas al formulario de Publishing.
### LinkedIn, estado al 23 de agosto de 2026

- [x] Proveedor y capabilities en el catálogo, con `apiVersion` configurable.
- [x] Pantalla de Admin, servida por la genérica.
- [x] **Verificador**: pide un token con `client_credentials` contra
      `linkedin.com/oauth/v2/accessToken`. No necesita que nadie autorice nada,
      así que se prueba entero sin cuenta. Distingue credencial inválida —400 y
      401— de proveedor caído, que no debe culpar a las credenciales.
- [x] **Publicador** sobre `POST /rest/posts`, con `Linkedin-Version` y
      `X-Restli-Protocol-Version`, y la media por `/rest/images?action=initializeUpload`.
      El identificador de la publicación vuelve en la cabecera `x-restli-id`.
      **No se copió el de ZapiSocial**, que usa la `ugcPosts` retirada.
- [ ] **Vídeo**: falta la API de Videos, con su subida por partes. Hoy una
      publicación con vídeo falla con `PUBLISHING_LINKEDIN_VIDEO_UNSUPPORTED`
      en vez de intentarlo y fallar en el proveedor.
- [ ] **Conexión de cuenta.** El canje de código vive en
      `channel-connections.service.ts` y está escrito para Meta de principio a
      fin: `exchangeCode` apunta al Graph, `fetchCandidates` lista páginas de
      Facebook. LinkedIn necesita su propio camino —`/v2/userinfo` para un
      perfil, `/rest/organizationAcls?q=roleAssignee` para las páginas donde la
      persona es administradora—. **Hasta que exista, no hay cuentas que
      publicar.**
- [ ] **Refresco de token.** Los de LinkedIn caducan; los de Meta son de larga
      duración y por eso no hizo falta hasta ahora.

4. **Los verificadores y el flujo OAuth de cada red.** Sin verificador, su
   integración se queda en «sin probar» y el Portal no abre el canal, que es el
   comportamiento correcto pero no sirve todavía para conectar.
5. **Refresco de token.** X, TikTok y LinkedIn caducan sus tokens; Meta usa
   tokens de larga duración. V2 ya tiene `channel_sync_runs` y schedulers en el
   worker, así que es el sitio natural.

### Orden sugerido

1. **El registro y el contrato del publicador**, con Meta migrado encima. Sin
   esto, cada red nueva vuelve a ser trabajo a medida.
2. **LinkedIn** (páginas y perfiles) sobre la Posts API vigente, no sobre la
   `ugcPosts` que copia ZapiSocial. Sin revisión de app para lo básico.
3. **X**. Contrato de publicación sencillo, pero la subida de media son tres
   llamadas y su nivel gratuito es muy limitado: conviene documentarlo al
   comprador.
4. **TikTok**. Requiere revisión de app para publicar y su flujo de vídeo es
   asíncrono.
5. **Instagram no oficial**, solo si decides asumir lo dicho arriba.

## Contraste con la documentación vigente (agosto de 2026)

ZapiSocial es una base fiable, pero no toda está al día. Se contrastó cada red
con su documentación oficial actual:

### LinkedIn — **la parte obsoleta**

ZapiSocial publica con `/v2/ugcPosts` y sube media con `/v2/assets` y
`registerUpload`. Las dos son la API antigua: **LinkedIn sustituyó `ugcPosts`
por la Posts API** y la retiró para integraciones nuevas en junio de 2023. Lo
vigente es:

```http
POST https://api.linkedin.com/rest/posts
Authorization: Bearer {token}
X-Restli-Protocol-Version: 2.0.0
Linkedin-Version: {YYYYMM}
Content-Type: application/json
```

Puntos que cambian respecto al código Laravel:

- **La versión va en cabecera, no en la URL.** `Linkedin-Version` en formato
  `YYYYMM` es obligatoria, no hay versión por defecto, y una versión retirada es
  un error. Cada versión se mantiene un año como mínimo: `202507` se retiró el
  15 de julio de 2026 y `202607` aguanta hasta el 15 de julio de 2027. **V2
  tiene que guardar esa versión como campo configurable del proveedor**, igual
  que hoy guarda `graphVersion` para Meta, o el conector caduca solo.
- **La media se sube con las APIs de Images y Videos**, que devuelven un
  `urn:li:image:{id}` o `urn:li:video:{id}` que se referencia en
  `content.media.id`. Ya no se usa `registerUpload` sobre `/v2/assets`.
- **Permisos**: `w_member_social` para publicar como persona y
  `w_organization_social` para publicar como página. Este último exige que la
  persona autenticada tenga rol `ADMINISTRATOR`, `DIRECT_SPONSORED_CONTENT_POSTER`
  o `CONTENT_ADMIN` en esa página.
- El identificador de la publicación **vuelve en la cabecera `x-restli-id`**,
  no en el cuerpo.
- Errores tipados útiles para el reintento: `429 TOO_MANY_REQUESTS`,
  `409 CONFLICT` —que la propia documentación pide reintentar— y
  `503 SERVICE_UNAVAILABLE`. Encajan con el criterio que ya usa el worker.

### X — al día

ZapiSocial ya usa `api.x.com/2/media/upload/initialize` y `api.x.com/2/tweets`,
que es la API vigente: X publicó los endpoints de media en la v2 en enero de
2025 y pide migrar desde `upload.twitter.com/1.1`. La subida sigue siendo en
tres pasos —`INIT`, `APPEND` en segmentos de menos de 5 MB, `FINALIZE`— y hay
que sondear el procesado de vídeos y GIF antes de adjuntar el `media_id`.

- Scopes: `tweet.write`, más `tweet.read` y `users.read`.
- **Citar una publicación exige plan Enterprise**; no está en los niveles de
  pago por uso. Si V2 lo ofrece, hay que marcarlo.

### TikTok — al día, con un requisito que hay que documentar

El flujo que usa ZapiSocial coincide con el vigente:

1. Consultar la información del creador para saber qué privacidad admite.
2. `POST /v2/post/publish/video/init/` con `PULL_FROM_URL` o `FILE_UPLOAD`.
3. Si es `FILE_UPLOAD`, `PUT` al `upload_url` devuelto —**caduca en una hora**—.
4. Sondear `/v2/post/publish/status/fetch/` hasta `PUBLISH_COMPLETE`.

Para fotos el endpoint es `/v2/post/publish/content/init/`. Scope:
`video.publish`. Límite: **6 peticiones por minuto y token**.

Y el punto que más soporte va a generar: **todo lo que publique un cliente sin
auditar queda en modo privado**. Para que se vea en público, la app del
comprador tiene que pasar la auditoría de TikTok. No es algo que el código
pueda resolver; va en la guía de instalación, bien visible.

## Lo que no se puede verificar sin cuentas reales

Conviene decirlo claro, porque tú mismo no puedes probarlo:

- La **forma** de cada petición se puede copiar del código Laravel y contrastar
  con la documentación oficial, que es lo que se hizo arriba. Eso es fiable —y
  ese contraste ya encontró que LinkedIn está desactualizado en ZapiSocial.
- El **comportamiento** —límites de tasa, revisión de app, permisos que Meta o
  TikTok conceden a una app nueva— **no**. Cada red exige su propia app
  aprobada, y ese trámite es del comprador, no del código.

Por eso, para cada red, el entregable incluye una guía de «cómo crear tu app»
en la documentación del comprador. Es lo que separa un script que se instala de
uno que genera tickets.
