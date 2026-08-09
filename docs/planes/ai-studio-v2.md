# AI Studio V2 — plan completo

## Objetivo

Construir AI Studio como vertical unificada de creación, revisión, reutilización,
planificación y automatización de contenido. Laravel aporta inventario funcional;
Zapi V2 conserva lo útil, elimina fallbacks engañosos y usa contratos tipados,
Nest, PostgreSQL y Worker.

```text
Laravel auditado
→ producto y acciones definidos
→ fuente canónica en diseño ideal
→ UI V2 con fixtures deterministas
→ aprobación visual
→ contratos Zod por herramienta
→ Nest/Drizzle/Worker
→ proveedor real y validación end-to-end
```

Este documento es fuente canónica del alcance AI. Publishing conserva dominio de
borradores y entregas en [publishing-v2.md](./publishing-v2.md); Files conserva
archivos; Teams conserva roles y grants; Watermarks conserva reglas aplicadas al
publicar.

## Implementación operativa — 9 de agosto de 2026

- Las 13 rutas de Portal ya consumen REST real: dashboard, generación de texto,
  imagen, video, reutilización, planner, revisión, horarios, búsqueda, historial,
  automatizaciones, ajustes y créditos. `prompt-history` redirige al historial
  unificado.
- `input` y `result` se validan por herramienta. Los trabajos conservan título,
  progreso, tokens, coste estimado, latencia, provider/modelo y archivado.
- Worker usa OpenAI Responses API para texto, GPT Image para generación/edición y
  el flujo durable de Videos API cuando Admin habilite un modelo de video válido.
  Timing y búsqueda son procesos internos honestos; no se presentan como métricas
  externas ni búsqueda semántica.
- Admin dispone de `/admin/settings/ai`: clave OpenAI cifrada, prueba obligatoria,
  activación, catálogo de modelos, routing principal/respaldo por herramienta,
  razonamiento, coste en créditos y consumo agregado.
- Catálogo inicial oficial: `gpt-5.6-sol` (calidad), `gpt-5.6-terra`
  (equilibrado), `gpt-5.6-luna` (economía), `gpt-image-2` y `sora-2`. Sora 2 queda
  deshabilitado y marcado obsoleto; no se activa silenciosamente un modelo legacy.
- Las migraciones `0025_mixed_krista_starr.sql` y
  `0026_ai_model_catalog_refresh.sql` están aplicadas en `zapi_v2_local` y
  `zapi_v2`: 27 entradas Drizzle, cinco modelos y nueve rutas en ambas bases.
- Los créditos respetan `enforceCredits`, el reembolso es idempotente y solo
  devuelve saldo realmente debitado. Owner/Admin puede mantener presupuesto y
  alerta mensual desde Portal.
- Pruebas añadidas cubren contratos/resultados del Worker, parsing de Responses,
  timezone, ajustes/budget contra PostgreSQL y rechazo de routing incompatible.

Lo siguiente describe la auditoría y el roadmap completo. Los puntos avanzados
que no forman parte del flujo visible actual —embeddings, planes normalizados por
ítem, plantillas/categorías y métricas de engagement del provider— siguen siendo
iteraciones posteriores y no se simulan como terminadas.

## Estado auditado antes de esta implementación

Esta sección conserva la línea base que motivó el trabajo. El estado operativo
actual está registrado arriba en **Implementación operativa — 9 de agosto de
2026**.

### Ya existe en V2

- Contrato genérico para solicitudes `content`, `image`, `repurpose`, `planner`,
  `review`, `timing`, `search` y `ai_publishing`.
- API Nest para crear, listar, consultar y cancelar solicitudes; usar resultado
  como borrador; leer ajustes/créditos; administrar programaciones AI.
- PostgreSQL para solicitudes, settings, cuentas de crédito, ledger y schedules.
- BullMQ con solicitudes durables, tres intentos, recuperación al arrancar,
  débito idempotente y devolución por fallo definitivo.
