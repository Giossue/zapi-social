# AI Studio V2 — plan completo

## Objetivo

Construir AI Studio como vertical unificada de creación, revisión, reutilización,
planificación y automatización de contenido. Laravel aporta inventario funcional;
Zapi V2 conserva lo útil, elimina fallbacks engañosos y usa contratos tipados,
Nest, PostgreSQL y Worker.

```text
Laravel auditado
→ producto y acciones definidos
→ fuente canónica en template-shadcn-superdashboard
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
- Worker usa OpenAI Responses API solo para texto y AtlasCloud para imagen y
  video. Los trabajos de media se envían de forma asíncrona, conservan el
  `prediction_id`, reanudan polling sin duplicar el job remoto y guardan el
  resultado validado en Files. Timing y búsqueda son procesos internos honestos.
- Admin dispone de `/admin/settings/ai`: claves separadas de OpenAI y AtlasCloud,
  cifrado, prueba obligatoria, activación, catálogo de modelos, routing
  principal/respaldo con y sin referencias, razonamiento, créditos y consumo.
- Catálogo activo: `gpt-5.6-sol`, `gpt-5.6-terra` y `gpt-5.6-luna` para texto;
  ocho modelos AtlasCloud para texto-a-imagen/imagen-a-imagen y tres variantes de
  Seedance 2 para texto-a-video, imagen-a-video y referencias-a-video. Los modelos
  directos de media de OpenAI quedan deshabilitados y obsoletos.
- Las migraciones `0025_mixed_krista_starr.sql`,
  `0026_ai_model_catalog_refresh.sql` y `0027_normal_screwball.sql` están
  aplicadas en `zapi_v2_local` y `zapi_v2`: 28 entradas Drizzle, cinco modelos
  OpenAI, once AtlasCloud y nueve rutas en ambas bases.
- Los créditos respetan `enforceCredits`, el reembolso es idempotente y solo
  devuelve saldo realmente debitado. Owner/Admin puede mantener presupuesto y
  alerta mensual desde Portal.
- Pruebas añadidas cubren contratos/resultados del Worker, parsing de Responses,
  timezone, ajustes/budget contra PostgreSQL y rechazo de routing incompatible.

## Refactor operativo — 12 de agosto de 2026

- Historial, Automatizaciones y Créditos usan la fuente canónica de
  `template-shadcn-superdashboard/dashboard/ai-studio` y la misma composición en Portal V2.
- Las tres superficies distinguen carga, error, `403`, vacío inicial y búsqueda
  sin resultados; un fallo de API ya no se representa como colección vacía ni
  deja un loader permanente.
- Las colecciones usan cabecera, toolbar, filtros funcionales y paginación
  compacta compartida. Historial filtra desde REST; Automatizaciones y el ledger
  de Créditos filtran y paginan la respuesta real en cliente.
- Automatizaciones conserva permisos: owner/admin mutan; member mantiene lectura
  sin acciones operativas. Eliminar exige `AlertDialog` y cada mutación pendiente
  bloquea doble envío con `Spinner` dentro del control iniciador.
- Formularios usan `noValidate`, asterisco rojo y `aria-required`; los botones no
  se habilitan hasta completar y validar los campos requeridos.
- Inicio, Créditos y el resumen de uso en `/admin/settings/ai` comparten
  `MetricCard`: icono semántico por dato, valor y contexto breve. Se retiraron
  las dos implementaciones legacy de Créditos que ya no participaban del routing.
- Validación: TypeScript y build correctos tanto en `template-shadcn-superdashboard` como en
  `apps/web`; lint focal sin errores y `git diff --check` correcto.

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
├── Ajustes AI                /portal/settings/ai-studio
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

Historial, Automatizaciones y Créditos tienen fuente visual exacta en
`../template-shadcn-superdashboard/src/app/(main)/dashboard/ai-studio/_components/ai-studio-operations.tsx`.
La ruta canónica `/dashboard/ai-studio` permite recorrer sus variantes normal,
loading, vacío, error y sin permiso. Portal V2 conserva la misma composición y
solo adapta datos, permisos y handlers al contrato real.

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

**Control horario:** reutiliza literalmente el `TimePicker` canónico de
Publishing: el `Input type="time"` compacto del ejemplo oficial de shadcn/ui,
adaptado al contrato `HH:mm` con precisión de un minuto. No genera una lista de
combinaciones ni divide la hora en dos controles visibles.

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

OpenAI atiende texto; AtlasCloud atiende imagen y video. Cada credencial usa AAD
propio (`ai:openai` y `ai:atlascloud`) y nunca se entrega al navegador. La prueba
AtlasCloud consulta balance mediante su API pública autenticada antes de permitir
la activación.

**Routing:** provider/modelo por tarea; fallback solo hacia provider alterno real,
registrado y compatible, nunca contenido local fingido.

Imagen y video mantienen rutas distintas para solicitudes sin referencias y con
referencias. Imagen admite hasta diez archivos; video hasta nueve. Solo se aceptan
JPG, PNG o WebP de hasta 30 MB, pertenecientes al workspace y en estado `ready`.

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
- OpenAI ejecuta texto. AtlasCloud ejecuta imagen y video mediante
  `generateImage`, `generateVideo` y polling de `prediction/{id}`.
- Las referencias privadas se leen desde Files y se convierten a data URI solo en
  Worker; no se publican ni se entregan como URLs temporales al proveedor.
- Un retry reutiliza el `prediction_id` persistido. El fallback solo puede entrar
  si el envío falló antes de recibir ese identificador, evitando duplicar trabajos
  facturables.
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

4. [x] Crear las 13 superficies de Portal con fixtures sintéticos y navegación
       funcional. Historial, Automatizaciones y Créditos se consolidaron después
       en fuente canónica exacta antes de adaptar APIs y permisos en V2.
       Evidencia: secciones **Mockup Portal en V2** y
       **Refactor operativo — 12 de agosto de 2026**.
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

- Migraciones `0025_mixed_krista_starr`, `0026_ai_model_catalog_refresh` y
  `0027_normal_screwball` aplicadas y verificadas en local y remoto con el mismo
  historial de 28 entradas.
- `bun run typecheck` y `bun run build` correctos para Database, Contracts, API
  Client, API, Worker y Web; Next generó las 13 superficies de Portal y Admin AI.
- Ocho pruebas AI pasan: seis de contrato/procesamiento Worker y dos de
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

**Siguiente validación operativa:** configurar y probar las claves OpenAI y
AtlasCloud desde Admin, desplegar API/Web/Worker y ejecutar un smoke autenticado
por capacidad. No se guarda ni registra ninguna clave en la evidencia.

## Consolidación en interfaz de chat — 20 de agosto de 2026

### Problema

AI Studio expone trece rutas. Nueve de ellas son la misma operación —describir algo y
recibir un resultado— con formularios distintos, así que las opciones quedan repartidas y
cada herramienta se aprende por separado. La decisión es concentrar la generación en una
sola conversación y conservar **todas** las capacidades actuales como opciones dentro de
ella; ninguna entrada, salida ni acción del inventario de módulos se elimina.

### Fuente visual

`../template-shadcn-superdashboard` contiene una superficie de chat completa en
`src/app/(main)/chat/_components`: lista de conversaciones, hilo y panel lateral de detalle
en una rejilla de tres columnas con colapso responsive. Aporta la lista y el hilo base. Por
decisión posterior de producto, el compositor y la experiencia conversacional usan el
registry oficial de AI Elements; el panel de detalle del template se sustituye por un
`Sheet` contextual porque las opciones pertenecen a la próxima generación, no al resultado
seleccionado.

### Superficie objetivo

```text
/portal/ai-studio
├── Área 1  Conversaciones   historial de solicitudes AI, con búsqueda y filtros
├── Área 2  Hilo             mensajes, resultados tipados y acciones por resultado
└── Sheet   Opciones         herramienta activa y sus ajustes desde el compositor
```

- **Herramienta activa**: selector en el compositor con las ocho capacidades de generación
  (contenido, imagen, video, reutilizar, revisión, planner, mejor horario e investigación).
  Cambiar de herramienta cambia el panel de opciones, no de pantalla.
- **Opciones por herramienta**: las mismas del inventario de módulos —tono, plataformas,
  idioma, variantes, ratio, resolución, duración, fuente de reutilización, rango de fechas—
  se abren desde el compositor en un `Sheet`; no ocupan permanentemente un tercio del
  lienzo ni vuelven a repartirse por rutas.
- **Conversaciones**: cada solicitud AI existente es una conversación. Sustituye a las
  vistas Historial y Búsqueda semántica, que aportaban lista y filtros sobre los mismos
  datos.
- **Acciones por resultado**: copiar, regenerar, guardar en Captions, crear borrador,
  abrir en Files, usar en Publishing, reintentar y archivar se mantienen dentro del hilo.

### Rutas que se conservan

`automation`, `settings` y `credits` siguen como rutas propias: son tablas y formularios de
configuración, no conversación. Se alcanzan desde el encabezado del chat.

Las nueve rutas de generación redirigen a `/portal/ai-studio?tool=<herramienta>` para no
romper enlaces existentes ni la memoria de los usuarios.

### Orden de trabajo

```text
inventario de módulos ya auditado
→ copia de la composición de `template-shadcn-superdashboard`
→ chat sobre `aiApi` existente, sin contrato nuevo
→ redirecciones de las rutas antiguas
→ retirada de las vistas sustituidas
```

No requiere contrato ni endpoints nuevos: `aiApi.createRequest`, `listRequests`,
`retryRequest` y `archiveRequest` ya cubren crear, listar, reintentar y archivar.

### Pendiente de decisión

Ninguno bloqueante. Si una capacidad no cabe con claridad en el panel de opciones, se
registra aquí antes de recortarla; no se elimina una acción por simplificar la interfaz.

### Estado de la consolidación

Implementado. `/portal/ai-studio` conserva conversaciones e hilo como dos áreas y mueve
las opciones al `Sheet` contextual del compositor. La navegación pasa de trece entradas a
cuatro: Chat, Automatizaciones, Ajustes AI y Créditos.

Las ocho herramientas de generación viven en el selector del compositor y conservan sus
opciones completas en el panel lateral: objetivo, tono, idioma, plataformas, variantes,
hashtags y llamada a la acción para contenido; proporción y calidad para imagen; proporción
y duración para video; plataformas destino para reutilizar; idioma y plataformas para
revisión; días, frecuencia, plataformas y fecha inicial para el planificador; zona horaria e
histórico para mejor horario; ámbito y número de resultados para investigación.

`ai-content`, `image`, `video`, `repurpose`, `review`, `planner`, `timing` y `search`
redirigen a `/portal/ai-studio?tool=<herramienta>`; `history` redirige a la raíz porque su
listado es ahora la columna de conversaciones.

`ai-studio-page.tsx` permanece porque Automatizaciones, Ajustes y Créditos siguen siendo sus
vistas. Sus vistas de generación quedan sin ruta que las alcance y se retirarán cuando esas
tres superficies se muevan a componentes propios.

### Migración a AI Elements — 24 de agosto de 2026

El hilo usa el registry oficial de Vercel AI Elements sobre la composición funcional del
template canónico. `Conversation` controla el scroll y su retorno al final; `Message`
separa usuario y asistente; `MessageActions` conserva copiar, reintentar y archivar;
`Reasoning` representa el trabajo en cola o proceso; `PromptInput` aporta el compositor y el
selector de las ocho herramientas. La traza 21st anterior se retiró.

Los componentes viven como código auditable en `apps/web/components/ai-elements` y reutilizan
los primitives de `packages/ui`; el registry no sobrescribió ninguno. El lienzo de generación
de imagen y video se conserva como renderer de dominio dentro de `MessageContent`, porque AI
Elements permite componer resultados propios y la API todavía no entrega un asset visible
mientras el trabajo está en curso.

La migración no añade una segunda frontera de datos: el chat sigue usando
`aiApi.listRequests`, `createRequest`, `getRequest`, `retryRequest` y `archiveRequest`, con
polling durable y autorización del Portal. No se habilita `useChat`, una ruta Next paralela,
AI Gateway ni secretos de proveedor en Web; adoptar streaming requerirá primero un contrato
Nest equivalente que mantenga créditos, jobs, ownership y resultados persistentes.

El medidor de contexto y las fuentes externas siguen fuera de alcance: la API no expone
consumo por conversación y la herramienta de investigación actual retorna coincidencias
internas, no citas externas. No se muestran datos simulados para llenar esos componentes.

La primera migración sustituyó el hilo y el compositor por primitives de AI Elements, pero
conservó completa la carcasa visual anterior y dejó el cambio prácticamente invisible. La
corrección posterior adopta también su composición de producto: conversación centrada,
sugerencias iniciales, compositor como acción principal y opciones contextuales. El
historial, las ocho herramientas, los ajustes por herramienta y las rutas operativas se
mantienen; solo se retira el panel lateral permanente que competía con el hilo.

Validación de la corrección: build y typecheck de Web correctos; lint focal de
AI Studio y AI Elements sin errores; auditorías de traducciones, texto hardcoded
y Portal/Admin UI sin hallazgos.

### Correcciones del chat — 24 de agosto de 2026

- Las sugerencias del estado vacío se distribuyen en varias filas dentro del
  ancho disponible; ninguna acción queda recortada fuera del lienzo.
- El encabezado conserva solo el acceso contextual a Ajustes. Automatizaciones
  permanece en la navegación de AI Studio y ya no duplica esa ruta en el chat.
- Ajustes, Planner y Mejor horario completan su metadata traducida en
  `aiStudio.views`, evitando que el encabezado muestre claves de traducción.
- Imagen y Video aceptan referencias JPG, PNG o WebP desde `PromptInput`, muestran
  los archivos seleccionados y permiten retirarlos antes del envío. Web importa
  cada referencia a Files mediante el flujo autenticado existente y envía sus
  IDs en `referenceAssetIds`; API y Worker conservan validación de tipo, tamaño,
  estado, workspace y límites de diez referencias para imagen o nueve para video.

Validación: build y typecheck de Web correctos; lint focal de AI Studio y
Suggestions sin errores; auditorías de traducciones, texto hardcoded y UI de
Portal/Admin sin hallazgos; `git diff --check` correcto.

En Automatizaciones, la creación se abre en el `Sheet` canónico del sistema. La
cabecera conserva título y descripción; los campos se desplazan dentro del panel
y `SheetActions` mantiene Cancelar y Guardar visibles al fondo. El panel no se
cierra durante la mutación y solo se descarta automáticamente después de una
creación confirmada por la API.

Validación del Sheet: build y typecheck de Web correctos; typecheck de UI
correcto; lint focal de AI Studio y `TimePicker` sin errores; auditorías de
traducciones, texto hardcoded y Portal/Admin UI sin hallazgos.

Corrección inicial del control horario: la fuente y V2 llegaron a mostrar un
`Select` único `HH:mm`, pero la lista de 96 combinaciones resultó impropia para
este campo. Se sustituyó por el `Input type="time"` del ejemplo oficial de
shadcn/ui, con precisión de un minuto y sin desplegable generado.

Validación del reemplazo: typecheck de UI y Web correctos; lint focal y
auditorías de UI, paridad i18n y texto hardcoded sin hallazgos. El check focal de
la fuente no presenta errores; su typecheck completo conserva únicamente dos
errores ajenos en gráficos legacy.

### Configuración obligatoria de marca — 24 de agosto de 2026

El workspace debe completar nombre, descripción y personalidad de marca antes
de iniciar una generación. `GET /v1/portal/ai/settings` expone
`brandConfigured` como fuente de verdad; el chat mantiene el historial en modo
lectura, bloquea compositor, referencias, opciones y reintentos, y dirige a
Ajustes mientras el valor sea falso.

La API aplica la misma condición antes de crear cualquier solicitud nueva, por
lo que omitir el bloqueo visual devuelve `AI_BRAND_CONFIGURATION_REQUIRED` sin
reservar créditos ni encolar trabajo. Un miembro sin permiso para administrar
el Brand Kit recibe en el bloqueo la indicación de acudir a un propietario o
administrador. La configuración continúa perteneciendo al workspace.

Los campos de Voz de marca incluyen ejemplos traducidos como placeholders para
nombre, personalidad, descripción, principios de voz y vocabulario preferido o
prohibido; no se guardan como valores. Esta decisión endurece de forma
intencional la referencia Laravel, que permite un Brand Kit vacío.

Validación: builds de Contracts, API y Web correctos; typechecks de los tres
correctos; lint focal sin errores; auditorías de traducciones, texto hardcoded y
UI de Portal/Admin sin hallazgos. Las tres suites de integración focales cargan
y compilan, pero sus doce pruebas quedan omitidas cuando no están definidas las
URLs de las bases locales de test.

### Rediseño hacia orquestación de agentes — 30 de agosto de 2026

Decisión de producto: AI Studio evoluciona de herramientas sueltas a una
orquestación de agentes definida en Admin. Cada agente tendrá prompt de
sistema, modelo, herramientas permitidas y estado propios; los flujos se
modelan como grafo (nodos y aristas) al estilo n8n y el Worker los ejecutará
nodo a nodo. Las herramientas `review`, `planner` y `repurpose` saldrán del
selector del Portal; el backend conserva sus kinds para el historial.

Además, las opciones por herramienta del chat dejaron el `Sheet` lateral y se
muestran inline dentro del `PromptInput` (selects compactos, dropdown con
checkboxes para plataformas, popovers para texto/número/fecha), con claves
`optionCount`/`optionValue` en el catálogo.

Fase 1 entregada como vista previa mock: componentes Workflow de AI Elements
vendorizados en `apps/web/components/ai-elements/` (`canvas`, `node`, `edge`,
`connection`, `controls`, `panel`, `toolbar`) sobre la dependencia nueva
`@xyflow/react`; ruta `Admin → AI → Agentes` (`/admin/ai-agents`) con
`AiAgentsCanvasPage` y fixtures deterministas (disparador de chat, orquestador
y agentes de contenido, media y publicación). El icono de agente reproduce el
de n8n como componente local `AiAgentIcon`. Sin contrato ni backend todavía.

El editor de agente abre desde el menú del nodo en un `Sheet` a pantalla
completa (patrón de Channels) con composición estilo n8n en tres columnas:
Entrada con el nodo conectado y empty state, panel central con pestañas
Parámetros (nombre, system prompt, variante de modelo 5.6 terra/sol/luna y
herramientas) y Ajustes (descripción), ranuras inferiores de modelo de
chat/memoria/herramientas, y Salida con empty state y acción Ejecutar paso
deshabilitada en el mock. Editar nombre, prompt, modelo o descripción actualiza
el nodo del canvas en vivo sobre el estado local.

Arquitectura decidida para la ejecución: orquestación con function calling de
OpenAI. Cada agente es system prompt + modelo + tools propios; los subagentes
se exponen al orquestador como tools, y las aristas orquestador→subagente del
grafo se compilan a esa lista de tools. Proveedor inicial: solo OpenAI, modelo
5.6 con variantes terra, sol y luna.

Fase 2 iniciada — 30 de agosto de 2026. Migración `0052_yummy_shadow_king`
aplicada en local y remota con historial Drizzle idéntico: tablas nuevas
`ai_agents` (nombre único, prompt de sistema, kind orquestador/especialista con
unicidad parcial del orquestador, FK opcional a `ai_models`, tools jsonb,
posición de canvas) y `ai_agent_edges` (aristas del grafo, sin self-loops), con
seed de los cuatro agentes por defecto y sus aristas. Proveedores nuevos
sembrados en `provider_integrations`: `deepseek`, `qwen` y `anthropic`, solo
capacidad de texto, deshabilitados hasta configurar credenciales. Catálogo
`ai_models` ampliado con los modelos vigentes según documentación oficial:
DeepSeek V4 Pro/Flash, Qwen3.8 Max/Flash y Claude Opus 5 / Sonnet 5 / Haiku
4.5, todos con tool calling.

Adaptación de llamadas: el contrato `adminAiProviderKeySchema` acepta las cinco
claves; la verificación de credenciales en Admin usa el catálogo de modelos de
cada proveedor (DeepSeek y Qwen por endpoint OpenAI-compatible, Anthropic por
`/v1/models` con `x-api-key` y `anthropic-version`); las rutas de texto admiten
cualquier proveedor de texto y las de media siguen exclusivas de AtlasCloud.
El Worker enruta la generación de texto por proveedor: OpenAI conserva
`/v1/responses`, DeepSeek y Qwen usan `chat/completions` OpenAI-compatible y
Anthropic usa la Messages API, con parsing de uso y manejo de `refusal`
propios. El cifrado de claves usa AAD `ai:<provider>` por proveedor.

Validación fase 2: migración probada con dry-run transaccional en remota antes
de aplicar; conteos verificados en ambas bases (4 agentes, 3 aristas, 7 modelos
nuevos); typecheck, build y lint del monorepo correctos; suites de API (103
pruebas) y Worker (39) en verde; auditorías i18n sin hallazgos.

Fase 2 y fase 3 completadas — 30 de agosto de 2026.

CRUD de agentes: contratos `adminAiAgentSchema`/`adminAiAgentEdgeSchema` y
`updateAdminAiAgentSchema` en `packages/contracts`; endpoints
`GET /v1/admin/ai/agents` y `PATCH /v1/admin/ai/agents/:id` con
`requirePlatformAdmin`, validación de modelo de texto habilitado y auditoría
`admin.ai_agent_updated`. El canvas de Admin dejó los fixtures: carga agentes,
aristas y modelos reales, arrastra nodos persistiendo la posición, y el editor
guarda nombre, system prompt, modelo, descripción y estado activo por PATCH,
con estados de carga, error y toasts. El nodo disparador del chat sigue siendo
sintético.

Retiro de herramientas: `repurpose`, `review` y `planner` salieron del selector
del Portal y la API rechaza requests nuevos de esos kinds; el historial se
conserva y los kinds persisten en contratos y schema.

Orquestación (fase 3): kind nuevo `agent` en contratos (input vacío, resultado
`{summary, trace[]}`), costo por defecto de 3 créditos, migración
`0053_busy_morbius` (constraints de kind ampliadas y ruta `agent` sembrada)
aplicada en local y remota con historial idéntico. La herramienta «Asistente»
es ahora la opción por defecto del chat del Portal. El Worker ejecuta el bucle
de function calling: carga el orquestador habilitado, expone las aristas
orquestador→especialista como tools (slug del nombre, parámetro `order`),
adapta el formato por familia de proveedor (chat/completions OpenAI-compatible
para OpenAI/DeepSeek/Qwen y Messages API con `tool_use`/`tool_result` para
Anthropic), ejecuta cada especialista con su propio system prompt, modelo y
proveedor, acumula tokens y costo por modelo, y devuelve resumen más traza
(máximo 6 iteraciones). Divergencia registrada: los especialistas aún no
ejecutan sus herramientas internas (`save_caption`, `generate_image`, …);
responden con texto y sus tools son descriptivas hasta la siguiente fase.

Validación del cierre: typecheck, build y lint del monorepo en verde; suites de
API (103) y Worker (39) en verde; auditorías de paridad i18n, texto hardcoded y
UI de Portal/Admin sin hallazgos; migración 0053 con dry-run transaccional en
remota antes de aplicar y conteos verificados en ambas bases. La aprobación
visual del canvas, el editor y la herramienta Asistente corresponde al usuario;
el bucle real con proveedores exige credenciales `ready` en Admin.

### Retiro de la pestaña Rutas — 30 de agosto de 2026

Decisión de producto: la edición de enrutamiento sale de Admin → Configuración
AI para migrar hacia la superficie visual de Agentes. La página conserva solo
Proveedor, Modelos y Uso; se eliminó la tabla de rutas, sus filtros y su sheet
de edición, y la descripción de la ruta declara que el enrutamiento se
administra en el canvas de Agentes.

Alcance acotado: `ai_model_routes` sigue vigente en base, API y Worker porque
los kinds `content`, `image`, `video` y `ai_publishing` resuelven su modelo por
ruta; sin interfaz, esos valores quedan congelados como están y solo pueden
cambiarse por datos. Pendiente de la siguiente iteración: representar las
herramientas y su modelo como nodos conectables del canvas para reemplazar por
completo el enrutamiento por tabla.

Corrección técnica del mismo cierre: `tsconfig.json` de API y Worker declaraba
`rootDir: ./src` incluyendo `test/`, un fallo latente enmascarado por caches
incrementales; `rootDir` vive ahora en `tsconfig.build.json` (el que usa
`nest build`), se limpiaron los `tsbuildinfo` obsoletos y se verificó que ambos
servicios siguen emitiendo `dist/main.js` en la misma ruta, sin cambio de
layout para las imágenes de despliegue.

Validación: typecheck, lint y build del monorepo en verde; `nest build` real de
API y Worker con `dist/main.js` verificado; paridad i18n (4710 claves) y
auditoría de UI sin hallazgos.

Validación: build y typecheck del monorepo correctos; auditorías de paridad
i18n, texto hardcoded y UI de Portal/Admin sin hallazgos.
