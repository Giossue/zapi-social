---
name: implement-operational-frontend-v2
description: Usa este skill para rutas Portal/Admin, tablas, formularios, diálogos y workflows operativos de Zapi V2.
---

# Frontend operativo V2

## Leer antes

- `AGENTS.md`
- `docs/reglas/design.md`
- `docs/reglas/calidad.md`
- Plan del dominio y referencia Laravel correspondiente.

## Flujo

1. Identificar usuario, decisión/acción principal y datos necesarios antes de diseñar.
2. Construir dentro de `features/<dominio>` con fixture sintética y mock repository.
3. Elegir tabla para escanear/filtrar registros, diálogo para edición breve y página para workflows largos o de riesgo.
4. Reutilizar `@workspace/ui`; adaptar bloques 21st según la regla de diseño.
5. Cubrir normal, loading, empty inicial, empty filtrado, error, permisos y estados de acción.
6. Revisar móvil, claro/oscuro, teclado y texto largo cuando aplique.

## Guardrails

- No repetir títulos, resúmenes ni cards decorativos.
- No exponer IDs, paths, nombres internos de providers ni diagnósticos técnicos.
- No usar toast como único error de formulario.
- No crear primitives locales ni colores, sombras o radios fuera de tokens/variantes compartidas.
