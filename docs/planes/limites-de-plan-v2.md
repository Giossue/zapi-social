# Límites de plan V2

## Estado

**Fases 1–4 implementadas el 24 de agosto de 2026; ciclo de vida pendiente de
downgrade diferido.** Los planes vendidos y asignados por
[`billing-polar-v2.md`](./billing-polar-v2.md) ya limitan API, Worker,
navegación y créditos. La expiración cae al plan de alta; falta aplicar
`nextPlanId` al vencer el periodo para cerrar el bloque 3 de
[`mvp-codecanyon-v2.md`](./mvp-codecanyon-v2.md).

## Cómo lo hace ZapiSocial (hechos observados)

### Dónde se definen los límites

Todo vive en `plans.permissions` (json). Las columnas `limits` y `features`
existen pero **nada las lee**: `User::planLimit()` y `hasPlanFeature()`
(`modules/AdminUser/Models/User.php:310,274`) solo consultan `permissions`.
Las claves no están en un enum: cada módulo las registra en runtime con
`register_plan_permission()` sobre `PlanPermissionRegistry`.

Límites numéricos observados:

| Clave                                     | Qué limita                                       |
| ----------------------------------------- | ------------------------------------------------ |
| `max_channels` + `channel_count_mode`     | Cuentas conectadas, contando por red o en total  |
| `max_posts_per_month`                     | Posts al mes (**no se hace cumplir**, ver abajo) |
| `max_ai_publishing_posts_per_month`       | Posts de AI Publishing (**tampoco**)             |
| `max_team_members`                        | Miembros del workspace                           |
| `max_storage_size_mb`, `max_file_size_mb` | Almacenamiento y tamaño por archivo              |
| `ai_studio_video_max_seconds`             | Duración de vídeo AI                             |
| `credits_usage_limit` + coste por acción  | Créditos de AI (-1 = ilimitado)                  |

### Dónde se hace cumplir (y dónde no)

- **Canales**: `ChannelPlanAccess::remainingSlots()/hasReachedLimit()`,
  invocado en cada controlador OAuth y en los pickers, que recortan la
  selección al remanente.
- **Posts al mes: solo se pinta en un widget del dashboard.** No hay chequeo
  al crear ni al programar. El único gate de publicación es la feature
  booleana `publishing`.
- **Miembros**: en el componente Livewire del workspace, no en policy ni
  middleware.
- **Créditos**: `CreditService::ensureCanConsume()` con coste por acción,
  llamado desde cada módulo AI.
- **Archivos**: `FileManager` comprueba tamaño y cuota en cada subida.
- **Patrón permisivo repetido**: `!$planOwner?->plan || hasPlanFeature('x')` —
  un usuario **sin plan asignado tiene el módulo abierto**. Convive con la
  variante estricta `canUsePlanFeature()`. No hay middleware de plan por ruta:
  cada módulo repite su chequeo donde se acuerda.

### Degradación y expiración

- El downgrade no es inmediato: se guarda `users.next_plan_id` y un middleware
  (`ResolveUserPlanState`) lo activa al vencer.
- `hasActivePlan()` apaga solo las features que pasan por
  `canUsePlanFeature()`; las que llaman a `hasPlanFeature()` directamente
  **siguen funcionando tras expirar**. No hay periodo de gracia.

### Módulos

Dos capas: la feature booleana del plan y `teams.enabled_modules` (json) por
workspace. El menú se oculta con callbacks `visible`; el backend repite el
chequeo a mano en cada controlador.

## Qué se conserva y qué se corrige en V2

**Se conserva**: el catálogo de límites (los siete de la tabla), el conteo de
canales con sus dos modos, los créditos con coste por acción, el downgrade
diferido y la doble capa plan + módulos por workspace (la columna
`workspaces.enabledModules` ya existe y está anotada en
[`deuda-tecnica.md`](./deuda-tecnica.md)).

**Se corrige** (los tres defectos observados):

1. **Los límites de posts se hacen cumplir de verdad**, al crear y al
   programar, con recuento mensual por workspace.
2. **Sin plan = el plan más restrictivo**, nunca todo abierto. El plan de alta
   por defecto (`plans.isDefaultSignup`) es el respaldo.
