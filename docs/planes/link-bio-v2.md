# Link in bio V2

## Objetivo

Portar el addon Laravel `AppLinkBio` (SmartBio v1.0) a ZapiV2 de forma nativa: páginas
públicas de enlaces por workspace, con constructor de bloques, plantillas visuales y
métricas de vistas y clics.

## Auditoría Laravel — hechos observados

Fuente: `../SmartBio v1.0 Addon/AppLinkBio`. 23 archivos, cuatro migraciones.

### Datos

`link_bio_pages`: propietario, equipo, título, `slug` único, titular, descripción, color de
acento, avatar, portada, `template_key`, estado, publicada, `blocks` y `settings` en JSON.

`link_bio_events`: página, tipo (`view` o `click`), índice de bloque e ítem, URL, hash de IP
y user agent. Índices por página y tipo, y por página, bloque e ítem.

### Bloques

Nueve tipos: `links`, `video`, `social`, `header`, `contact`, `gallery`, `embed`, `faq` y
`product`. Cada bloque tiene título, subtítulo, contenido, URL, etiqueta y URL de botón, y
un interruptor de activo. Seis de ellos (`links`, `social`, `contact`, `gallery`, `faq`,
`product`) admiten ítems con etiqueta, URL, nota, icono, imagen, valor, precio, marcador de
posición, respuesta y tipo de campo.

### Ajustes por página

`branding_text`, `avatar_style`, `button_style`, `content_align`, `background_image`,
`background_overlay` (0–85), `background_position` (`top`/`center`/`bottom`) y
`background_fit` (`cover`/`contain`/`pattern`).

### Plantillas

34 plantillas en `LinkBioTemplateCatalog`, cada una con clave, etiqueta, descripción,
categoría, degradado de vista previa y un tema de diez colores.

### Rutas

```text
portal/link-bio            listado
portal/link-bio/create     alta
portal/link-bio/templates  galería de plantillas
portal/link-bio/{id}/edit  edición
admin/settings/link-bio    ajustes de plataforma
b/{slug}                   página pública
b/{slug}/click/{b}/{i}     redirección con registro de clic
```

### Permisos

`canUsePlanFeature('link_bio')` habilita el módulo; `planLimit('max_link_bio_pages')` limita
cuántas páginas puede tener el workspace, con `-1` como ilimitado y `1` por defecto.

## Divergencias V2 confirmadas

- **Ownership por workspace, no por usuario.** Laravel guarda `owner_user_id` y un
  `team_id` opcional. V2 usa `workspace_id` como todo el resto del producto.
- **Las 34 plantillas no se portan como filas de datos.** Su tema es una paleta de colores
  crudos; V2 expone un conjunto reducido construido con tokens del sistema, porque una
  plantilla con `#0f172a` incrustado no respeta claro/oscuro.
- **El hash de IP se conserva**, pero el user agent se guarda recortado y solo para
  distinguir tráfico, nunca para perfilar.
- **Sin ajustes de plataforma en esta fase.** El addon expone `admin/settings/link-bio`; en
  V2 el módulo se habilita por plan, que ya es el mecanismo existente.

## Superficies V2

```text
/portal/link-bio            listado con métricas de vistas, clics y CTR
/portal/link-bio/{id}       constructor: bloques, apariencia y vista previa
/b/{slug}                   página pública renderizada por Next
```

## Orden de trabajo

```text
Laravel auditado
→ tablas Drizzle y contrato Zod
→ REST en Nest con ownership por workspace
→ constructor en Portal
→ página pública y registro de eventos
```

## Pendiente

- Importar páginas existentes desde Laravel: fuera de alcance hasta decidir si hay datos que
  migrar.
- Editor visual de arrastrar y soltar para reordenar bloques: la primera versión reordena
  con botones, que es lo que hace el original.

## Estado

Implementado. Migración `0034_third_black_widow` aplicada en local y remoto: `link_bio_pages`
y `link_bio_events`.

- `/portal/link-bio` lista páginas con vistas, clics y conversión, y abre el constructor en
  `Sheet` a pantalla completa con los nueve tipos de bloque, reordenamiento y apariencia.
- `/b/{slug}` renderiza la página publicada y registra la visita al montar; cada clic se
  registra antes de abrir el destino.
- `POST /v1/public/link-bio/{slug}/events` es la única superficie sin sesión y solo acepta
  páginas publicadas.

Ownership por workspace en cada consulta; crear, editar y borrar exigen rol `owner` o
`admin`. El avatar y la portada se validan contra `file_assets` del mismo workspace antes de
guardarse.