- Generación de imagen a `file_assets` con miniatura WebP.
- AI Publishing crea borradores editables; no publica directamente.
- Pruebas focales de idempotencia, permisos de destino, cancelación y rate limit.

### Brechas detectadas al iniciar

- Las 13 superficies de Portal existían como mock con fixtures sintéticos y no
  estaban conectadas al contrato REST ni al Worker.
- `/portal/ai-studio/prompt-history` redirige al nuevo historial unificado.
- Video no existía en contrato, API, persistencia ni Worker V2.
- No existían páginas operativas de Inicio, historial, ajustes, créditos,
  automatización ni administración AI.
- `input` y `result` son objetos genéricos; no hay contrato discriminado completo
  por herramienta.
- Review retorna texto libre; Planner acepta JSON sin schema de resultado;
  Repurpose separa variantes mediante `---`.
- Search es léxico con ranking opcional por texto; no usa embeddings.
- Timing cuenta horas UTC de posts publicados; no usa engagement ni timezone
  efectivo del usuario.

### Bloqueos que se corrigen antes de conectar UI real

1. `workspace_credit_accounts` nace con saldo `0` y `unlimited=false`.
   `ai_workspace_settings.enforceCredits` existe, pero el débito no lo consulta.
   Un workspace nuevo puede quedar bloqueado aunque enforcement esté apagado.
2. `preferredProvider`, `preferredTextModel` y `preferredImageModel` se guardan,
   pero Worker usa únicamente variables de entorno. Hoy no gobiernan ejecución.
3. No existe política Admin para grants, ajustes, ciclos o límites de créditos.
4. No existe smoke autenticado con proveedor aprobado.
5. Cobertura Worker no valida cada tipo, respuesta inválida, retry y refund.

## Auditoría Laravel — hechos observados

| Superficie      | Comportamiento útil observado                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI Content      | Categorías y plantillas, brief, plataformas, tono, idioma, creatividad, hashtags, longitud, cantidad de variantes, tags e historial. Guarda en Captions. |
| AI Image        | Texto a imagen, hasta diez referencias, edición image-to-image según provider, prompt enhancer, estilo, ratio, historial y guardado en Files.            |
| AI Video        | Texto o referencias a video, formatos, duración 4/8/12, coste multiplicado, job externo, polling, progreso y guardado en Files.                          |
| Repurpose       | Fuente textual, plataformas, tono/idioma, variantes, historial y guardado individual o masivo en Captions.                                               |
| Planner         | Brief, fecha inicial, 3–31 días, calendario, planes guardados con crear/cargar/editar/eliminar e historial.                                              |
| Review          | Draft, plataformas e idioma; score, veredicto, fortalezas, riesgos, correcciones y consejo.                                                              |
| Best Time       | Selección de cuentas y slots derivados de historial de posts. No mide engagement real.                                                                   |
| Semantic Search | Busca Captions y Publishing mediante coincidencia/tokenización y score local. No usa embeddings reales.                                                  |
| Prompt History  | Filtra por texto/módulo, pagina, renombra, elimina y vuelve a cargar resultados de seis herramientas.                                                    |
| Settings        | Preferencias personales heredables y reglas workspace: voz, palabras prohibidas y CTA.                                                                   |
| AI Publishing   | Pool de prompts, cuentas, campañas/labels, días/horas, rango, tono/idioma y media AI/externa; permite pausar, iniciar y ejecutar ahora.                  |
| Admin AI        | Estado global, providers/modelos, plantillas/categorías, feature flags, créditos y logs de uso.                                                          |

### Divergencias V2 confirmadas

- No copiar el servicio Laravel de más de 2.200 líneas; usar casos de uso y
  adapters separados por capacidad.
- No ejecutar generación lenta dentro del request HTTP.
- No devolver fallback local fingiendo generación AI. Provider ausente o fallido
  produce estado/error público explícito.
- No llamar “semántica” a búsqueda léxica ni “mejor horario” a una simple cuenta
  de publicaciones.
