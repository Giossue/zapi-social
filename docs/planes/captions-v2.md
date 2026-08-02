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
2. [ ] Aprobar UI y estados.
3. [ ] Añadir schema/migración, contratos y API client.
4. [ ] Implementar API con ownership/auditoría.
5. [ ] Sustituir mock por REST sin reescribir composición.
6. [ ] Validar tests, typecheck, build y migración autorizada.

## Criterio de cierre

Un usuario Portal puede gestionar su biblioteca de captions del workspace actual, sin ver ni modificar captions de otros workspaces. La UI tiene métricas, filtros, empty/error y CRUD real. AI/publishing/planes permanecen documentados como módulos posteriores.
