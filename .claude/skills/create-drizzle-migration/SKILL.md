---
name: create-drizzle-migration
description: Usa este skill al cambiar schema, persistencia, migraciones o transformaciones de datos de Zapi V2.
---

# Crear migración Drizzle

## Leer antes

- `AGENTS.md`
- `docs/reglas/workflow.md`
- `ARCHITECTURE.md`
- `docs/reglas/calidad.md`
- Plan de dominio y schema/migraciones afectados.

## Flujo

1. Identificar workflow y contrato afectados.
2. Clasificar el cambio: aditivo, destructivo o transformador.
3. Definir constraints, índices, defaults, ownership y reversibilidad práctica.
4. Crear la migración mediante el flujo Drizzle del proyecto.
5. Actualizar contratos/API y plan de dominio si cambia comportamiento visible.
6. Verificar schema, migración, constraints y conteos relevantes.

## Guardrails

- Cambios destructivos requieren plan explícito de datos y mitigación.
- Las autorizaciones, comprobaciones y límites para bases local/remota viven exclusivamente en `docs/reglas/workflow.md`; aplicarlos sin redefinirlos ni pedir confirmaciones adicionales ya resueltas allí.
- Nunca copiar datos o secretos de Laravel como datos de migración o fixture.
- PostgreSQL es fuente de verdad; Redis no sustituye constraints ni estado durable.