- No guardar claves de providers en opciones genéricas sin cifrado.
- No mostrar providers/modelos que no tengan adapter operativo.
- No publicar automáticamente por defecto: resultado AI crea borrador revisable.

## Decisiones de producto

### Navegación Portal objetivo

```text
AI Studio
├── Inicio                    /portal/ai-studio
├── Contenido AI              /portal/ai-studio/ai-content
├── Imagen AI                 /portal/ai-studio/image
├── Video AI                  /portal/ai-studio/video
├── Reutilizar                /portal/ai-studio/repurpose
├── Planner                   /portal/ai-studio/planner
├── Revisión AI               /portal/ai-studio/review
├── Mejor horario             /portal/ai-studio/timing
├── Búsqueda semántica        /portal/ai-studio/search
├── Historial                 /portal/ai-studio/history
├── Automatización AI         /portal/ai-studio/automation
├── Ajustes AI                /portal/ai-studio/settings
└── Créditos AI               /portal/ai-studio/credits
```

`/portal/ai-studio/prompt-history` redirigirá a `history` cuando la nueva ruta
esté conectada. `/portal/credits` solo permanece si Commerce decide centralizar
todos los créditos; hasta esa decisión, AI usa su ruta propia sin inventar compra.

### Roles y ownership

| Acción                                 | owner            | admin            | member                                 |
| -------------------------------------- | ---------------- | ---------------- | -------------------------------------- |
| Usar herramientas permitidas           | Sí               | Sí               | Sí, dentro de cuentas concedidas       |
| Ver historial propio                   | Sí               | Sí               | Sí                                     |
| Ver historial global workspace         | Sí               | Sí               | No por defecto                         |
| Mantener preferencias personales       | Sí               | Sí               | Sí                                     |
| Mantener Brand Kit/workspace           | Sí               | Sí               | No                                     |
| Administrar automatizaciones           | Sí               | Sí               | No                                     |
| Crear borradores hacia cuentas         | Sí               | Sí               | Solo si política Publishing lo permite |
| Administrar provider, modelos y costes | Admin plataforma | Admin plataforma | No                                     |

Cada consulta conserva `workspace_id` y `requested_by_user_id`. Cuentas y archivos
se filtran con política central de Teams; AI no crea permisos paralelos.

### Reglas compartidas de experiencia

- Shell de Portal entrega título/descripcion; páginas empiezan con acciones.
- Sin hero cards.
- Una acción principal por contexto, icono semántico a la izquierda.
- Formularios `noValidate`, campos obligatorios con asterisco rojo, botón
  deshabilitado hasta completar requeridos y errores mediante toast.
- `PageLoading` para regiones; `Spinner` solo dentro de control pendiente.
- Trabajos durables muestran estado `queued`, `processing`, `succeeded`,
  `failed` o `cancelled`.
- Resultado nunca desaparece por recargar; PostgreSQL manda.
- Acción contextual usa patrón Files: tres puntos, acciones normales, separador y
  destructiva al final.
- Cada pantalla cubre normal, loading, vacío, sin resultados, error, permisos,
  pending, móvil y claro/oscuro.

No existe fuente AI exacta en `diseño ideal`. Para esta vertical, producto decidió
que el mockup viva directamente en Portal V2; no se mantiene una copia paralela
en `diseño ideal`.

## Módulos de producto

### 1. Inicio de AI Studio

**Propósito:** centro operativo; no genera por sí solo.

**Mostrará:**

- accesos a herramientas habilitadas por plan;
- saldo y consumo del ciclo;
- solicitudes en cola/proceso;
- trabajos recientes con tipo, autor, estado, fecha y coste;
- borradores AI recientes;
- media AI reciente;
- próxima automatización activa.

**Acciones:** crear nuevo, abrir herramienta, continuar trabajo, cancelar queued,
reintentar failed elegible, abrir resultado, abrir borrador y ver historial.

