# Plan — Perfil básico V2

## Objetivo

Cerrar el primer vertical de perfil del Portal sin dependencias externas: consultar y editar nombre, idioma y zona horaria; cambiar contraseña con verificación de la contraseña actual.

## Alcance de este vertical

```text
Ruta Portal: /portal/profile
GET   /v1/portal/profile
PATCH /v1/portal/profile
POST  /v1/portal/profile/password
```

La misma cuenta personal se administra desde Admin mediante una frontera de
sesión independiente:

```text
Ruta Admin: /admin/profile
GET   /v1/admin/profile
PATCH /v1/admin/profile
POST  /v1/admin/profile/password
```

Admin reutiliza el contrato y la composición visual del perfil, pero cada
handler exige `requirePlatformAdmin`; una sesión Admin no puede usar la ruta
Portal ni una sesión Portal la ruta Admin. Los eventos de auditoría del perfil
Admin no se atribuyen a un workspace.

| Acción                                                                       | Estado objetivo |
| ---------------------------------------------------------------------------- | --------------- |
| Ver nombre, correo y fecha de registro                                       | incluido        |
| Editar nombre visible                                                        | incluido        |
| Editar idioma preferido                                                      | incluido        |
| Editar zona horaria IANA                                                     | incluido        |
| Cambiar contraseña                                                           | incluido        |
| Verificar contraseña actual                                                  | incluido        |
| Validar que el usuario solo modifica su propia cuenta                        | incluido        |
| Estados loading, error, vacío de zona/idioma, permisos, móvil y claro/oscuro | incluido        |

## Fuera de alcance

| Tema                          | Razón                                                        | Módulo posterior            |
| ----------------------------- | ------------------------------------------------------------ | --------------------------- |
| 2FA, QR TOTP y recovery codes | flujo de seguridad, secretos cifrados y login con desafío    | Identity security           |
| Cambio de correo              | falta política Admin y ciclo de re-verificación              | Identity / Admin auth rules |
| Cambio de username            | falta política Admin y contrato público de handle            | Identity / Admin auth rules |
| Billing e invoices            | pertenece a Commerce                                         | Billing                     |

El correo y el username se muestran como solo lectura. No se simula que puedan editarse.

## Referencia Laravel auditada

Módulo: `ZapiSocial/modules/AppProfile`.

Rutas legacy:

```text
GET /portal/profile
PUT /portal/profile
PUT /portal/profile/password
```

Referencia principal:

```text
AppProfile/Http/Controllers/AppProfileController.php
AppProfile/Resources/views/index.blade.php
AppProfile/Routes/web.php
```

Laravel permite nombre, username, email, locale, timezone y avatar; username/email dependen de políticas Admin. Para este vertical V2 solo se replica comportamiento no condicionado por esas políticas: nombre, locale, timezone y password.

Laravel exige autenticación y correo verificado para abrir Perfil. V2 conserva sesión Portal activa; la política de verificación de correo se debe decidir en Identity antes de bloquear la ruta.

Laravel permite que una cuenta administrativa abra el perfil compartido porque
su sesión mezcla Admin y Portal. V2 conserva las mismas acciones personales,
pero las publica en `/admin/profile` para respetar la separación de áreas.

## Estado V2 observado

### Disponible

- `users`: `id`, `email`, `username`, `display_name`, `password_hash`, `email_verified_at`, estado y timestamps.
- Registro, login, refresh, logout y sesión Portal activos en `IdentityService`. Login acepta `remember`; sin marcarlo crea cookies de sesión y vence en 24 horas, mientras que marcado persiste hasta 30 días.
- Hash Argon2 para contraseña.
- `AccountMenu` ya presenta `displayName` y correo.
- Primitives compartidas para formulario, select, card, alert, skeleton y toast.

### Faltante

- Ruta `/portal/profile`.
- Feature `features/profile`.
- Contratos Zod y cliente API para perfil/password.
- Endpoints API de perfil.
- Campos `locale` y `timezone` en `users` y migración.
- Auditoría segura de cambio de perfil y contraseña.

## Contrato propuesto

### Lectura

```ts
type PortalProfile = {
  id: string
  displayName: string
  email: string
  username: string | null
  emailVerifiedAt: string | null
  locale: string | null
  timezone: string | null
  createdAt: string
}
```

### Actualización

