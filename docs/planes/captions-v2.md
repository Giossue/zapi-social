# Plan — Captions V2

## Objetivo

Migrar `AppCaptions` Laravel a una biblioteca de captions reutilizables por workspace. El primer vertical permite crear, buscar, filtrar, editar, archivar y eliminar textos; no publica contenido ni genera AI dentro de este módulo.

## Referencia Laravel auditada

```text
Ruta: GET /portal/captions
Módulo: AppCaptions
Livewire: CaptionWorkspace
Tabla legacy: publishing_captions
Permiso de plan: captions
```

Laravel almacena: nombre, slug, origen (`manual`/`ai`), estado (`active`/`draft`/`archived`), contenido, notas y tags. Busca por nombre/contenido/notas, calcula métricas y scopea items por propietario/workspace. AI puede anotar un caption, pero esa integración queda fuera del primer vertical V2.

## Alcance V2

```text
Ruta Web: /portal/captions
GET    /v1/portal/captions
POST   /v1/portal/captions
PATCH  /v1/portal/captions/:id
DELETE /v1/portal/captions/:id
```

- Métricas: total, AI, manual y activos.
- Filtros: búsqueda, origen y estado.
- Formulario: nombre, contenido, notas, tags, origen y estado.
- Ownership estricto por workspace; ID de otro workspace responde 404.
- Datos sintéticos en fixture/mock antes de API.
- Estados normal, loading, empty, error, permisos, móvil y claro/oscuro.

## Fuera de alcance

- Generar captions con AI.
- Publicar un caption directamente.
- Conectar caption a calendario/campañas.
- Tags globales o colaboración granular por miembro.
- Validación real de plan `captions`: Planes aún no expone permisos de Portal; se conserva punto de integración sin simular bloqueo.

## Modelo V2 propuesto

```text
captions
  id uuid
  workspace_id FK
  created_by_user_id FK
  name varchar(120)
  slug varchar(140)
  source_type manual | ai
  status active | draft | archived
  content varchar(10000)
  notes varchar(2000) nullable
  tags jsonb
  created_at / updated_at

unique(workspace_id, slug)
index(workspace_id, status)
index(workspace_id, source_type)
```

## Contrato propuesto

```ts
type Caption = {
  id: string
  name: string
  sourceType: "manual" | "ai"
  status: "active" | "draft" | "archived"
  content: string
  notes: string | null
  tags: string[]
  updatedAt: string
}
```

- `name`: 1–120.
- `content`: 1–10.000.
- `notes`: hasta 2.000.
- Tags normalizados: trim, únicos case-insensitive, máximo 20, 64 caracteres cada uno.
- Slug se calcula servidor y solo es único dentro de workspace.

## Secuencia

1. [x] Crear feature con fixture, mock y pantalla `/portal/captions`.
2. [x] Aprobar UI y estados.
3. [x] Añadir schema/migración, contratos y API client.
4. [x] Implementar API con ownership/auditoría.
5. [x] Sustituir mock por REST sin reescribir composición.
6. [ ] Validar build y smoke manual autenticado; la evidencia source-first y typecheck focal consta abajo. La migración aditiva `0009_adorable_caretaker.sql` se aplicó y verificó en PostgreSQL remoto el 2026-08-02 (`captions`, 5 índices, 2 FK); se aplicó también en PostgreSQL local el 2026-08-03 y se verificó con `pkexec`: tabla `captions`, 5 índices y 2 FK. Queda pendiente únicamente el smoke autenticado de la ruta Portal.

## Reemplazo visual source-first — 2026-08-03

- La fuente visual canónica se reestructuró primero en `template-shadcn-superdashboard/src/app/(main)/dashboard/captions/_components/caption-library.tsx` junto con `caption-types.ts`, tomando como base literal la densidad tabular de `dashboard/users` que alimenta Channels.
- `apps/web/features/captions/components/captions-library-page.tsx` copia el
  inventario tabular: card operativo, búsqueda, filtros compactos, filas
  Caption/Origen/Estado/Etiquetas/Actualizado/Acciones y dropdown. Usa los
  controles canónicos de tabla y el único `TablePagination`, con páginas
  locales de diez filas; conserva `captionsApi.list/create/update/remove`,
  filtros locales, loading, empty inicial/filtrado, error, 403 y CRUD.
- El selector de estados de demo queda excluido de V2: los estados visibles proceden exclusivamente de la respuesta REST y de los datos locales ya cargados. Se retiraron las metric cards y el grid de captions rechazados; el conteo queda integrado en la barra de filtros.
- Ante `ApiError` con `code === "AUTH_SESSION_EXPIRED"` en carga o mutaciones, la ruta ejecuta `useRouter().replace("/login")`; no muestra un error técnico ni el error genérico de la biblioteca.
- `updatedAt` ISO se presenta como fecha legible. Los fallos de guardado permanecen visibles en el formulario; los toasts son feedback secundario.
- El estado de carga/permiso/error se presenta como `Card` + empty state, igual que Channels. El empty real y el empty filtrado se inyectan dentro de la tabla; nunca sustituyen un fallo REST. La divergencia necesaria es el botón de acciones: la fuente usa `ghost` y V2 usa `brand-secondary` porque producto prohíbe `ghost`. No se añadieron tokens, variantes ni aliases. Los badges conservan activo en verde y los demás estados/orígenes/etiquetas en gris con `leading-none`.

### Evidencia de validación

- [x] `bun --filter web typecheck` — correcto el 2026-08-03.
- [x] `bun --filter web build` — build Next correcto el 2026-08-03.
- [x] `bun --filter web lint -- features/captions/components/captions-library-page.tsx` — sin errores; conserva un warning `react-hooks/incompatible-library` de TanStack Table, idéntico al existente en `features/channels/components/channel-table/channels-users.tsx`.
- [x] `git diff --check` — sin errores de whitespace tras el refactor tabular.
- [x] `TablePagination` — footer estándar compartido con Channels, validado en `template-shadcn-superdashboard` (`npm run check` / `npm run build`) y V2 (`@workspace/ui` y Web typecheck/build).
- [ ] Smoke manual de navegador — no ejecutado en esta iteración.

## Criterio de cierre

Un usuario Portal puede gestionar su biblioteca de captions del workspace actual, sin ver ni modificar captions de otros workspaces. La API conserva métricas y la UI tiene inventario tabular, filtros, empty/error y CRUD real. AI/publishing/planes permanecen documentados como módulos posteriores.
