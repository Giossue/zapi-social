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
3. Elegir tabla para escanear/filtrar registros, `Sheet` lateral para crear, editar o ver filas y página para workflows largos o de riesgo. `AlertDialog` queda para confirmar destrucción; Channels conserva su flujo actual como excepción explícita.
4. Consultar `codebase-memory` en `packages/ui` y revisar `packages/ui/COMPONENTS.md` antes de crear markup; reutilizar `@workspace/ui`. Crear algo en la feature si es de dominio y promoverlo a UI solo si será compartido por tres o más features; adaptar bloques 21st según la regla de diseño.
5. Cubrir normal, loading, empty inicial, empty filtrado, error, permisos y estados de acción.
6. Revisar móvil, claro/oscuro, teclado y texto largo cuando aplique.

## Guardrails

- No repetir títulos, resúmenes ni cards decorativos.
- No exponer IDs, paths, nombres internos de providers ni diagnósticos técnicos.
- Los errores de formulario se muestran mediante toast; no usar validación visual nativa del navegador.
- No crear primitives locales ni colores, sombras o radios fuera de tokens/variantes compartidas.
