# Índice de trabajo para agentes

Lee este archivo primero. Es un **índice**, no una copia de las reglas: cada norma vive en un único documento canónico y se actualiza allí.

`AGENTS.md` es un enlace simbólico a este mismo archivo: existe una sola copia del índice.

## Carga obligatoria y precedencia

- Antes de buscar, planificar, editar, ejecutar comandos o responder sobre el repositorio, clasificar la tarea con la tabla de este índice y leer **completamente** todos los documentos indicados en las filas aplicables.
- Si una tarea pertenece a varias categorías, leer la unión de sus fuentes. Una búsqueda con `rg`, un fragmento o un resumen previo ayudan a localizar información, pero no sustituyen la lectura completa de una fuente marcada como **Lee antes**.
- No ejecutar una skill local hasta haber leído su `SKILL.md` y las fuentes canónicas que este índice o la propia skill exijan para la tarea.
- Dentro de las instrucciones propias del repositorio, `docs/reglas/` define las normas obligatorias; `ARCHITECTURE.md` define responsabilidades; `docs/planes/`, `docs/conocimiento/` y los catálogos describen sus ámbitos; las skills locales describen el procedimiento y no pueden redefinir permisos ni guardrails canónicos.
- Si una skill, plan, documento de conocimiento o catálogo contradice una regla canónica, seguir `docs/reglas/` y corregir la referencia secundaria contradictoria dentro del mismo cambio. No resolver el conflicto pidiendo una aprobación que la regla canónica ya concede.
- Cada norma se escribe una sola vez. Los documentos secundarios deben enlazar a su fuente de verdad en vez de copiarla.

## Contexto fijo

- `../ZapiV2`: destino de todo el trabajo y validación de V2.
- `../ZapiSocial`: referencia Laravel para auditar comportamiento útil; no se replica su arquitectura.
- `../template-shadcn-superdashboard`: fuente visual canónica. Cuando exista una superficie equivalente, se copia literalmente su composición a V2 y solo se adaptan datos, rutas, handlers, permisos y lógica real.

## Qué leer antes de actuar

| Si vas a…                                                                      | Lee antes                                                                                                       | Actualiza al cambiar…                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Ubicar código, usar `.env`, privilegios, PostgreSQL o migraciones Drizzle      | [`docs/reglas/workflow.md`](./docs/reglas/workflow.md)                                                          | Ese mismo archivo si cambia una norma operativa o de acceso a datos.                               |
| Diseñar o refactorizar UI, usar primitives, tokens, 21st, Next o Tailwind      | [`docs/reglas/design.md`](./docs/reglas/design.md) y [`packages/ui/COMPONENTS.md`](./packages/ui/COMPONENTS.md) | `design.md` para reglas; `COMPONENTS.md` al añadir, quitar o promover un primitive/pattern global. |
| Cerrar un cambio, validar, revisar o actualizar documentación                  | [`docs/reglas/calidad.md`](./docs/reglas/calidad.md)                                                            | El documento canónico del dominio y evidencia de validación en plan/PR.                            |
| Tocar sesión, permisos, ownership, secretos, providers o validación de entrada | [`docs/reglas/seguridad.md`](./docs/reglas/seguridad.md)                                                        | Ese mismo archivo si cambia una frontera de seguridad.                                             |
| Confirmar, publicar o abrir un PR                                              | [`docs/reglas/entrega.md`](./docs/reglas/entrega.md)                                                            | Ese mismo archivo si cambia la convención de commits o publicación.                                |
| Entender límites de Web, API, Worker, paquetes o dependencias                  | [`ARCHITECTURE.md`](./ARCHITECTURE.md)                                                                          | `ARCHITECTURE.md` si cambia una responsabilidad transversal.                                       |
| Cambiar una vertical de producto                                               | El plan pertinente en [`docs/planes/`](./docs/planes/) y la referencia Laravel equivalente                      | El plan de esa vertical al cambiar decisiones, equivalencias, alcance o estado.                    |
| Añadir un texto traducible o un idioma nuevo                                    | [`docs/conocimiento/i18n.md`](./docs/conocimiento/i18n.md)                                                      | Ese archivo si cambia el mecanismo de traducción.                                    |
| Consultar estado técnico, stack, despliegue o navegación actual                | [`docs/README.md`](./docs/README.md) para elegir el documento de `conocimiento/` correcto                       | El archivo de `conocimiento/` que sea fuente de verdad del hecho observado.                        |

## Orden mínimo de lectura

1. Este índice.
2. La regla correspondiente al tipo de cambio.
3. La arquitectura cuando el cambio cruza áreas del monorepo.
4. El plan del dominio y la referencia Laravel cuando el cambio es funcional.
5. Para UI, el catálogo de componentes y la fuente equivalente en `template-shadcn-superdashboard` antes de escribir markup.

No documentar secretos, tokens, datos de producción ni valores de `.env`.