**Estados específicos:** workspace sin AI, provider no configurado, cero créditos
con enforcement activo, ninguna actividad, jobs en progreso y fallo parcial de una
sección sin tumbar toda la página.

**Datos:** una respuesta agregada o composición server-side de endpoints AI,
Publishing y Files. No hacer N+1 desde cliente.

### 2. Contenido AI

**Entrada:** plantilla/categoría opcional, brief obligatorio, objetivo, plataformas,
tono, idioma, creatividad, longitud aproximada, hashtags, CTA y 1–8 variantes.

**Salida tipada:** resumen y variantes con plataforma, hook, caption, hashtags,
CTA y notas; tags sugeridos separados.

**Acciones:** copiar, editar localmente, regenerar una variante, duplicar, marcar
favorita, guardar en Captions, guardar todas y crear borrador por cuentas elegidas.

**Mejora V2:** plantillas admiten variables explícitas y validan placeholders antes
de consumir créditos. No se devuelve el brief casi sin cambios.

### 3. Imagen AI

**Entrada:** prompt, cero o varias referencias, modo generar/editar/variar, estilo,
ratio, resolución y cantidad de resultados.

**Salida tipada:** assets generados, prompt revisado, provider/modelo, dimensiones,
coste y procedencia.

**Acciones:** vista previa, descargar, renombrar, mover, crear variación, editar con
nuevo prompt, usar en Publishing y abrir en Files.

**Persistencia:** todo resultado válido es `file_asset`; referencias deben estar
`ready`, ser imagen y pertenecer al workspace. No guardar referencia externa como
archivo sin pasar por Files/Online Media.

### 4. Video AI

**Entrada:** prompt, referencias opcionales, modo texto-a-video/imagen-a-video,
duración permitida por plan, formato vertical/cuadrado/horizontal y estilo.

**Salida:** job durable con progreso, preview cuando exista, asset final, duración,
dimensiones, provider/modelo y coste real reservado/confirmado.

**Acciones:** cancelar mientras provider lo permita, reintentar fallo seguro,
descargar, renombrar, mover, abrir en Files y usar en Publishing.

**Decisión:** módulo final de generación. Requiere adapter con creación, consulta,
cancelación y descarga; no polling manual desde Livewire ni request largo.

### 5. Reutilizar contenido

**Fuentes iniciales:** texto, Caption, borrador/publicación y resultado AI. URL,
RSS, audio y video quedan para iteración posterior con extracción segura.

**Entrada:** fuente, plataformas/formatos destino, tono, idioma, longitud y CTA.

**Salida:** estrategia breve y variante estructurada por destino.

**Acciones:** editar, regenerar una, guardar individual/todas en Captions y crear
borradores. Cada resultado conserva referencia al origen.

### 6. Planner AI

**Entrada:** nombre, brief/campaña, fecha inicial/final o cantidad de días,
plataformas, frecuencia, temas, objetivos, productos y reglas de marca.

**Salida:** calendario editable con fecha, plataforma, tema, objetivo, brief de
caption, brief visual y CTA.

**Acciones:** crear, guardar, editar, duplicar, eliminar, generar caption/imagen
desde un item y convertir items seleccionados en borradores.

**Persistencia:** planes e items normalizados cuando las acciones por item lo
requieran; no conservar calendario operativo únicamente como JSON opaco.

### 7. Revisión AI

**Fuente:** texto, Caption, borrador o resultado AI.

**Entrada:** contenido, plataformas, idioma y objetivo.

**Salida tipada:** score 0–100, veredicto, claridad, tono, CTA, cumplimiento de
marca, fortalezas, riesgos, correcciones y versión final propuesta.

**Acciones:** comparar original/corrección, aplicar a origen, guardar como Caption
y crear/actualizar borrador. Aplicar nunca publica.

### 8. Mejor horario

**Entrada:** cuentas concedidas, rango histórico y timezone IANA.

