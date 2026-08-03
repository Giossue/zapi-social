<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Before modifying Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Zapi V2 — guía operativa

## Dirección

```text
Laravel ZapiSocial = referencia funcional, visual y de schema.
ZapiV2 = producto nuevo.
Laravel auditado → UI Next mock → contrato REST → Nest/Drizzle/Worker.
```

No modificar Laravel en una tarea V2 salvo solicitud explícita. No implementar backend de un módulo antes de que diseño, mocks y acciones estén definidos, salvo solicitud explícita.

## Lectura mínima

Antes de afirmar cómo funciona algo o modificarlo, abrir [`docs/README.md`](./docs/README.md) y solo las referencias de la tarea.

| Cambio                                 | Referencias obligatorias                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Cualquier tarea de dominio             | Plan relevante en `docs/planes/` y, si hay equivalencia, la referencia Laravel auditada.              |
| UI, ruta Next, Tailwind, shadcn o 21st | `docs/reglas/design.md`, `packages/ui/COMPONENTS.md`, `docs/reglas/calidad.md` y guía Next instalada. |
| API REST, Nest o contratos             | `ARCHITECTURE.md`, `docs/reglas/calidad.md` y plan de dominio.                                        |
| Schema o migración                     | `ARCHITECTURE.md`, `docs/reglas/calidad.md`, plan de dominio y schema afectado.                       |
| Worker, BullMQ o integración           | `ARCHITECTURE.md`, `docs/reglas/calidad.md` y plan de dominio.                                        |
| Despliegue o variables                 | `docs/conocimiento/deployment/dokploy.md`.                                                            |
| Revisión                               | `docs/reglas/calidad.md`, contrato y plan afectados.                                                  |

## Flujo obligatorio por módulo

1. Auditar Laravel: rutas, módulos/vistas, modelos/tablas, permisos y acciones visibles.
2. Registrar o actualizar la equivalencia mínima en `docs/planes/`.
3. Construir la pantalla/ruta Next con fixtures sintéticas y repositorio mock.
4. Cubrir normal, loading, empty, error, permisos, móvil y claro/oscuro cuando aplique.
5. Antes de crear markup o un componente, consultar `codebase-memory` en `packages/ui` y revisar `packages/ui/COMPONENTS.md`; reutilizar primitives/variantes existentes. `componentes.md` solo lista candidatos 21st. Un componente de dominio vive en `features/<dominio>/components`; solo promover a `packages/ui` un patrón genérico reutilizable por tres o más features. Todo primitive o pattern global añadido, creado o promovido debe actualizar `packages/ui/COMPONENTS.md` en el mismo cambio.
6. Auditar bloques 21st según `docs/reglas/design.md` antes de integrarlos.
7. Definir schemas Zod y contrato REST cuando diseño y acciones estén claros.
8. Implementar Nest, Drizzle, adapters y Worker sustituyendo el mock sin reescribir la UI.
9. Validar según `docs/reglas/calidad.md` y actualizar el estado del plan con evidencia.

## Límites del monorepo

- `apps/web` compone UI y consume REST; nunca accede a PostgreSQL, Redis o secretos.
- `apps/api` aplica REST, DTOs, autorización y ownership; no expone entidades Drizzle.
- `apps/worker` procesa BullMQ, reintentos e idempotencia; no expone HTTP público.
- `packages/ui` es la fuente única de tokens, primitives y patterns compartidos.
- `features/<dominio>` contiene composición, componentes, fixtures, mocks y tipos de dominio.
- `packages/contracts` contiene schemas Zod, DTOs, enums y errores públicos sin infraestructura.
- PostgreSQL es fuente de verdad; Redis solo cache, locks, rate limits y BullMQ.

