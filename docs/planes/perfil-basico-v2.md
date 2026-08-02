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

| Acción | Estado objetivo |
| --- | --- |
| Ver nombre, correo y fecha de registro | incluido |
| Editar nombre visible | incluido |
| Editar idioma preferido | incluido |
| Editar zona horaria IANA | incluido |
| Cambiar contraseña | incluido |
| Verificar contraseña actual | incluido |
| Validar que el usuario solo modifica su propia cuenta | incluido |
| Estados loading, error, vacío de zona/idioma, permisos, móvil y claro/oscuro | incluido |

## Fuera de alcance

| Tema | Razón | Módulo posterior |
| --- | --- | --- |
| Avatar | `users` no tiene campos de archivo y MinIO no está preparado | Files / avatar de usuario |
| 2FA, QR TOTP y recovery codes | flujo de seguridad, secretos cifrados y login con desafío | Identity security |
| Cambio de correo | falta política Admin y ciclo de re-verificación | Identity / Admin auth rules |
| Cambio de username | falta política Admin y contrato público de handle | Identity / Admin auth rules |
| Billing e invoices | pertenece a Commerce | Billing |

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

## Estado V2 observado

### Disponible

- `users`: `id`, `email`, `username`, `display_name`, `password_hash`, `email_verified_at`, estado y timestamps.
- Registro, login, refresh, logout y sesión Portal activos en `IdentityService`.
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
- Tras cambiar contraseña, comportamiento de otras sesiones se define durante implementación: recomendado revocar sesiones distintas a la sesión actual.

## Autorización y errores

| Caso | Resultado |
| --- | --- |
| Sin sesión Portal válida | `401` con código de sesión expirada |
| Cuenta suspendida | `403` / sesión no disponible |
| Password actual incorrecto | `400` con código seguro, sin revelar más detalle |
| Política nueva inválida | `400` con código de política |
| Timezone/locale inválidos | `400 VALIDATION_FAILED` |
| Intento de enviar email, username, roles o workspace | ignorar/rechazar por schema estricto |

El endpoint nunca recibe ID de usuario. Siempre parte de la sesión autenticada.

## Diseño y mock antes de API

1. Crear `features/profile` con fixture sintético y repositorio mock.
2. Construir `/portal/profile` usando primitives de `packages/ui`.
3. Mostrar resumen de cuenta, formulario de preferencias y formulario de contraseña separados.
4. Cubrir normal, loading, error de API, éxito, locale/timezone sin valor, contraseña incorrecta, móvil y claro/oscuro.
5. Revisar composición visual antes de conectar API.

## Implementación

- [x] Fixture y repositorio mock preservados en `features/profile`.
- [x] Ruta `/portal/profile`, estados loading/error y formularios de preferencias/contraseña.
- [x] Migración Drizzle aditiva `0007_conscious_rictor.sql` para `users.locale` y `users.timezone`.
- [x] Schemas Zod, DTOs y cliente `@workspace/api-client`.
- [x] API con sesión Portal y updates por `session.user.id`.
- [x] Auditoría `profile.updated` y `profile.password_updated`, sin contraseñas ni hashes.
- [x] Validación de typecheck y build para contracts, database, API y Web.
- [x] Migración aplicada y registrada en BD remota: `users.locale` y `users.timezone`.
- [ ] Desplegar API/Web y probar flujo real autenticado.
- [ ] Añadir tests de servicio/API cuando se habilite suite de tests del módulo.

## Criterio de cierre

- Usuario Portal puede actualizar su nombre, idioma y zona horaria.
- Usuario Portal puede cambiar contraseña tras validar la actual.
- API no permite editar otra cuenta ni campos fuera de alcance.
- La UI muestra resultados reales, loading/error y funciona en móvil/claro/oscuro.
- Avatar, 2FA, correo y username quedan documentados fuera de este vertical; no son pendientes ocultos.