**Primera versión honesta:** slots basados en publicaciones y muestra visible;
nombre UI temporal “Horarios frecuentes” si aún no existe engagement.

**Versión objetivo:** alcance, engagement, clics y publicaciones por cuenta/red;
heatmap, mejor slot, confianza y tamaño de muestra.

**Acciones:** aplicar horario al Composer o usarlo en automatización.

**Regla:** datos insuficientes muestran estado explícito; no devolver defaults como
recomendación basada en usuario.

### 9. Búsqueda semántica

**Corpus:** Captions, Publishing, solicitudes/resultados AI, planes y texto
indexable de Files. Siempre aislado por workspace y permisos.

**Entrada:** consulta y filtros por tipo, plataforma, fecha, autor y tags.

**Salida:** resultados ordenados, score, extracto, origen y explicación breve de
coincidencia.

**Acciones:** abrir, usar como fuente de Repurpose, crear borrador y continuar en
herramienta relacionada.

**Fases:** búsqueda léxica se etiqueta “inteligente”; nombre “semántica” solo tras
embeddings, índice vectorial, estrategia de reindexado y pruebas de aislamiento.

### 10. Historial AI

**Mostrará:** tipo, título, prompt resumido, usuario, estado, provider/modelo,
coste, fecha y resultado/error seguro.

**Filtros:** texto, herramienta, estado, usuario cuando actor puede ver workspace,
provider y rango de fechas.

**Acciones:** abrir, renombrar, duplicar, reutilizar configuración, reintentar,
cancelar queued y archivar. Solicitudes cobradas no se borran físicamente del
ledger; “eliminar” será archivo/ocultación auditada.

### 11. Automatización AI

**Entrada:** nombre, prompts, cuentas, días/horas, timezone, rango activo, tono,
idioma, hashtags, CTA y modo de media.

**Estados:** draft, active, paused y ended; ejecuciones separadas con queued,
processing, succeeded, failed o cancelled.

**Acciones:** crear, editar, duplicar, activar, pausar, ejecutar ahora, terminar,
eliminar draft y ver ejecuciones.

**Regla:** genera borradores en Publishing. Publicación directa queda desactivada
hasta existir aprobación explícita, permisos y política de conciliación.

### 12. Ajustes AI

**Mis preferencias:** idioma, tono, plataformas, duración Planner, estilo/ratio de
imagen y formato/duración de video. Usuario puede heredar valores workspace.

**Workspace / Brand Kit:** voz de marca, negocio, audiencia, productos/servicios,
CTA preferido, palabras prohibidas, ejemplos aprobados y referencias visuales.

**Administración:** owner/admin cambia workspace; cualquier miembro cambia sus
preferencias. Herencia y valor efectivo se muestran claramente.

### 13. Créditos AI

**Mostrará:** saldo, unlimited, ciclo, consumo, coste por herramienta y ledger con
grant/debit/refund/adjustment.

**Acciones Portal:** filtrar movimientos y configurar alertas/presupuesto si rol lo
permite. Compra no se inventa; enlaza a Billing cuando exista.

**Reglas:** coste visible antes de generar, reserva/cobro idempotente, refund único,
límites por workspace/usuario y presupuesto por periodo.

### 14. Administración AI

**Providers:** estado, credencial cifrada, prueba de conexión, capacidades y modelo
permitido. Solo server-side.

**Routing:** provider/modelo por tarea; fallback solo hacia provider alterno real,
registrado y compatible, nunca contenido local fingido.

**Gobernanza:** feature flags, costes, límites de plan, templates/categorías,
presupuestos, salud de colas, uso, tokens, coste estimado, latencia y errores.

**Regla:** provider/modelo no aparece seleccionable hasta tener adapter y health
válido. Logs redactan prompts sensibles y nunca guardan claves.

## Contratos y REST objetivo

### Dirección de contrato

