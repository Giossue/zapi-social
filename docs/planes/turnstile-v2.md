# Cloudflare Turnstile V2

## Alcance

Turnstile protege únicamente `POST /v1/auth/login` y `POST /v1/auth/register`.
La configuración vive en `/admin/settings/captcha`; el secreto se cifra en
`provider_integrations` y el navegador recibe solo la clave pública. No se
añade CAPTCHA a recuperación de contraseña en esta entrega.

## Referencia Laravel

`ZapiSocial/modules/AdminCaptcha` permite elegir proveedor y guarda las claves
de Turnstile. `captcha_verify_token` usa Siteverify antes de Login y Registro
(también otros formularios públicos). V2 conserva solo Turnstile y las dos
acciones solicitadas; evita proveedor alternativo y no expone la clave secreta.

## Contrato y seguridad

| Superficie | Acción |
| --- | --- |
| `GET /v1/auth/turnstile` | Estado efectivo y clave pública para formularios guest. |
| `GET /v1/admin/settings/turnstile` | Estado administrativo, clave pública y presencia de secreto; Admin únicamente. |
| `PATCH /v1/admin/settings/turnstile` | Guarda estado y claves cifradas; Admin únicamente. |
| Login / Registro | Aceptan `turnstileToken` opcional en contrato; API lo exige y verifica cuando Turnstile está activo. |

- El token se entrega una vez a Siteverify desde API, con `remoteip`, timeout
  de 5 segundos y sin loguearlo.
- El widget se renderiza explícitamente desde el callback de carga del script;
  no usa `turnstile.ready()` con el cargador asíncrono de Next.
- Tokens inválidos, vencidos o usados producen `AUTH_CAPTCHA_INVALID`; caída
  de proveedor o configuración inconsistente produce `AUTH_CAPTCHA_UNAVAILABLE`.
- Activar sin clave pública y secreta se rechaza. Deshabilitar conserva las
  credenciales cifradas para poder reactivar sin volver a escribir el secreto.
- La superficie Admin no muestra ni devuelve la clave secreta.

## Fuente visual

Fuente canónica:

- `template-shadcn-superdashboard/src/app/(main)/dashboard/platform/captcha`
- `template-shadcn-superdashboard/src/app/(main)/auth/_components/turnstile-widget.tsx`

V2 copia la composición y adapta datos, permisos, callbacks y REST.

## Estado

- [x] Equivalencia Laravel y documentación oficial Cloudflare auditadas.
- [x] Superficie mock canónica de configuración creada.
- [x] Contratos, REST, cifrado y Siteverify implementados.
- [x] Login y Registro conectados al estado público.
- [x] Validación focal, typecheck, build y auditoría Portal/Admin registrados.

## Evidencia de validación

- `bun test src/captcha/captcha.service.spec.ts`: 3 pruebas pasan (token
  faltante, respuesta inválida y respuesta válida simulada).
- `bun run typecheck --filter=api --filter=web`: correcto.
- `bun run audit:portal-admin-ui`: sin hallazgos.
- `bun run build` en V2 y `npm run build` en `template-shadcn-superdashboard`: correctos.
