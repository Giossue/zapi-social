---
name: review-code-v2
description: Usa este skill para revisar cambios de Zapi V2 por seguridad, regresiones, arquitectura, pruebas y documentación.
---

# Revisar código V2

## Leer antes

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/reglas/calidad.md`
- Plan, contrato y regla afectados.

## Orden de revisión

1. Pérdida/corrupción de datos, secretos, auth, ownership, permisos e idempotencia.
2. Regresión de producto o divergencia Laravel → V2 sin documentar.
3. Límites entre Web, API, Worker, contratos, Drizzle y Redis.
4. Backend creado sin acciones/UI mock y contrato claros.
5. Duplicación de primitives/tokens o estado UI incompleto.
6. Pruebas, OpenAPI, planes y evidencia de validación faltantes.

## Informe

- Reportar solo hallazgos accionables con archivo, evidencia, impacto y severidad.
- Distinguir hechos confirmados, riesgo residual y validación no ejecutada.
- No pedir cambios cosméticos que no reduzcan riesgo o deuda real.
