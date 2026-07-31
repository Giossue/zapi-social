<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Zapi V2 — reglas obligatorias

Antes de cualquier tarea de diseño, UI, componente, ruta Next, Tailwind, shadcn o bloque 21st, leer:

```text
docs/reglas/design.md
```

Esa guía es fuente canónica para tokens, primitives, integración 21st, diseño-first, rendimiento React/Next y validación.

## Dirección del proyecto

```text
Laravel ZapiSocial = referencia funcional, visual y schema.
ZapiV2 = producto nuevo.
Laravel → diseño Next con mocks → contrato REST → Nest.
```

No modificar Laravel para tareas V2 salvo solicitud explícita. No implementar backend de un módulo antes de que diseño y mocks estén definidos, salvo solicitud explícita.

## Límites

- `packages/ui` es fuente única de tokens y primitives.
- Portal/Admin comparten tokens; no crear temas paralelos.
- Next no accede directamente a PostgreSQL ni Redis.
- No leer, mostrar, versionar ni registrar secretos, `.env`, tokens o credenciales.
- No importar bloques 21st en lote ni sin auditoría conforme a `docs/reglas/design.md`.

## PostgreSQL remoto

- Para consultas de PostgreSQL remoto, usar exclusivamente el perfil local:

  ```bash
  psql "service=zapi_v2"
  ```

- Se permiten consultas de solo lectura (`SELECT`, inspección de schema, conteos y `EXPLAIN`) sin pedir aprobación adicional.
- No ejecutar mutaciones remotas (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `DROP`, `GRANT`, `REVOKE`), migraciones ni cambios de permisos sin aprobación explícita del usuario para esa operación.
- No incluir host, usuario, contraseña, URI de conexión ni otros secretos de base de datos en código, documentación, comandos visibles, logs o commits.
