---
name: planificar-modulo-v2
description: Usa este skill al iniciar o redefinir una vertical de Zapi V2 desde la referencia Laravel hasta el plan de UI mock, contrato y backend.
---

# Planificar módulo V2

## Leer antes

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/README.md`
- Plan existente del dominio, si existe.
- Referencias Laravel: rutas, módulo, vistas/Livewire, modelos/tablas, permisos y acciones visibles.

## Flujo

1. Separar hechos observados de Laravel de mejoras o decisiones V2.
2. Crear o actualizar `docs/planes/<dominio>-v2.md`.
3. Registrar alcance, fuera de alcance, equivalencia Laravel, divergencias confirmadas y pendientes.
4. Definir rutas/superficies V2, usuario, acción principal, fixture/mock y estados relevantes.
5. Expresar el orden: `Laravel auditado → UI mock → REST/Zod → Nest/Drizzle/Worker`.
6. Identificar permisos, ownership, datos, integraciones y trabajo asíncrono antes de proponer endpoints.

## Guardrails

- No tratar una implementación parcial como decisión final.
- No copiar datos, secretos, tokens ni cuentas de Laravel.
- No definir backend antes de que acciones y estados de UI estén claros, salvo orden explícita.
- Marcar como pendiente cualquier hecho sin evidencia.
