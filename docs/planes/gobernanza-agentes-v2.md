# Gobernanza de agentes y contexto V2

## Estado

- [x] Arquitectura transversal documentada en `ARCHITECTURE.md`.
- [x] Definition of Done y validación proporcional documentadas en `docs/reglas/calidad.md`.
- [x] Instrucciones por ámbito y skills V2 añadidas.
- [x] Codebase Memory MCP configurado localmente e índices iniciales de ZapiSocial y ZapiV2 verificados.
- [ ] Aplicar la plantilla de estado/evidencia al siguiente vertical que se inicie o se cierre.
- [ ] Revisar planes históricos antes de marcar checkboxes sin evidencia.

## Objetivo

Mantener un contexto de trabajo breve, versionado y verificable para agentes y personas sin duplicar el código ni cargar toda la documentación en cada tarea.

## Decisión

- `AGENTS.md` dirige el trabajo y los límites globales.
- `ARCHITECTURE.md` mapea responsabilidades y dependencias del monorepo.
- `docs/reglas/` contiene normas obligatorias reutilizables.
- `docs/conocimiento/` describe implementación observada; no reemplaza revisar código.
- `docs/planes/` conserva equivalencias Laravel → V2, decisiones de dominio, estado y pendientes.
- Las skills guían tareas repetibles; no sustituyen el plan del dominio ni la validación real.

No se crea una taxonomía paralela de `docs/architecture`, `docs/quality` o `docs/plans/active`.

## Criterio para crear o actualizar un plan

Actualizar un plan cuando se inicie una vertical, cambie una equivalencia Laravel → V2, se confirme un contrato REST, se introduzca una migración con impacto funcional o se tome una decisión de arquitectura/permiso.

No crear planes por correcciones locales, cambios mecánicos o refactors sin decisión nueva.

## Estado mínimo de un plan de dominio

Todo plan nuevo o ampliado debe indicar, cuando aplique:

| Área | Evidencia esperada |
| --- | --- |
| Referencia Laravel | Rutas, módulos/vistas, modelos/tablas, permisos y acciones auditadas. |
| UI V2 | Ruta, usuario, mock/fixture y estados relevantes. |
| Contrato | Endpoint, schema/DTO, permiso, errores y estado. |
| Datos y async | Persistencia, integraciones, jobs e idempotencia. |
| Cierre | Pruebas/validaciones ejecutadas, pendiente real y divergencias. |

`channels-v2.md` es una referencia de nivel de detalle, no una plantilla que deba duplicarse.
