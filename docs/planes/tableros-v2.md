# Tableros (kanban) V2

## Estado

**Abierto el 23 de agosto de 2026.** Funcionalidad nueva: no existe en
ZapiSocial, así que no hay equivalencia Laravel que auditar. La referencia
visual es
`../template-shadcn-superdashboard/src/app/(main)/dashboard/kanban/`.

## Qué trae la plantilla y qué le falta

La plantilla aporta la composición y el arrastre, no el producto:

- Cinco columnas fijas de desarrollo de software —`ideas`, `planned`,
  `building`, `qa`, `shipped`— escritas a mano en `data.ts`.
- Arrastre de tarjetas entre columnas y de columnas entre sí con
  `@dnd-kit/react`, `@dnd-kit/helpers` y `@dnd-kit/abstract`. **V2 no tiene esa
  dependencia todavía.**
- Tarjeta con título, descripción, prioridad, responsable, fecha límite,
  progreso, etiqueta de equipo y contadores de adjuntos, comentarios y
  documentos.
- Cero persistencia: el estado vive en `useState` y se pierde al recargar. La
  barra superior —buscar, filtrar, ordenar, importar CSV, plantilla,
  automatización— no está conectada a nada.

Se copia la composición y se adaptan datos, rutas, handlers y permisos, como
manda [`reglas/design.md`](../reglas/design.md). Las columnas fijas de software
no se copian: en V2 las define cada espacio de trabajo.

## Decisiones

Tres decisiones del usuario acotan el alcance:

1. **Dos tableros separados.** Uno de tareas del equipo, con columnas
   configurables, y otro de contenido, que es una vista de `publishing_posts`
   agrupada por estado.
2. **Los avisos salen por la campana del Portal y por correo** al responsable.
3. **El acceso se decide por permiso explícito** en
   `workspace_memberships.permissions`.

La tercera arrastra trabajo que no es del tablero: esa columna existe en el
esquema desde el principio y **hoy no la lee ni la escribe nadie**. Hay que
darle catálogo, comprobación en la API y pantalla en Teams antes de que el
tablero pueda apoyarse en ella.

## Tablero de tareas

### Tablas nuevas

Todas llevan `workspace_id` y su `unique(id, workspace_id)` para que las hijas
puedan usar clave foránea compuesta, que es como el repositorio impide que una
fila apunte a otra de un espacio de trabajo distinto.

#### `board_columns`

Las columnas del tablero. Configurables por espacio, no fijas.

| Columna         | Tipo           | Notas                                                        |
| --------------- | -------------- | ------------------------------------------------------------ |
| `id`            | `uuid`         | PK                                                           |
| `workspace_id`  | `uuid`         | `on delete cascade`                                          |
| `name`          | `varchar(60)`  | Texto libre del usuario; no se traduce                       |
| `position`      | `integer`      | Orden en el tablero                                          |
| `color`         | `varchar(7)`   | `#rrggbb`, mismo `check` que `account_groups`                |
| `is_terminal`   | `boolean`      | Marca la columna de «hecho»: al entrar se sella `completed_at` |
| `wip_limit`     | `integer` nulo | Aviso visual al pasarse; no bloquea                          |

Índices: `unique(workspace_id, position)` diferible, `unique(id, workspace_id)`.

Un espacio sin columnas recibe tres al abrir el tablero por primera vez —
«Por hacer», «En curso», «Hecho»—, creadas con el idioma activo de quien abre.
Son datos del usuario desde ese momento: si las renombra, no vuelven a
cambiar.

#### `board_tasks`

| Columna               | Tipo             | Notas                                              |
| --------------------- | ---------------- | -------------------------------------------------- |
| `id`                  | `uuid`           | PK                                                 |
| `workspace_id`        | `uuid`           | `on delete cascade`                                |
| `column_id`           | `uuid`           | FK compuesta a `(board_columns.id, workspace_id)`  |
| `created_by_user_id`  | `uuid`           | `on delete restrict`                               |
| `assignee_user_id`    | `uuid` nulo      | `on delete set null`                               |
| `title`               | `varchar(200)`   |                                                    |
| `description`         | `text`           | Por defecto `''`                                   |
| `priority`            | `varchar(8)`     | `low` / `medium` / `high`, con `check`             |
| `due_date`            | `date` nulo      |                                                    |
| `progress`            | `smallint`       | 0–100, con `check`                                 |
| `position`            | `integer`        | Orden dentro de su columna                         |
| `completed_at`        | `timestamptz` nulo | Se sella al entrar en una columna terminal       |
| `archived_at`         | `timestamptz` nulo | Archivar no borra                                |
| `publishing_post_id`  | `uuid` nulo      | FK compuesta a `(publishing_posts.id, workspace_id)`, `on delete set null` |

