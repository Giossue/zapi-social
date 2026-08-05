# Watermarks V2

## Estado

El backend está implementado en contrato, cliente REST y Nest. La migración
aditiva `0018_gorgeous_doctor_faustus` está aplicada a `zapi_v2_local`.
Por solicitud explícita, el fixture funcional de `/portal/watermarks` se creó
directamente en V2, reutilizando los patrones de formularios, diálogos y
feedback ya canónicos del Portal.

## Referencia Laravel

`AppWatermark` guarda una sola regla global o una regla por cuenta social del
dueño del workspace. La regla usa una imagen de Files o texto, posición,
opacidad, escala y presentación tipográfica. Al publicar, Laravel genera una
copia efímera de imágenes compatibles; nunca escribe encima del original.

## Decisiones V2

- Una regla pertenece a un workspace y apunta a todas las cuentas (`global`) o
  a una cuenta social concreta. Una restricción única durable impide dos reglas
  para el mismo destino.
- La imagen de marca es un `file_asset` `ready`, de tipo `image/*`, del mismo
  workspace. No se admiten URLs externas ni archivos de otro workspace.
- Una regla es exactamente de imagen o de texto. La validación Zod y las
  constraints PostgreSQL exigen el contenido correspondiente, posición
  permitida y rangos de opacidad/escala de 5 a 100.
- El original y su miniatura no pueden borrarse mientras estén vinculados como
  marca de agua. Files expondrá el mismo conflicto público que ya usa para una
  referencia de Publishing, por lo que no deja configuraciones rotas.
- La preview de Portal será visual y local; aplicar píxeles sucede sólo durante
  el futuro Worker de entrega de Publishing. V2 hoy persiste posts pero aún no
  dispone de un worker que los publique, por lo que simular una transformación
  en un request sería un resultado que nadie consume. El contrato deja la regla
  durable y segura para ese worker, que debe generar un derivado temporal con
  `sharp`, nunca mutar `file_assets` original.

## Modelo durable propuesto

`publishing_watermarks`: workspace, autor, cuenta social opcional, tipo,
archivo opcional, texto opcional, posición, opacidad, escala, preset, color,
peso, timestamps y FKs compuestas para que cuenta y archivo pertenezcan al
mismo workspace.

Los cambios escriben en `api_audit_logs`. La eliminación de una regla no toca
el archivo seleccionado.

## Contrato REST propuesto

- `GET /v1/portal/watermarks` — reglas, cuentas activas y permiso de gestión.
- `GET /v1/portal/watermarks/:id` — regla del workspace.
- `POST /v1/portal/watermarks` — crear regla global o por cuenta.
- `PATCH /v1/portal/watermarks/:id` — editarla.
- `DELETE /v1/portal/watermarks/:id` — eliminarla.

Las mutaciones requieren `owner` o `admin`; cualquier miembro activo puede
leer para explicar qué reglas aplicarán en Publishing.

## Orden de implementación

1. [x] Añadir contrato, schema y migración aditiva con constraints/FKs.
2. [x] Implementar API Nest, ownership de workspace, auditoría y la protección
       de Files.
3. [x] Añadir cliente REST tipado y prueba focal preparada para PostgreSQL
       local.
4. [x] Crear el fixture funcional directo en Portal V2: ámbito global o varias
       cuentas, imagen o texto, controles, preview, guardado y eliminación
       locales. La selección de destinos no altera el borrador ni la pestaña
       activa del editor.
5. [ ] Sustituir el fixture por `watermarksApi` y el selector sintético por la
       biblioteca real de Files.
6. [ ] Conectar el renderer temporal al Worker de entrega de Publishing cuando
       exista dicha entrega.

## Fuera de alcance inicial

- Copiar reglas o archivos desde Laravel.
- Marcas de agua sobre vídeo, PDF o audio.
- Generar/publicar derivados antes de que Publishing V2 tenga un worker de
  entrega real.

## Evidencia de validación

- `packages/database`, `packages/contracts`, `packages/api-client` y
  `apps/api` pasan typecheck; Database, Contracts y API también pasan build.
  `packages/api-client` no declara un script de build.
- La migración se validó primero dentro de `BEGIN … ROLLBACK` y luego se aplicó
  a `zapi_v2_local` con el rol `zapi_social`: el historial pasó de 18 a 19,
  creó las cuatro tablas y las cuatro categorías iniciales, y verificó tres
  constraints/FKs críticos y tres índices.
- La migración crea primero los índices únicos compuestos requeridos por sus
  FKs compuestas; Drizzle generó esos índices al final, por lo que se reordenó
  únicamente la secuencia SQL para que PostgreSQL pueda aplicar la migración.
- `apps/api/src/support-watermarks.integration.spec.ts` comprueba aislamiento
  entre workspaces, rechazo de imágenes de otro workspace y el unique durable
  de una regla global. Exige explícitamente
  `SUPPORT_WATERMARKS_TEST_DATABASE_URL` apuntando sólo a
  `zapi_v2_local`. Tras aplicar `0018`, pasó 2/2 y confirmó que la transacción
  revierte sus fixtures: tickets, comentarios y reglas terminan en cero.
- `apps/web` pasa `typecheck` y `build`; la salida de Next incluye
  `/portal/watermarks`.
- Tras ajustar el selector de destinos, `apps/web` vuelve a pasar `typecheck`
  y el lint focal de `features/watermarks/components/watermarks-page.tsx`.
