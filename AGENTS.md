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