Índices: `unique(id, workspace_id)`, `(workspace_id, column_id, position)`,
`(workspace_id, assignee_user_id, due_date)` para «asignadas a mí» y para el
barrido de vencimientos.

`position` es entero y se **renumera la columna entera dentro de la
transacción** al mover. Un tablero tiene decenas de tarjetas, no millones:
renumerar es más barato que arrastrar la deuda de posiciones fraccionarias que
se degradan tras muchos movimientos.

`publishing_post_id` es el enlace opcional con el tablero de contenido: una
tarea puede apuntar a una publicación, pero no la necesita.

#### `board_labels` y `board_task_labels`

La etiqueta «Backend», «Design» de la plantilla, generalizada. `board_labels`
guarda `workspace_id`, `name` y `color`, con `unique(workspace_id, name)`.
`board_task_labels` es la tabla puente con PK compuesta `(task_id, label_id)` y
FK compuestas por espacio de trabajo.

#### `board_task_comments`

Mismo patrón que `support_ticket_comments`: `task_id` + `workspace_id` con FK
compuesta, `author_user_id`, `body` y marcas de tiempo. Índice
`(task_id, created_at)`.

#### `board_task_attachments`

Puente a `file_assets`, no copia de archivos: `task_id` + `workspace_id`,
`file_asset_id` + `workspace_id` con FK compuestas, `created_by_user_id` y
`unique(task_id, file_asset_id)`. Los contadores de la tarjeta salen de aquí y
de `board_task_comments`; no se guardan denormalizados.

### Lo que no se crea

- **Tabla de progreso o historial de movimientos.** El movimiento ya queda en
  `api_audit_logs`, que es donde el repositorio registra las acciones.
- **Contador de comentarios y adjuntos en `board_tasks`.** Un `count` agregado
  en la consulta del tablero evita mantener dos fuentes de verdad.
- **Tabla de plantillas de tarea.** El menú «Add from template» de la plantilla
  visual queda fuera de alcance; el botón no se copia.

## Tablero de contenido

No lleva tablas nuevas. Es una vista de `publishing_posts` agrupada por
`status`, con las columnas fijas que ya define el dominio: `draft`,
`scheduled`, `processing`, `published`, `failed`.

Arrastrar cambia el estado solo donde el dominio lo permite:

| Origen      | Destinos válidos       | Motivo                                                   |
| ----------- | ---------------------- | -------------------------------------------------------- |
| `draft`     | `scheduled`            | Exige que la publicación tenga fecha y cuenta            |
| `scheduled` | `draft`                | Desprogramar antes de que el worker la tome              |
| resto       | ninguno                | `processing`, `published` y `failed` los decide el worker |

Las columnas no reordenables y las tarjetas de las tres últimas columnas no
arrastrables. Un intento inválido se rechaza en la API, no solo en la interfaz.

## Permisos

`workspace_memberships.permissions` es un `jsonb` de cadenas que hoy está
vacío en todas las filas y no se lee en ninguna parte. Se le da uso:

- Catálogo en `packages/contracts`: `workspacePermissionSchema`, con
  `boards.view`, `boards.manage_tasks`, `boards.manage_columns` y
  `boards.delete_tasks` como primeras entradas.
- `owner` y `admin` los tienen todos de forma implícita: el permiso solo se
  consulta para `member`. Así una membresía nueva no queda sin acceso y no hay
  que migrar las filas existentes.
- La comprobación vive en la API, junto al resto de ownership, nunca en la
  interfaz. La interfaz solo decide qué enseña.
- Pantalla: la hoja de acceso de miembro de Teams gana un bloque de permisos
  por módulo, con la misma composición que ya usa Plans para sus permisos.

## Avisos

### Campana del Portal

La campana lee hoy `platform_announcements`, que es la tabla de anuncios que
escribe Admin. Una notificación de tablero no cabe ahí: la escribe el sistema,
pertenece a un espacio de trabajo y **no puede guardar prosa**, porque la API no
traduce.

Tabla nueva `workspace_notifications`:

| Columna        | Tipo               | Notas                                            |
| -------------- | ------------------ | ------------------------------------------------ |
| `id`           | `uuid`             | PK                                               |
| `workspace_id` | `uuid`             | `on delete cascade`                              |
| `user_id`      | `uuid`             | Destinatario, `on delete cascade`                |
| `kind`         | `varchar(64)`      | Clave de traducción: `board.task_assigned`, …    |
| `payload`      | `jsonb`            | Argumentos ICU del mensaje: título, actor        |
| `url`          | `varchar(2048)` nulo | Enlace a la tarjeta                            |
| `read_at`      | `timestamptz` nulo |                                                  |
| `archived_at`  | `timestamptz` nulo |                                                  |

