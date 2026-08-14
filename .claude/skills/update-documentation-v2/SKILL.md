---
name: update-documentation-v2
description: Usa este skill cuando cambien comportamiento, contratos, arquitectura, schema, reglas, decisiones o estado de cierre en Zapi V2.
---

# Actualizar documentación V2

## Elegir destino

| Cambio | Destino |
| --- | --- |
| Estado técnico observado | `docs/conocimiento/` |
| Norma obligatoria reutilizable | `docs/reglas/` |
| Equivalencia Laravel, decisión o pendiente de vertical | `docs/planes/` |
| Responsabilidades transversales del monorepo | `ARCHITECTURE.md` |

## Flujo

1. Identificar qué hecho cambió y cuál es su fuente de verdad.
2. Actualizar el documento canónico, no una copia derivada.
3. Enlazar a especificaciones grandes en vez de duplicarlas.
4. Para checkboxes de planes, registrar la evidencia de validación o dejar el pendiente sin marcar.
5. Revisar que no se hayan añadido secretos, datos de producción ni valores de `.env`.

## Guardrails

- No documentar inferencias como hechos.
- No crear documentación ceremonial por cambios mecánicos.
- No duplicar decisiones entre `AGENTS.md`, `ARCHITECTURE.md`, reglas y planes.
