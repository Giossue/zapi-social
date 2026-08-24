# Instalación del comprador V2

## Estado

**Fase 1 cerrada el 24 de agosto de 2026.** El paquete incluye Compose,
plantilla de entorno y guías inglesas de instalación y actualización. La guía
se ejecutó desde cero con Compose v2 sobre un motor compatible: migraciones,
healthchecks, bootstrap, login y render autenticado de Admin y Portal pasaron.
Bloque 4 de [`mvp-codecanyon-v2.md`](./mvp-codecanyon-v2.md): definir el
paquete que un comprador de CodeCanyon instala y actualiza sin ayuda. Hoy la
única documentación de despliegue es la nuestra
([`conocimiento/deployment/dokploy.md`](../conocimiento/deployment/dokploy.md)),
escrita para nuestra infraestructura, no para un comprador.

## Cómo lo hace ZapiSocial (hechos observados)

- **Instalador web** en `/installer` (`app/Installer/`): wizard de 3 pasos —
  requisitos (PHP ≥ 8.3, extensiones, permisos de escritura), configuración
  (escribe el `.env`, exige base de datos **vacía**, corre `migrate --force` y
  seeders) y cierre (crea el primer admin con su team personal, asigna un plan
  vitalicio y marca `installer_completed_at`). Un middleware global redirige
  todo al instalador hasta terminar, con rollback del `.env` si algo falla.
- **Purchase code**: el instalador **no** lo pide ni lo valida. Solo el
  marketplace de módulos post-instalación verifica códigos, y lo hace con SSL
  desactivado (`verify => false`) — un defecto, no un modelo.
- **Documentación**: no incluye ninguna (ni `docs/` ni `README`).
- **Actualizaciones**: no hay ruta de update ni versionado de la app; una sola
  migración monolítica, sin migraciones incrementales. Solo auto-update de
  paquetes comprados del marketplace.
- **Seeders**: planes de ejemplo (`ZapiSocialPlanSeeder`), categorías y
  plantillas de AI. Modo demo global (`APP_DEMO`) con middleware que bloquea
  escrituras.

## Qué se conserva y qué se corrige

**Se conserva**: la experiencia de tres pasos (requisitos → configuración →
primer admin), los seeders de planes y plantillas AI, y el modo demo para la
página de venta.

**Se corrige**: V2 **sí** entrega documentación de instalación y
actualización, **sí** versiona (migraciones Drizzle incrementales, que ya
existen: 0000–0046), y no copia la verificación de purchase code con SSL
desactivado — la verificación de licencia queda fuera del MVP, como en el
instalador de la referencia.

**Divergencia estructural**: un contenedor no puede escribirse su `.env` como
hace Laravel en hosting compartido. La configuración vive en el
`docker-compose.yml`/`.env` del comprador (paso documentado), y el wizard
web solo hace lo que sí es dato: crear el primer administrador y las opciones
iniciales.

## Diseño V2

### El paquete

```text
docker-compose.yml   # postgres, redis, migrate, api, worker, web
.env.example         # cada variable documentada, secretos a generar
docs/installation.md # guía inglesa paso a paso
docs/updating.md      # actualización, backup, verificación y rollback
```

- Las imágenes ya existen (`Dockerfile.api|web|worker`, validadas con podman
  en cada cierre); el compose las orquesta con las variables que
  `validateEnv` de API y Worker ya exigen al arrancar.
- Las migraciones se aplican con un servicio one-shot del compose
  (`db:migrate` de `packages/database`) antes de levantar API y Worker: el
  arranque nunca corre con schema viejo.

### Primer arranque (setup wizard)

- La API expone `GET /v1/setup/status` (público: `{ needsSetup }`, verdadero
  mientras no exista ningún `isPlatformAdmin`).
- Con `needsSetup`, la web redirige todo a `/setup`: un formulario que crea el
  primer administrador (`POST /v1/setup`, válido una sola vez, idempotente y
  auditado) y siembra planes de ejemplo y plantillas AI si la base está vacía.
- Sin instalador de requisitos: los healthchecks del compose y la validación
  de entorno al arrancar cumplen ese papel y fallan con mensajes claros.

### Actualizaciones

- Versión visible en Admin → Settings (la que ya reporta
  `system-information.controller`).
- `docs/actualizacion.md`: `docker compose pull && docker compose up -d`; el
  servicio de migraciones aplica lo pendiente. El historial Drizzle es la
  fuente de verdad, igual que en
  [`reglas/workflow.md`](../reglas/workflow.md).

### Demo para la página de venta

- `DEMO_MODE=true`: la API rechaza mutaciones destructivas con un código
  estable (`DEMO_MODE_READONLY`) y la web muestra el aviso. Seeders de datos
  demo (usuarios, posts, tablero) solo para esta modalidad.

## Fuera de alcance

- Verificación de purchase code de Envato (ZapiSocial tampoco la hace al
  instalar; se decide si algún día compensa).
- Instalación sin Docker (hosting compartido); se documenta como no soportada.
- Auto-update desde el panel.

## Fases

### Fase 1 — Compose y guía

- [x] `docker-compose.yml` con servicios persistentes, healthchecks y servicio
      one-shot de migraciones.
- [x] `.env.example` documentado variable a variable, sin valores reales.
- [x] `docs/installation.md` y `docs/updating.md` probados desde una base vacía,
      incluidos bootstrap, autenticación, salud y apagado limpio.

### Fase 2 — Setup wizard

- [ ] `GET /v1/setup/status` y `POST /v1/setup` (una sola vez, auditado).
- [ ] Pantalla `/setup` y redirección mientras `needsSetup`.
- [ ] Seeders de planes y plantillas AI.

### Fase 3 — Demo

- [ ] `DEMO_MODE` con bloqueo de mutaciones y aviso en la interfaz.
- [ ] Datos demo sembrables para la página de venta.
