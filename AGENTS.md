# Instrucciones de trabajo

## Repositorios de referencia

- `../ZapiV2`: destino de todo el trabajo. Aquí se implementa y valida V2.
- `../ZapiSocial`: primera versión Laravel. Se consulta únicamente para copiar la lógica útil y mejorarla al implementarla en V2; no se replica su arquitectura.
- `../diseño ideal`: fuente visual canónica. De aquí se copia literalmente el diseño de V2: colores, tabs, cards, búsquedas, filtros, hovers, responsividad, tablas y cualquier otra superficie visual.

Cuando el usuario diga “copia el estilo”, se debe copiar la página o componente de `../diseño ideal` tal cual: DOM/JSX, clases, spacing, primitives, estados visuales y responsive. En V2 solo se sustituyen el contenido, textos, datos, rutas, handlers, permisos y lógica reales. No crear una adaptación, reinterpretación ni una versión inspirada.

## Descubrimiento de código

No usar MCP graph ni búsqueda semántica para descubrir archivos o código.

Antes de leer archivos, crear y ejecutar búsquedas inteligentes, acotadas y rápidas con scripts de shell, priorizando `rg --files`, `rg` y filtros por directorio, extensión y término. El objetivo es localizar primero la implementación exacta y reducir lecturas innecesarias.

Una vez localizado el archivo o conjunto mínimo de archivos, leer solo lo necesario para entender el flujo y realizar el trabajo. Usar `rg` para literales, rutas, configuraciones, componentes, handlers y relaciones entre módulos; recurrir a un script temporal solo cuando una búsqueda compuesta aporte una reducción real de tiempo.

## Entorno local y privilegios

- El agente tiene autorización explícita para leer y editar archivos `.env` locales de este workspace. Son configuración local bajo el control del usuario; no hace falta pedir confirmación adicional para ello.
- Para inspección o cambios locales que requieran privilegios, invocar `pkexec` directamente para solicitar al usuario la autenticación gráfica. No usar `sudo` ni pedirle al usuario que ejecute el comando por cuenta propia salvo que `pkexec` no esté disponible.
- Los cambios con privilegios deben limitarse al objetivo verificado: base de datos local, rol local, permisos locales o servicio local correspondiente.

## Migraciones locales de Drizzle

- El agente está autorizado a crear y aplicar, sin confirmación adicional, las migraciones y modificaciones de datos estrictamente necesarias para la implementación solicitada, tanto en `zapi_v2_local` como en la base remota configurada de Zapi V2. Toda migración aplicable debe ejecutarse en ambas y terminar con el mismo schema, constraints y versión de historial Drizzle; si una no puede aplicarse, no se declara el cambio terminado. Antes de escribir, debe comprobar conexión, base, rol, historial Drizzle y alcance exacto; después, verificar schema, constraints y datos afectados. Esta autorización no permite operaciones destructivas ajenas al cambio ni borrar datos fuera de un objetivo explícitamente identificado.
- Antes de ejecutar `db:migrate`, verificar que el `DATABASE_URL` local apunte a una base alcanzable y que el rol exista.
- Si el schema físico contiene una migración pero `drizzle.__drizzle_migrations` no la registra, nunca borrar ni recrear tablas existentes. Comparar primero columnas, constraints e índices contra el SQL de migración; si coinciden, hacer un baseline explícito y verificable antes de continuar.
- La base local actual es `zapi_v2_local`. Su historial registra `0000`–`0006`, contiene `captions` equivalente a `0009`, y requiere aplicar/baselinar ordenadamente `0007`–`0009` antes de las migraciones Files `0010`–`0012`.

## Base de datos remota

- La conexión remota está definida localmente en el servicio PostgreSQL `zapi_v2`, dentro de `/home/giossue/.pg_service.conf`; la contraseña se resuelve desde `/home/giossue/.pgpass`. Nunca copiar, imprimir, versionar ni incluir credenciales en comandos, documentación o logs.
- Inspeccionar o verificar la remota con `PGSERVICE=zapi_v2 PGSERVICEFILE=/home/giossue/.pg_service.conf psql`. Confirmar siempre `current_database()`, `current_user` e historial `drizzle.__drizzle_migrations` antes y después de una migración.
- Drizzle requiere `DATABASE_URL`: construirlo en memoria a partir de esos archivos locales, sin mostrarlo, y ejecutar `bun run db:migrate` desde `packages/database`. Antes de aplicar, probar el SQL nuevo dentro de `BEGIN` / `ROLLBACK` con el servicio remoto cuando sea compatible con transacción.