- Sustituir `input: Record<string, unknown>` por unión discriminada por `kind`.
- Definir schema de resultado por `kind`; Worker valida respuesta antes de éxito.
- Mantener campos comunes: id, workspace, requester, status, cost, provider,
  model, error público y timestamps.
- Separar error público de detalle interno redactado.
- Usar idempotency key para toda generación y toda creación de borradores.

### REST existente que se conserva

```text
GET    /v1/portal/ai/requests
POST   /v1/portal/ai/requests
GET    /v1/portal/ai/requests/:id
POST   /v1/portal/ai/requests/:id/cancel
POST   /v1/portal/ai/requests/:id/use-as-draft
GET    /v1/portal/ai/settings
PATCH  /v1/portal/ai/settings
GET    /v1/portal/ai/credits
GET    /v1/portal/ai/publishing-schedules
POST   /v1/portal/ai/publishing-schedules
PATCH  /v1/portal/ai/publishing-schedules/:id
DELETE /v1/portal/ai/publishing-schedules/:id
POST   /v1/portal/ai/publishing-schedules/:id/run
```

### Contrato pendiente tras aprobar mocks

- Dashboard agregado de Inicio.
- Templates/categorías de Portal y CRUD Admin.
- Renombrar, duplicar, reintentar y archivar historial.
- CRUD durable de planes e items.
- Resultados parciales/variantes y regeneración individual.
- Administración de cuentas/ciclos/grants de crédito.
- Providers, health y routing Admin.
- Video: crear, consultar, cancelar y materializar asset.
- Brand Kit y referencias Files.
- Índice/reindexado de búsqueda semántica.

No cerrar rutas nuevas exactas antes de aprobar acciones y estados mock.

## Persistencia

### Existente

- `ai_requests`
- `ai_workspace_settings`
- `ai_user_settings`
- `workspace_credit_accounts`
- `credit_ledger_entries`
- `ai_publishing_schedules`
- `ai_publishing_schedule_targets`
- `file_assets.metadata` para procedencia AI

### Cambios esperados, sujetos a UI/contrato aprobado

- contratos JSON tipados y versión de schema de resultado;
- título, archivo/visibilidad y relación de solicitud origen;
- templates y categorías administrables;
- Brand Kit y referencias a Files normalizadas;
- planes/items durables;
- ejecuciones de automatización separadas de schedule;
- provider configurations cifradas o integración con almacén de secretos existente;
- métricas/costes AI y presupuestos;
- video jobs y referencia al asset final;
- embeddings e índice vectorial cuando Search alcance fase semántica.

Toda migración será aditiva, Drizzle, verificada local/remoto según
`docs/reglas/workflow.md`. No copiar prompts, keys ni resultados Laravel.

## Worker y providers

- Una cola o routing claro por capacidad; estado durable siempre en PostgreSQL.
- Jobs estables, retries limitados, backoff y clasificación de error permanente o
  transitorio.
- Cancelación solo cuando no pueda existir consumo remoto ambiguo.
- Timeout por capacidad; image/video no usan límite de texto.
- Provider adapter normaliza request, response, uso, coste y errores.
- Output se valida con Zod antes de marcar `succeeded`.
- Imágenes/videos se validan por firma MIME, tamaño y dimensiones/duración antes
  de Files.
- Moderación y límites aplican antes de provider y antes de exponer resultado.
- Métricas: provider, model, capacidad, tokens/unidades, coste, latencia, intento y
  error seguro.

## Integraciones

- **Publishing:** único creador/entregador de posts. AI produce borradores.
- **Captions:** destino reusable de Content y Repurpose.
- **Files:** dueño de media y derivados.
- **Online Media:** importa referencias externas antes de usarlas.
- **Teams:** roles y grants de cuentas.
- **Watermarks:** se aplican durante entrega Publishing, nunca sobre original AI.
- **Commerce/Billing:** futura compra/asignación contractual de créditos.
- **Admin Integrations:** credenciales cifradas, health y routing provider.

## Orden completo de implementación

### Fase 0 — auditoría y definición

