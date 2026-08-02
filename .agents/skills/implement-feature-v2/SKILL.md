---
name: implement-feature-v2
description: Usa este skill para cambios funcionales no triviales en Zapi V2, desde equivalencia Laravel y mock UI hasta contrato, Nest, Drizzle y Worker.
---

# Implementar feature V2

## Contexto mínimo

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/README.md`
- Plan de dominio
- `docs/reglas/calidad.md`
- `docs/reglas/design.md` cuando toque Web/UI

## Flujo

1. Localizar evidencia Laravel y estado V2 existente.
2. Actualizar el plan si cambian alcance, equivalencia, contrato o estado.
3. Implementar o ajustar primero UI con fixture y repositorio mock.
4. Definir schemas Zod, DTOs REST, permisos, ownership y errores públicos.
5. Implementar API Nest y persistencia Drizzle; enviar trabajo lento a Worker.
6. Sustituir el mock mediante `@workspace/api-client` sin reescribir la composición UI.
7. Validar según `docs/reglas/calidad.md` y registrar evidencia/pending real.

## Guardrails

- Web no accede a base de datos, Redis ni secretos.
- No devolver entidades Drizzle desde API.
- No omitir idempotencia en acciones reintentables, callbacks o jobs.
- No declarar terminado sin evidencia de validación.
