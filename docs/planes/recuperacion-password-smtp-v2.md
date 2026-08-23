# Plan — SMTP Admin y recuperación de contraseña V2

## Objetivo

Permitir que PlatformAdmin configure un proveedor SMTP estándar y que cualquier usuario solicite un enlace seguro de recuperación de contraseña. La configuración sirve Hostinger, Mailpit, Gmail SMTP, Amazon SES SMTP, Mailgun SMTP u otro servidor compatible; no se codifica proveedor específico.

## Referencia Laravel auditada

### SMTP Admin

Módulo: `ZapiSocial/modules/AdminMailServer`.

Campos Laravel: transporte, remitente, host SMTP, puerto, usuario, password, cifrado, timeout y dominio EHLO. El Admin puede enviar email de prueba antes de activar entrega.

### Recuperación

```text
ForgotPasswordPage → Password::broker()->sendResetLink()
ResetPasswordPage  → Password::broker()->reset()
```

Laravel usa email, token temporal, expiración de 60 min y throttle de 60 s. Respuesta pública no revela si email existe.

## Alcance V2

### Admin

Ruta:

```text
/admin/integrations → pestaña Email SMTP
```

API:

```text
GET   /v1/admin/integrations/email-smtp
POST  /v1/admin/integrations/email-smtp/test
PATCH /v1/admin/integrations/email-smtp
```

Configuración cifrada en `provider_integrations` con key `email-smtp`:

```text
host
port
security: starttls | tls | none
username
password (write-only)
fromName
fromEmail
replyTo opcional
timeoutSeconds
```

- `security=tls` usa conexión TLS directa, normalmente puerto 465.
- `security=starttls` requiere TLS tras conexión, normalmente puerto 587.
- `security=none` queda disponible para Mailpit/local; Admin recibe aviso visual.
- Test valida conexión SMTP y puede enviar un correo de prueba al email especificado.
- GET nunca devuelve password; responde solo `passwordConfigured`.
- Guardar requiere prueba correcta del mismo borrador si se habilita envío.
- La pestaña muestra únicamente estado y resumen del servidor; la edición se
  realiza en un `Sheet` lateral derecho ancho, sin modal ni formulario
  incrustado. El sheet usa encabezado con divisor, card independiente de
  disponibilidad y secciones separadas para servidor/remitente, opciones
  adicionales y prueba del borrador.

### Recuperación pública

Rutas Web:

```text
/forgot-password
/reset-password?token=...
```

API:

```text
POST /v1/auth/password-reset/request
POST /v1/auth/password-reset/confirm
```

La composición canónica vive en
`template-shadcn-superdashboard/src/app/(main)/auth/_components/recovery-form.tsx`. Los campos
son controlados, no usan validación nativa del navegador, muestran `*` rojo y
`aria-required`; la acción principal permanece deshabilitada hasta que el
correo o las contraseñas sean válidos. Los fallos se comunican únicamente por
toast.

Reglas:

- Respuesta de solicitud siempre `204`; nunca enumera usuarios.
- Token aleatorio 32 bytes, se guarda solo SHA-256 hash.
- Token un uso, expira 60 min; nuevo token invalida anteriores del usuario.
- Cooldown 60 s por usuario y rate limit por IP/email hash.
- Confirmación valida token, contraseña y confirmación; cambia hash Argon2 en transacción.
- Tras reset, revoca sesiones existentes y registra auditoría sin token/email/password.
- URL usa `WEB_ORIGIN`, no llega desde input cliente.
- React Email renderiza template; Nodemailer entrega SMTP desde Worker email con retry limitado.

## Datos

Migración aditiva:

```text
password_reset_tokens
  id uuid
  user_id FK cascade
  token_hash varchar(64) unique
  requested_at timestamptz
  expires_at timestamptz
  consumed_at timestamptz nullable
  request_ip_hash varchar(64) nullable
```

Índices para token y vencimiento. No guardar token plano, password ni host en logs/auditoría.

## Flujo

```text
Usuario solicita reset
→ API normaliza email, reserva token seguro y encola Email
→ Worker descifra SMTP Admin y renderiza React Email
→ SMTP entrega link con token
→ Usuario abre reset
→ API consume token y cambia Argon2
→ revoca sesiones y devuelve éxito
```

## Estados UI

- Solicitud: normal, inválido, submitted genérico, rate limit y proveedor no configurado sin revelar eso al usuario.
- Reset: token inválido/expirado/consumido, password inválida, éxito y redirección login.
- Admin: sin configurar, editando, password existente write-only, probando, prueba fallida, listo, guardando y correo de prueba enviado/fallido.
- Escritorio, móvil, claro y oscuro.

## Criterio de cierre

- Admin guarda SMTP general cifrado y prueba conexión/correo.
- Usuario recibe enlace de recuperación desde Worker.
- Token no se filtra, no se reutiliza, no enumera cuentas y expira.
- Reset revoca sesiones y audita evento seguro.
- React Email + Nodemailer compilados; Mailpit verifica localmente y proveedor SMTP real se prueba solo con configuración Admin autorizada.
