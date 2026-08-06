# AI Studio V2

## Estado

Portal sólo tiene un mock local de contenido AI. No hay contrato, persistencia,
proveedor, créditos ni Worker V2.

## Referencia Laravel observada

`AppAIContent`, `AppAIImage`, `AppAIVideo`, `AppAIRepurpose`,
`AppAIReview`, `AppAIContentPlanner`, `AppAISemanticSearch` y
`AppAIBestTime` son verticales distintas. Comparten settings e historial en
`AppAIStudio`, pero no una única acción ni un modelo durable común.

## Decisión V2

La primera fase será sólo **Contenido AI**: crear una solicitud, conservar el
resultado, registrar consumo y permitir usarlo como borrador de Publishing.
Imagen, vídeo, búsqueda semántica, planner, revisión y mejor horario quedan en
verticales posteriores; no se exponen endpoints ficticios para ellas.

## Modelo y API propuestos

- `ai_content_requests`: workspace, autor, prompt saneado, estado, modelo
  público, coste, resultado o error público, timestamps e idempotency key.
- `credit_ledger_entries`: workspace, acción, unidades debitadas/revertidas,
  request y timestamps. El saldo no vive sólo en Redis.
- `POST /v1/portal/ai-content/requests` crea la solicitud e idempotency key.
- `GET /v1/portal/ai-content/requests` lista sólo el workspace actual.
- `GET /v1/portal/ai-content/requests/:id` devuelve estado y resultado seguro.
- El Worker llama al proveedor, persiste resultado/error y compensa créditos
  cuando el trabajo falla de forma definitiva.

## Orden

1. [x] Auditar la separación Laravel y registrar alcance MVP.
2. [x] Mantener la UI mock ya aprobada para Contenido AI.
3. [ ] Aprobar proveedor, modelos permitidos, precios y política de créditos.
4. [ ] Definir contratos, migración, Nest, Worker e idempotencia.
5. [ ] Sustituir el mock por REST y validar cada estado asíncrono.

## Fuera de alcance MVP

- Exponer claves o prompts internos del proveedor al navegador.
- Generación de imagen/vídeo y búsqueda semántica.
- Cobros o créditos sin un ledger durable y una política aprobada.