3. **Un solo punto de decisión.** En vez de chequeos repartidos por
   controladores, un `PlanAccessService` en API resuelve
   `limitsFor(workspace)` y expone `require(limit, usage)`; el Worker repite
   la comprobación en los trabajos que crean contenido, como exige
   [`seguridad.md`](../reglas/seguridad.md). La expiración se evalúa dentro
   del servicio: no puede quedar un camino que la ignore.

**Divergencia con Laravel**: las claves no se registran en runtime. V2 tipa el
catálogo de límites en `packages/contracts` (schema Zod cerrado); añadir un
límite nuevo es un cambio de contrato, visible en typecheck.

## Datos

- `plans.limits` contiene el jsonb tipado por `planLimitsSchema` y se edita
  desde el formulario de planes de Admin.
- El recuento de uso sale de tablas existentes: `socialAccounts` (canales),
  `posts` por mes, `workspaceMemberships`, `fileAssets.sizeBytes` (suma),
  `creditLedgerEntries`/`workspaceCreditAccounts`.
- La vigencia del plan sale de `workspacePlanAssignments` +
  `billingSubscriptions` (estado y `currentPeriodEndsAt`).

## Superficies

- **Admin → Plans**: sección de límites en el formulario (números, modo de
  conteo de canales, módulos incluidos, créditos y costes).
- **Portal**: el error de límite llega como código estable
  (`PLAN_LIMIT_REACHED` con el límite en `details`) y la interfaz lo traduce
  con invitación a mejorar el plan. Los pickers de conexión recortan al
  remanente, como en Laravel. `/portal/plans` consume el catálogo activo de
  Admin y muestra esos mismos límites antes de abrir checkout.

## Orden

`Laravel auditado → contrato de límites → Admin edita → PlanAccessService →
enforcement por vertical → Worker`.

## Fases

### Fase 1 — Contrato y edición

- [x] Schema `planLimitsSchema` en contracts (siete límites + módulos +
      créditos por acción) y columna `plans.limits` con migración 0045.
      (24-08-2026)
- [x] Formulario de planes de Admin editando límites, con `-1` = ilimitado.
      (24-08-2026)

### Fase 2 — El servicio y los primeros límites

- [x] `PlanAccessService`: plan vigente del workspace (asignación + estado de
      suscripción + respaldo al plan de alta), `limitsFor()` y `require()` con
      `PLAN_LIMIT_REACHED`. (24-08-2026)
- [x] Canales: límite y modo de conteo al conectar; el picker marca como
      `plan_locked` las redes sin cupo. (24-08-2026)
- [x] Miembros: límite al invitar y al aceptar, reservando las invitaciones
      pendientes. (24-08-2026)

### Fase 3 — Contenido y archivos

- [x] Posts por mes al crear/programar en API y re-chequeo en Worker (bulk,
      RSS y automation pasan por el mismo servicio). (24-08-2026)
- [x] Archivos: tamaño por archivo y cuota total en la subida. (24-08-2026)

### Fase 4 — Créditos y módulos

- [x] Coste por acción AI desde el plan; consumo atómico de la franquicia
      mensual primero y del saldo comprado después, con reembolso sobre el
      ledger existente. (24-08-2026)
- [x] Módulos por plan y por workspace (`enabledModules`): guard en API y
      Worker, visibilidad en la navegación del Portal y edición en Admin →
      Teams. La migración 0046 preserva `null` como herencia del plan.
      (24-08-2026)

### Fase 5 — Ciclo de vida

- [ ] Downgrade diferido (`nextPlanId` en la asignación) aplicado por el
      Worker al vencer el periodo.
- [x] Expiración sin suscripción activa: caída al plan por defecto, nunca a
      "todo abierto". (24-08-2026)

Evidencia de las fases 1–4: migraciones 0045–0046 aplicadas en
`zapi_v2_local` y `zapi_v2` con 47 entradas Drizzle idénticas; typecheck y
build del monorepo, 107 pruebas de API y 40 del Worker con las integraciones
de base de datos activadas, auditorías i18n y de UI en verde el 24-08-2026.

## Fuera de alcance

- Prorrateo de facturación al cambiar de plan (lo maneja la pasarela).
- Periodo de gracia configurable (ZapiSocial tampoco lo tiene; se anota como
  mejora futura).
