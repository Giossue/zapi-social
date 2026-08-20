# Reglas de entrega

Cómo se confirma y se publica el trabajo. Qué debe estar validado antes de llegar aquí está en [`calidad.md`](./calidad.md).

## Commits

- Un commit por unidad coherente. No se confirma una sesión completa de trabajo en un solo commit ni se mezclan cambios de dominios distintos.
- Formato del asunto: `tipo: descripción en imperativo`, en español, sin punto final y por debajo de 72 caracteres.
- Tipos en uso: `feature` para comportamiento nuevo o visible, `refactor` para reorganizar sin cambiar comportamiento, `fix` para corregir un defecto y `chore` para mantenimiento sin efecto funcional.
- El cuerpo es opcional y breve: explica el porqué cuando no se deduce del diff. No se listan archivos ni comandos ejecutados.
- Un cambio de comportamiento y su documentación viajan en el mismo commit. No se confirma código que deje el plan o la regla describiendo otro estado.
- Una migración Drizzle viaja con el código que la necesita y con el contrato afectado.

## Qué no se confirma

- Secretos, tokens, valores de `.env` o datos de producción, ni siquiera en fixtures o mensajes.
- Salidas de build, `node_modules`, artefactos de `.next`, `.turbo` o `dist`.
- Reformateo masivo ajeno al cambio. Si una herramienta toca archivos fuera del alcance, se revierten antes de confirmar.

## Publicar

- Confirmar y publicar solo cuando el usuario lo pide. No se hace `push` por iniciativa propia.
- No reescribir historial ya publicado sin una petición explícita.
- Si la rama actual es la principal, crear una rama antes de confirmar.

## Pull request

- El título resume el cambio con el mismo criterio que el asunto de un commit.
- La descripción indica qué cambió, qué significa para el producto u operación y qué validación se ejecutó, con su resultado real.
- Lo que no se validó se declara explícitamente; no se presenta como superado un comando que no se ejecutó.
