---
name: implement-rest-nest
description: Usa este skill para reemplazar una superficie mock aprobada por REST real con Nest/Fastify, contratos Zod, Drizzle y Worker cuando aplique.
---

# Implementar REST con Nest

## Requisitos previos

- Plan de dominio con UI mock, acciones y estados definidos.
- `ARCHITECTURE.md`, `docs/reglas/calidad.md` y contrato afectado leídos.

## Flujo

1. Definir o actualizar schemas Zod, DTOs, permisos y errores en `packages/contracts`.
2. Diseñar endpoints REST `/v1` con ownership explícito.
3. Implementar validación, auth y autorización en API Nest.
4. Persistir con Drizzle sin exponer entidades de persistencia.
5. Enviar trabajo lento o reintentable a Worker/BullMQ, con estado durable e idempotencia.
6. Actualizar OpenAPI y `@workspace/api-client` junto con el contrato.
7. Sustituir el mock de Web y ejecutar validación focal.

## Guardrails

- No implementar un endpoint por inferencia sin acciones UI o plan.
- No confiar en IDs enviados por cliente sin resolver workspace/ownership.
- No enviar secretos o error técnico de provider a Portal.