```ts
type UpdatePortalProfileInput = {
  displayName: string // trim, 2–160 caracteres
  locale: "es" | "en" | null
  timezone: string | null // zona IANA permitida
}
```

### Cambio de contraseña

```ts
type ChangePortalPasswordInput = {
  currentPassword: string
  newPassword: string
  passwordConfirmation: string
}
```

- `currentPassword` se valida con Argon2 antes de escribir.
- `newPassword` reutiliza política vigente de registro.
- No se devuelve hash, input de password, token ni contenido de auditoría sensible.
- Tras cambiar contraseña se revocan todas las sesiones activas, incluida la sesión actual; el usuario debe iniciar sesión de nuevo.

## Autorización y errores

| Caso                                                 | Resultado                                        |
| ---------------------------------------------------- | ------------------------------------------------ |
| Sin sesión Portal válida                             | `401` con código de sesión expirada              |
| Cuenta suspendida                                    | `403` / sesión no disponible                     |
| Password actual incorrecto                           | `400` con código seguro, sin revelar más detalle |
| Política nueva inválida                              | `400` con código de política                     |
| Timezone/locale inválidos                            | `400 VALIDATION_FAILED`                          |
| Intento de enviar email, username, roles o workspace | ignorar/rechazar por schema estricto             |

El endpoint nunca recibe ID de usuario. Siempre parte de la sesión autenticada.

## Diseño y mock antes de API

1. Crear `features/profile` con fixture sintético y repositorio mock.
2. Construir `/portal/profile` usando primitives de `packages/ui`.
3. Mostrar resumen de cuenta, formulario de preferencias y formulario de contraseña separados.
4. Cubrir normal, loading, error de API, éxito, locale/timezone sin valor, contraseña incorrecta, móvil y claro/oscuro.
5. Revisar composición visual antes de conectar API.

## Refactor visual con tabs

- Fuente canónica: `../template-shadcn-superdashboard/src/app/(main)/dashboard/profile/`.
- La ruta usa las tabs **Perfil** y **Seguridad**, siguiendo el mismo primitive y densidad del resto del sistema.
- **Perfil** concentra identidad, correo, verificación, antigüedad y preferencias en una sola superficie.
- **Seguridad** mantiene el cambio de contraseña como contexto separado.
- Las acciones de cada formulario quedan fuera de la card, alineadas a la derecha, sin una barra `CardFooter`.
- Las acciones principales usan un icono semántico a la izquierda, según la regla global de diseño.
- Los campos obligatorios muestran el asterisco con el token semántico `text-destructive`, igual que autenticación.
- Los formularios desactivan la validación visual nativa: errores por toast y acción deshabilitada hasta completar los campos obligatorios.
- La zona horaria es obligatoria también al editar el perfil. Usuarios heredados sin valor ven la zona detectada por el navegador para guardarla; la opción **Sin zona horaria** no existe.
- Se conserva toda la lógica REST, validación, loading, errores, pending y cierre de sesión existentes. No cambian contratos, API ni persistencia.

### Validación

- [x] Fuente `template-shadcn-superdashboard` formateada, validada y revisada visualmente.
- [x] Web V2 con lint, typecheck y build exitosos.
- [x] Tabs, formularios y estados revisados en desktop/móvil y claro/oscuro.

Evidencia local: Biome valida los dos archivos nuevos de la fuente; Playwright confirma cambio de tab y ausencia de overflow a 1440 px y 390 px en claro/oscuro. ESLint focal, typecheck y build Web pasan. El build global de `template-shadcn-superdashboard` compila la ruta, pero conserva el bloqueo preexistente por `@shadcn/react/questionnaire` durante su typecheck.

## Implementación

- [x] Fixture y repositorio mock preservados en `features/profile`.
- [x] Ruta `/portal/profile`, estados loading/error y formularios de preferencias/contraseña.
- [x] Migración Drizzle aditiva `0007_conscious_rictor.sql` para `users.locale` y `users.timezone`.
- [x] Schemas Zod, DTOs y cliente `@workspace/api-client`.
- [x] API con sesión Portal y updates por `session.user.id`.
- [x] Ruta y API de perfil Admin con `requirePlatformAdmin`, reutilizando el mismo contrato por `session.user.id`.
- [x] Auditoría `profile.updated` y `profile.password_updated`, sin contraseñas ni hashes.
- [x] Validación de typecheck y build para contracts, database, API y Web.
- [x] Migración aplicada y registrada en BD remota: `users.locale` y `users.timezone`.
- [ ] Desplegar API/Web y probar flujo real autenticado; el cambio de contraseña ahora revoca todas las sesiones activas y redirige al login.
- [ ] Añadir cobertura de integración del servicio sobre PostgreSQL para ambos tipos de sesión.

