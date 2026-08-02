---
applyTo: "apps/api/**,apps/worker/**,packages/contracts/**,packages/api-client/**"
---

# Backend Zapi V2

- Un módulo se implementa después de que sus acciones y UI mock estén definidas, salvo petición explícita.
- Definir primero schemas Zod, DTOs REST y errores públicos en `packages/contracts`.
- Nest aplica validación de entrada, autenticación, ownership, permisos e idempotencia en el servidor.
- No devolver entidades Drizzle desde REST ni importar `packages/database` desde Web.
- Actualizar OpenAPI y `@workspace/api-client` junto con cambios de contrato.
- Enviar trabajo lento, reintentos y sincronizaciones a Worker/BullMQ; el estado durable vive en PostgreSQL.
- Nunca devolver secretos ni diagnósticos técnicos de providers al Portal; redactarlos en logs.