Índice `(user_id, archived_at, created_at)`.

El feed de la campana pasa a ser la unión de las dos fuentes, ordenada por
fecha. Eso obliga a convertir `portalNotificationSchema` en una unión
discriminada: un anuncio trae `title` y `body` ya escritos; una notificación de
espacio trae `kind` y `payload`, y el texto lo pone la interfaz con
`t(\`notifications.kind.${kind}\`, payload)`.

Tipos de aviso en esta tanda:

- `board.task_assigned` — a quien recibe la tarea, salvo si se la asigna a sí
  mismo.
- `board.task_commented` — al responsable y a quienes ya comentaron, salvo al
  autor.
- `board.task_due_soon` — al responsable, un día antes del vencimiento.

### Correo

Solo `board.task_assigned` y `board.task_due_soon` salen también por correo:
avisar por correo de cada comentario es ruido. Se añaden dos claves al catálogo
de `apps/api/src/email/email-template-catalog.ts`, con su juego de textos por
idioma, editables desde Admin como el resto. El idioma sale de `users.locale`
del destinatario.

El vencimiento lo dispara un job diario del worker, no la API: es trabajo
programado y su estado de negocio vive en `board_tasks.due_date`, no en el job.

## Fases

### Fase 1 — Permisos de membresía · terminada

- [x] Catálogo `workspacePermissionSchema` en contratos, agrupado por módulo.
- [x] `WorkspacePermissionsService` en la API, con `owner` y `admin`
      implícitos y código público `WORKSPACE_PERMISSION_DENIED`.
- [x] Bloque de permisos en la hoja de acceso de miembro de Teams.
- [x] Prueba de integración de equipos ampliada.

Dos matices que aparecieron al construirlo:

- **El contrato rechaza un permiso desconocido; no lo descarta.** Quien llama
  recibe `VALIDATION_FAILED` en vez de un guardado a medias. El saneador sigue
  haciendo falta, pero para **leer**: un permiso retirado del catálogo deja de
  contar sin migrar las filas que aún lo guarden.
- **Subir a `admin` vacía la lista.** Guardar permisos a quien ya los tiene
  todos crearía una segunda fuente de verdad que se desincroniza al cambiar el
  catálogo.

### Fase 2 — Datos y contrato del tablero de tareas

- [ ] Tablas nuevas y migración Drizzle.
- [ ] Contratos Zod de columnas, tareas, etiquetas, comentarios y adjuntos.
- [ ] Módulo Nest con listado, creación, edición, movimiento y archivado.
- [ ] Cliente REST tipado.

### Fase 3 — Tablero de tareas en el Portal

- [ ] Instalar `@dnd-kit/react` y sus dos paquetes hermanos.
- [ ] Copiar la composición de la plantilla y conectar datos reales.
- [ ] Hoja de detalle de tarea: descripción, comentarios, adjuntos, etiquetas.
- [ ] Entrada en la navegación y textos en `messages/`.

### Fase 4 — Avisos

- [ ] `workspace_notifications` y unión discriminada del feed de la campana.
- [ ] Dos plantillas de correo nuevas.
- [ ] Job diario de vencimientos en el worker.

### Fase 5 — Tablero de contenido

- [ ] Endpoint de tablero sobre `publishing_posts`.
- [ ] Transiciones válidas comprobadas en la API.
- [ ] Vista de tablero en Publishing, reutilizando los componentes de la fase 3.

## Riesgos

- **El arrastre y el orden son la parte frágil.** Dos personas moviendo la
  misma tarjeta a la vez pueden dejar posiciones incoherentes. La renumeración
  va dentro de la transacción y el movimiento envía la columna y el índice
  destino, no un delta.
- **La unión del feed de la campana toca una superficie ya cerrada.** Cambiar
  `portalNotificationSchema` afecta a la campana del Portal, que hoy funciona.
  La fase 4 no se cierra sin repasarla en los dos idiomas.
- **Los permisos son una frontera de seguridad.** Se comprueban en la API en
  cada endpoint del tablero; que la interfaz esconda un botón no es la
  comprobación. Ver [`reglas/seguridad.md`](../reglas/seguridad.md).

## Fuera de alcance

- Importar tareas desde CSV, plantillas de tarea y creación de automatizaciones
  desde el tablero: son tres botones del menú de la plantilla visual que no
  tienen dominio detrás en V2.
- Vistas de lista y tabla del mismo tablero. La plantilla las anuncia con
  pestañas pero no las implementa; se dejan para cuando el tablero tenga uso
  real.
- Subtareas, dependencias entre tarjetas y seguimiento de tiempo.