Evidencia de la extensión Admin: build Web incluye `/admin/profile`; typecheck
de Contracts, API Client y API pasa; el test focal del controlador confirma que
lectura, edición y cambio de contraseña ejecutan el guard de plataforma. Build
y lint de API, lint/typecheck/build Web, lint/build de Contracts, lint del API
Client y auditorías de UI e i18n terminan sin hallazgos.

## Criterio de cierre

- Usuario Portal puede actualizar su nombre, idioma y zona horaria.
- Usuario Portal puede cambiar contraseña tras validar la actual.
- API no permite editar otra cuenta ni campos fuera de alcance.
- La UI muestra resultados reales, loading/error y funciona en móvil/claro/oscuro.
- 2FA, correo y username quedan documentados fuera de este vertical; no son
  pendientes ocultos. El avatar se incorporó el 29 de agosto de 2026 (ver la
  sección siguiente).

## Foto de perfil — 29 de agosto de 2026

Equivalencia del avatar Laravel (`avatar_path`/`avatar_disk` en `AdminUser`,
subida en `UserForm::storeAvatar` a `avatars/users/{userId}` con límite de
2 MB). V2 lo implementa siguiendo el molde de branding, no el de Files:

- **Columna** aditiva `users.avatar_path varchar(512)` (migración
  `0050_blue_thor`, aplicada a `zapi_v2_local` y a la remota `zapi_v2`, ambas
  con historial 51). Guarda la clave relativa dentro del volumen.
- **Storage**: el binario vive en
  `$FILES_STORAGE_PATH/avatars/users/<userId>/<version8>.<ext>`, una carpeta
  dedicada por usuario dentro del mismo volumen compartido, fuera del árbol
  `ws/` de Files. Reemplazar o quitar la foto borra **solo el archivo**
  anterior (`rm` del binario); la carpeta del usuario permanece. Al no crear
  filas en `file_assets`, el avatar **no consume la cuota de storage del plan**
  ni aparece en la biblioteca de Files.
- **Límite**: 1 MB (decisión de producto, más estricta que los 2 MB de
  Laravel), formatos JPG/PNG/WebP verificados por magic bytes con
  `detectFileMime`; el layout de claves vive en `packages/file-ingestion`
  (`userAvatarStorageKey`, `MAX_AVATAR_BYTES`). Sin SVG por superficie XSS.
  La UI recomienda imagen cuadrada de 512×512 px.
- **Contrato y endpoints**: `portalProfileSchema.avatarUrl` y
  `authUserSchema.avatarUrl` (la sesión alimenta el avatar del shell).
  `POST|GET|DELETE /v1/portal/profile/avatar` y sus espejos
  `/v1/admin/profile/avatar`; subida como `application/octet-stream` con
  guardia de tamaño en stream, escritura temporal y `rename` atómico. La URL
  servida es autenticada y privada
  (`/v1/<área>/profile/avatar?v=<version>`, `cache-control: private,
  immutable`), coherente con la regla de Files de no exponer URLs públicas.
  Cada subida/borrado audita en `api_audit_logs`
  (`profile.avatar_updated`/`profile.avatar_removed`).
- **UI**: fuente canónica ampliada primero en
  `template-shadcn-superdashboard/.../profile/_components/profile-settings.tsx`
  y copiada a `AccountProfilePage` (Portal y Admin): botón «Cambiar foto» con
  input de archivo oculto, «Quitar foto» cuando existe, texto de ayuda con
  formato/tamaño, validación client-side por toast y `AvatarImage` con
  fallback de iniciales. `AccountProfile` del shell acepta `avatarUrl`, así la
  foto aparece en el sidebar y el menú de cuenta vía sesión.

Evidencia: typecheck en file-ingestion, contracts, database, api-client, api y
web; `bun run test` de API (25 suites, wiring incluido); build de contracts y
web; auditores de UI e i18n sin hallazgos; migración verificada en local y
remota antes y después. La aprobación visual corresponde al usuario.
