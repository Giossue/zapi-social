# Reglas de workflow y datos

## Descubrimiento de código

- No usar MCP graph ni búsqueda semántica para descubrir archivos o código.
- Antes de leer archivos, crear y ejecutar búsquedas inteligentes, acotadas y rápidas con scripts de shell, priorizando `rg --files`, `rg` y filtros por directorio, extensión y término.
- Localizar primero la implementación exacta y leer solo el conjunto mínimo necesario para entender el flujo.
- Buscar literales, rutas, configuraciones, handlers y relaciones con `rg`; usar un script temporal solo si una búsqueda compuesta reduce materialmente el trabajo.

## Entorno local y privilegios

- Se autoriza leer y editar `.env` locales de este workspace sin confirmación adicional.
- Para inspección o cambios locales que requieran privilegios, usar `pkexec` para solicitar autenticación gráfica. No usar `sudo` ni pedir al usuario ejecutar el comando salvo que `pkexec` no esté disponible.
- Los cambios con privilegios se limitan al objetivo verificado: base local, rol local, permisos locales o servicio correspondiente.

## Migraciones Drizzle

- Se autoriza crear y aplicar migraciones y modificaciones de datos estrictamente necesarias en `zapi_v2_local` y en la base remota configurada de Zapi V2. Ambas deben terminar con el mismo schema, constraints e historial Drizzle.
- Esta es una autorización operativa permanente para cambios aditivos o transformaciones estrictamente incluidas en la tarea: no solicitar una confirmación adicional para aplicar la misma migración en remoto.
- Antes de escribir: comprobar conexión, base, rol, historial Drizzle y alcance exacto. Después: verificar schema, constraints y datos afectados.
- Esta autorización no permite borrar datos fuera de un objetivo explícitamente identificado.
- Antes de ejecutar `db:migrate`, comprobar que el `DATABASE_URL` local apunta a una base alcanzable y que el rol existe.
- Si el schema físico contiene una migración que `drizzle.__drizzle_migrations` no registra, nunca borrar ni recrear tablas existentes. Comparar columnas, constraints e índices con el SQL; si coinciden, realizar un baseline explícito y verificable antes de continuar.
- La base local canónica es `zapi_v2_local`; verificar su historial real antes de cada operación y no conservar en esta regla un rango histórico que pueda quedar obsoleto.

## Base de datos remota

- La conexión remota se define en el servicio PostgreSQL `zapi_v2`, en `/home/giossue/.pg_service.conf`; la contraseña se resuelve mediante `/home/giossue/.pgpass`.
- Nunca copiar, imprimir, versionar ni incluir credenciales en comandos, documentación o logs.
- Inspeccionar o verificar la remota con `PGSERVICE=zapi_v2 PGSERVICEFILE=/home/giossue/.pg_service.conf psql`. Confirmar siempre `current_database()`, `current_user` e historial `drizzle.__drizzle_migrations` antes y después de una migración.
- Drizzle requiere `DATABASE_URL`: construirlo en memoria a partir de esos archivos locales, sin mostrarlo, y ejecutar `bun run db:migrate` desde `packages/database`.
- Antes de aplicar SQL nuevo en la remota, probarlo dentro de `BEGIN` / `ROLLBACK` cuando sea compatible con transacción.