1. [x] Auditar módulos, rutas, acciones, modelos y providers Laravel. Evidencia:
       sección **Auditoría Laravel — hechos observados**.
2. [x] Auditar contrato, API, schema, Worker y Web AI actuales de V2. Evidencia:
       sección **Estado real de partida**.
3. [x] Definir alcance, divergencias, módulos, ownership e integraciones objetivo.
       Evidencia: este plan completo.

### Fase 1 — mockup Portal completo

4. [x] Crear directamente en V2 las 13 superficies de Portal con fixtures
       sintéticos y navegación funcional por decisión explícita de producto.
       Evidencia: sección **Mockup Portal en V2**.
5. [x] Obtener aprobación visual del conjunto.
6. [ ] Completar y aprobar variantes loading/empty/error/sin permiso, responsive y
       claro/oscuro donde cada flujo lo requiera.
7. [x] Crear la superficie de Administración IA únicamente dentro de Admin cuando
       producto solicite esa fase; nunca exponerla en Portal.

### Fase 2 — sanear base AI y conectar Inicio

8. [x] Corregir enforcement de créditos y definir alta segura de workspace.
9. [ ] Definir política Admin de grant, adjustment, ciclos, unlimited y budgets.
10. [x] Hacer efectivo provider/model routing o retirar campos decorativos.
11. [x] Crear unión Zod discriminada y resultados tipados por herramienta existente.
12. [ ] Separar adapters/casos de uso Worker; añadir tests por kind y fallo/refund.
13. [ ] Ejecutar smoke con provider aprobado sin registrar secretos.
14. [x] Definir contrato de dashboard agregado según mock aprobado.
15. [x] Implementar Nest/API Client y conectar Inicio sin N+1.
16. [x] Retirar fixture de Inicio y validar flujo autenticado.

### Fase 3 — núcleo textual

17. [x] Contenido AI: fuente canónica, mock, aprobación, contrato y backend real.
18. [x] Repurpose: fuentes iniciales, variantes tipadas y destinos Captions/Drafts.
19. [x] Review: score y correcciones tipadas, comparación y aplicación segura.
20. [ ] Historial: filtros, detalle, rename/duplicate/retry/archive y estados job.

### Fase 4 — imagen y Files

21. [x] Image: fuente canónica, generación, referencias, variación y edición.
22. [x] Persistir outputs/referencias con ownership Files y provenance.
23. [ ] Integrar resultado con Preview, Files y Publishing.

### Fase 5 — planificación e inteligencia local

24. [ ] Planner: calendario mock aprobado, planes/items durables y acciones por item.
25. [x] Timing fase honesta con timezone, tamaño de muestra y sin defaults fingidos.
26. [ ] Integrar métricas de providers; activar “Mejor horario” real con engagement.
27. [x] Search léxico honesto con filtros y permisos.
28. [ ] Añadir embeddings, reindexado e índice vectorial; activar nombre semántico.

### Fase 6 — settings, Brand Kit y créditos Portal

29. [ ] Ajustes personales con herencia visible.
30. [x] Brand Kit workspace con reglas y referencias Files.
31. [x] Créditos Portal con coste previo, ledger, alertas y presupuesto.

### Fase 7 — Automatización AI

32. [x] Crear fuente canónica y mock de schedules/runs.
33. [x] Separar schedule de ejecuciones y resultados durables.
34. [x] Conectar generación a borradores Publishing y cuentas permitidas.
35. [ ] Cubrir activar, pausar, ejecutar, terminar, retry y conciliación.

### Fase 8 — Video AI

36. [ ] Aprobar provider, modelos, formatos, duraciones, coste y moderación.
37. [x] Crear fuente canónica y mock con progreso/error/cancelación.
38. [x] Añadir contrato, persistencia, adapter y Worker video.
39. [ ] Guardar resultado en Files e integrar Preview/Publishing.

### Fase 9 — Administración y cierre

