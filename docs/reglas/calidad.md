# Reglas de calidad y cierre

## Principios

- Verificar primero el cambio más cercano; ampliar la validación según riesgo y alcance.
- No declarar terminado un cambio si falla la validación relevante.
- No inventar comandos, suites ni cobertura inexistente: declarar con precisión lo no validado.
- Tests, fixtures y mocks no sustituyen autorización, ownership, idempotencia ni validación real en Nest.
- No añadir dependencias de producción sin justificar su responsabilidad y ubicación en el monorepo.
- Mantener fixtures sintéticas y deterministas; nunca usar datos, tokens o credenciales de producción.

## Comandos raíz disponibles

```bash
bun run format
bun run lint
bun run typecheck
bun run build
```

Los workspaces API y Worker tienen comandos `test`. Antes de ejecutar pruebas de Web u otro paquete, confirmar el script disponible en su `package.json`; no asumir una suite raíz que no existe.

## Matriz de validación

| Tipo de cambio      | Validación mínima                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Ruta o UI Next      | Typecheck y lint/build disponible; estados mock; permisos; móvil; claro/oscuro; aprobación visual del usuario.              |
| Feature con mock    | Fixture determinista; loading, empty, error y permiso; interacción principal; composición dentro de `features/<dominio>`.   |
| Contrato REST       | Schemas Zod, DTOs y errores consistentes; autorización; OpenAPI y cliente sincronizados si existen.                         |
| API Nest            | Typecheck; test focal si existe; validación de entrada; ownership/permisos; no exponer entidades Drizzle.                   |
| Worker              | Idempotencia, reintentos limitados, estado durable en PostgreSQL y logs redactados; test focal si existe.                   |
| Schema o migración  | Migración Drizzle; constraints; reversibilidad práctica o plan explícito; schema/conteos y contratos afectados verificados. |
| Integración externa | Secretos solo server-side; errores normalizados; límite/rate limit, reintento y fallo simulado cuando aplique.              |
| Refactor            | Diff acotado, búsqueda de residuos, typecheck y pruebas relevantes.                                                         |
| Regla o documento   | Enlaces válidos, una fuente de verdad, sin secretos ni duplicación de especificaciones.                                     |

## Documentación de cierre

- Todo cambio funcional debe actualizar durante el mismo cambio el plan de dominio y la fuente documental canónica afectada; no se acepta que código, contratos y documentación describan estados distintos.
- La evidencia de validación se registra en el plan, PR o sección de cierre correspondiente antes de marcar una fase como completada.
- Cambios puramente mecánicos sin efecto funcional pueden no modificar documentación, pero el cierre debe declararlo explícitamente.

## Definition of Done de una vertical

Una vertical se considera cerrada solo cuando coinciden:

1. la equivalencia Laravel → V2 y sus divergencias;
2. la UI con fixtures/mock y sus estados relevantes;
3. acciones y contrato REST/Zod;
4. autorización, ownership, persistencia e idempotencia cuando apliquen;
5. workers e integraciones externas cuando existan;
6. pruebas y validación proporcional ejecutadas;
7. OpenAPI, cliente y plan actualizados cuando el comportamiento cambie.

Un checkbox de un plan se marca únicamente con evidencia de validación en el cambio, prueba, PR o sección de cierre correspondiente.

## Orden de revisión

Revisar en este orden:

1. pérdida o corrupción de datos;
2. secretos, autenticación, ownership, permisos e idempotencia;
3. regresión funcional o divergencia no documentada frente a Laravel;
4. ruptura del flujo UI mock → contrato → backend;
5. límites entre Web, API, Worker, contratos y base de datos;
6. duplicación de primitives, tokens o patrones UI;
7. pruebas, OpenAPI, planes y documentación faltantes.

Para normas de interfaz, tokens, primitives, accesibilidad y revisión visual, consultar [design.md](./design.md).
