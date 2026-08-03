---
applyTo: "packages/database/**"
---

# Datos y migraciones Zapi V2

- Drizzle es el mecanismo de schema y migraciones de V2.
- Clasificar cada migración como aditiva, destructiva o transformadora antes de crearla.
- Una migración destructiva o con transformación requiere plan explícito de datos, mitigación y validación.
- PostgreSQL es la fuente de verdad; Redis no guarda estado de negocio durable.
- No ejecutar mutaciones ni migraciones sobre PostgreSQL remoto sin aprobación explícita.
- Actualizar contratos y plan de dominio si el schema modifica comportamiento visible.
- Nunca copiar datos, cuentas, tokens o credenciales de Laravel a fixtures, migraciones o documentación.