40. [x] Providers cifrados, health, routing y feature flags.
41. [ ] Templates/categorías y costos/planes.
42. [x] Logs de tokens, coste, latencia, errores y salud de colas.
43. [ ] Retirar fixtures, rutas muertas, aliases y contratos genéricos residuales.
44. [ ] Validación end-to-end, OpenAPI, docs y evidencia local/remota.

## Criterios de aceptación por superficie

| Estado                 | Criterio                                                                   |
| ---------------------- | -------------------------------------------------------------------------- |
| Normal                 | Datos y acciones coinciden con contrato aprobado.                          |
| Loading                | `PageLoading`; navegación y contexto no desaparecen.                       |
| Vacío                  | Mensaje contextual sin duplicar acción principal persistente.              |
| Sin resultados         | Mantiene filtros y ofrece limpiar búsqueda.                                |
| Error                  | Código público traducido, toast para acción y reintento cuando sea seguro. |
| Sin permiso            | Oculta mutación; conserva lectura útil cuando aplique.                     |
| Pending                | Evita doble envío; `Spinner` en acción iniciadora.                         |
| Créditos insuficientes | Bloquea antes de encolar y explica coste/saldo.                            |
| Provider ausente       | Estado explícito; nunca mock/fallback.                                     |
| Responsive             | Flujo completo usable en móvil, no solo tabla recortada.                   |
| Temas                  | Contraste y jerarquía verificados en claro/oscuro.                         |

## Fuera de alcance hasta decisión explícita

- copiar datos, prompts, historiales, claves o archivos AI de Laravel;
- entrenar modelos propios;
- publicar automáticamente por defecto;
- cobrar o vender créditos sin Billing aprobado;
- exponer elección libre de cualquier modelo al member;
- usar contenido privado del workspace para entrenamiento del provider;
- voz/realtime/código/chat general dentro de AI Studio;
- llamar semántica/timing óptimo a heurísticas que aún no usan datos suficientes.

## Evidencia actual y regla de cierre

Evidencia final de esta entrega:

- Migraciones `0025_mixed_krista_starr` y `0026_ai_model_catalog_refresh`
  aplicadas y verificadas en local y remoto con el mismo historial.
- `bun run typecheck` y `bun run build` correctos para Database, Contracts, API
  Client, API, Worker y Web; Next generó las 13 superficies de Portal y Admin AI.
- Seis pruebas AI pasan: cuatro de contrato/procesamiento Worker y dos de
  integración API/PostgreSQL con rollback.
- Lint focal API/Worker sin errores ni advertencias; lint focal Web sin errores.
- Escaneo focal de secretos y `git diff --check` correctos.

### Mockup Portal en V2 — 9 de agosto de 2026

- Rutas creadas bajo `/portal/ai-studio`: Inicio, Contenido, Imágenes, Video,
  Reutilizar, Planner, Revisión, Mejor horario, Investigación, Historial,
  Automatizaciones, Ajustes y Créditos.
- Administración IA no fue copiada ni expuesta en Portal; vive en
  `/admin/settings/ai`.
- Navegación Portal actualizada; `prompt-history` redirige a `history` y Créditos
  usa `/portal/ai-studio/credits`.
- `bun run typecheck`: correcto.
- Lint focal Web: sin errores. Conserva advertencias no bloqueantes de la regla
  React para cargas asíncronas iniciadas desde efectos y tres componentes mock
  históricos sin uso.
- `bun run build`: correcto; Next generó todas las rutas Portal AI Studio y
  completó TypeScript.

La vertical no se considera cerrada por tener backend genérico. Cada módulo cierra
solo cuando fuente visual aprobada, UI V2, contrato tipado, autorización,
persistencia, Worker/provider, pruebas y documentación describen el mismo flujo.

**Siguiente validación operativa:** configurar y probar una clave OpenAI desde
Admin, desplegar API/Web/Worker y ejecutar un smoke autenticado contra el
provider. No se guarda ni registra la clave en la evidencia.