Para el mapa completo de dependencias consultar [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Documentación y planes

- `AGENTS.md` dirige; no sustituye documentos de dominio.
- `ARCHITECTURE.md` mapea responsabilidades; no replica reglas o planes.
- `docs/conocimiento/` describe estado observado.
- `docs/reglas/` contiene normas obligatorias reutilizables.
- `docs/planes/` conserva equivalencias Laravel → V2, decisiones, estado y pendientes.

Crear o actualizar un plan cuando se inicia una vertical, cambia una equivalencia, se confirma un contrato REST, se modifica una migración con impacto funcional o se toma una decisión de arquitectura/permisos. No crear planes por correcciones locales, cambios mecánicos o refactors sin decisión nueva.

## Documentación obligatoria al cerrar

- Todo cambio funcional, de UX, contrato, permiso, persistencia, integración, arquitectura, regla o estado de entrega actualiza en el mismo cambio su documentación canónica y el plan de dominio afectado.
- Al añadir o cambiar una API, schema, worker, adapter o flujo operativo, actualizar también sus contratos, pruebas/evidencia y documentos relacionados; no dejar decisiones solo en código o conversación.
- Antes de finalizar, revisar `docs/README.md` para ubicar las fuentes afectadas y comprobar que el plan refleja el estado real y la validación ejecutada.
- Para una corrección estrictamente mecánica sin cambio de comportamiento ni decisión, no crear documentación ceremonial; declarar explícitamente en el cierre que no requería actualización documental.

## Datos y seguridad

- Fixtures son sintéticas y deterministas; nunca contienen datos de producción.
- Nunca leer, mostrar, versionar ni registrar `.env`, secretos, tokens, passwords, credenciales o archivos privados.
- Validar ownership, permisos e idempotencia al implementar backend.
- Trabajamos exclusivamente contra PostgreSQL remoto; no ejecutar ni preparar mutaciones locales.
- Antes de ejecutar una migración remota, pedir confirmación explícita indicando el archivo y si es aditiva, destructiva o transformadora.
- Para PostgreSQL remoto usar exclusivamente `psql "service=zapi_v2"`; las mutaciones, migraciones y permisos requieren aprobación explícita.

## Comunicación

Responder en español, directo y sin inventar comportamiento. Antes de crear una pantalla, explicar qué módulo Laravel se replica y qué queda mock. Al terminar, indicar archivos cambiados, validación ejecutada, pendiente real y siguiente módulo recomendado.

## Codebase Memory MCP — consulta obligatoria

Ante cualquier duda técnica sobre código, estructura, estado implementado, símbolos, rutas, imports, consumidores, llamadas, dependencias, contratos o impacto en ZapiSocial o ZapiV2, ejecutar primero el MCP `codebase-memory`. No responder ni inferir desde memoria sin consultarlo.

Si el MCP falla, el índice no está disponible o la consulta no devuelve evidencia suficiente, inspeccionar manualmente el código, tests, schema y contratos relevantes. Para reglas, decisiones, equivalencias Laravel → V2, estado de aceptación y pendientes, consultar además `docs/`; el grafo no sustituye esa documentación.

Los resultados de CBM son evidencia de exploración, no prueba absoluta de completitud: antes de cambios destructivos, verificar archivos y pruebas afectadas.


## Regla visual obligatoria — `diseño ideal` source-first

Cuando exista una superficie equivalente en `../diseño ideal`, ese repositorio es la fuente de implementación visual, no inspiración.

```text
diseño ideal
  → JSX, jerarquía DOM, primitives, clases Tailwind, spacing, responsive y estados visuales

ZapiV2
  → textos, datos, fixtures/API, rutas, handlers, sesión, permisos y efectos de dominio
```

- No rediseñar, compactar, reinterpretar ni crear una variante visual V2 de un componente de dominio existente.
- Antes de integrar, localizar página/componente fuente exacto en `diseño ideal`; copiarlo dentro de la feature V2 y adaptar solo imports, contenido y comportamiento Zapi.
- El markup visual de dominio anterior se elimina. La lógica real se conserva o extrae a hooks/adapters, sin conservar su composición visual.
- Solo se permite cambiar JSX/clases de la fuente cuando sea imprescindible para enlazar un dato, handler, accesibilidad o estado real de Zapi; documentar cada divergencia.
- No añadir tokens, variantes, aliases o props de compatibilidad para reproducir estética V2 previa. Errores de consumidores se migran, no se ocultan deformando la fuente visual.
- `packages/ui` conserva primitives globales copiados de `diseño ideal`; `features/<dominio>` contiene la composición fuente específica ya conectada al dominio Zapi.
