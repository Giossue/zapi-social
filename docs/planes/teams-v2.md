# Plan — Teams y Members V2

## Estado al 2026-08-09

**Fases 1 a 30 implementadas y validadas localmente.** `/portal/teams` consume REST real y ya no contiene fixtures ni repositorios mock. La UI, los contratos Zod, Nest y Drizzle comparten miembros, roles, grants, invitaciones, cupos, actividad, transferencia y abandono. El ingreso público por `/invite`, la continuidad de login/registro y el selector de workspace también están conectados a REST real. Publishing, AI Publishing y Channels consumen la política central `TeamAccountAccessService`. El correo transaccional suma seis plantillas centralizadas: una de autenticación y cinco de Teams.

Las migraciones `0023_mature_whizzer.sql` y `0024_teams-invitation-backfill.sql` están aplicadas y verificadas en `zapi_v2_local` y en la base remota. Ambas registran 25 migraciones Drizzle y comparten columnas, constraints e índice parcial de invitaciones pendientes.

## Objetivo de producto

Teams será la superficie para administrar **personas, roles, alcance de cuentas, invitaciones, cupos y actividad de acceso** de un workspace.

```text
Teams
├── Personas y acceso
├── Invitaciones
├── Cupos del workspace
└── Actividad de membresía

Publishing
├── Flujo de aprobación
├── Comentarios sobre contenido
└── Notificaciones de revisión
```

Teams no será un chat ni un gestor de publicaciones. Esta frontera evita repetir en V2 la mezcla de responsabilidades de Laravel.

## Evidencia Laravel

### Hechos observados

| Área                 | Referencia Laravel                                            | Comportamiento observado                                                                                                       |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Workspace            | `ZapiSocial/modules/AppTeams/Livewire/Workspace.php`          | Concentra perfil del equipo, roles, permisos JSON, invitaciones, cuentas administradas, métricas, chat y aprobaciones.         |
| Acceso               | `Support/TeamWorkspaceAccess.php`                             | Owner evita restricciones; `managed_account_ids` funciona como allow-list del pivot.                                           |
| Registro de permisos | `Support/TeamPermissionRegistry.php`                          | Los permisos y defaults por rol se registran dinámicamente.                                                                    |
| Invitaciones         | `Models/TeamInvitation.php` y `Workspace::acceptInvite`       | El código puede aceptarlo cualquier usuario autenticado; el correo es solo metadato. La UI permite enlace, código y QR.        |
| Miembros             | vista de Workspace y acciones Livewire                        | Permite editar permisos, administrar cuentas y eliminar miembros. El miembro sin gestión ve perfil, su acceso y el directorio. |
| Perfil y límites     | Workspace y comprobaciones del plan                           | Expone nombre, descripción, módulos habilitados y límite de miembros.                                                          |
| Chat                 | acciones `create/send/edit/delete` de salas y mensajes        | Incluye conversaciones internas dentro del módulo Teams.                                                                       |
| Aprobaciones         | acciones `approve/reject` y vistas de Workspace               | Incluye cola de revisión y notas de decisión dentro de Teams.                                                                  |
| Publishing           | `AppPublishingServiceProvider.php` y `PublishingCalendar.php` | `post.create`, `post.approve` y `post.publish` se mezclan con checks inconsistentes.                                           |

### Qué se conserva, adapta o descarta

| Capacidad Laravel                                 | Decisión V2             | Motivo                                                                                                               |
| ------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Vista de acceso propio                            | **Tomar**               | Un member debe entender su rol y cuentas sin necesitar permisos administrativos.                                     |
| Gestión de miembros y cuentas                     | **Tomar y tipar**       | Es el núcleo de Teams; los grants tendrán relaciones explícitas.                                                     |
| Invitación con expiración, remitente y revocación | **Tomar y reforzar**    | Es estándar y útil, pero con token privado, hash y correo vinculado.                                                 |
| Límite de miembros                                | **Tomar**               | Evita invitar por encima del plan y hace visible la capacidad disponible.                                            |
| Actividad de membresía                            | **Añadir**              | V2 ya persiste auditoría, pero falta una superficie consultable.                                                     |
| Perfil básico del workspace                       | **Diferir**             | Nombre/icono pueden vivir luego en Settings; no bloquean la gestión del equipo.                                      |
| Selector de workspace                             | **Añadir**              | Aceptar una invitación crea membresía en un segundo workspace; el usuario necesita ver y cambiar el contexto activo. |
| Permisos JSON por persona                         | **Descartar**           | Duplica roles y genera privilegios implícitos difíciles de auditar.                                                  |
| Links abiertos, código corto y QR                 | **Descartar**           | Aumentan el riesgo de canje por una identidad distinta al correo invitado.                                           |
| Módulos habilitados manualmente                   | **Descartar por ahora** | Las capacidades deben derivarse del producto/plan, no de flags libres en Teams.                                      |
| Chat interno                                      | **Descartar**           | No se reconstruirá Slack dentro de Zapi; no pertenece al objetivo del módulo.                                        |
| Aprobaciones y comentarios                        | **Mover a Publishing**  | El contexto y el ciclo de vida pertenecen al contenido que se revisa.                                                |

## Decisiones V2

### Roles y autorización

Roles canónicos: `owner`, `admin`, `member`. No existe `editor`.

| Acción                                 |                         Owner | Admin | Member |
| -------------------------------------- | ----------------------------: | ----: | -----: |
| Ver su propio rol y alcance            |                            Sí |    Sí |     Sí |
| Ver el directorio básico               |                            Sí |    Sí |     Sí |
| Ver invitaciones y actividad de acceso |                            Sí |    Sí |     No |
| Invitar member                         |                            Sí |    Sí |     No |
| Invitar o promover admin               |                            Sí |    No |     No |
| Cambiar grants de un member            |                            Sí |    Sí |     No |
| Cambiar o revocar admin                |                            Sí |    No |     No |
| Revocar member                         |                            Sí |    Sí |     No |
| Transferir ownership                   |                            Sí |    No |     No |
| Abandonar workspace                    | Sí, tras transferir ownership |    Sí |     Sí |

- El rol define capabilities; Portal no editará una bolsa libre de permisos JSON.
- Owner y admin alcanzan todas las cuentas activas del workspace.
- Member solo alcanza cuentas asociadas a su `workspace_membership` mediante `social_account_memberships`.
- API y Worker deben validar sesión, workspace, rol, grant/cuenta y estado del canal en cada operación.
- Al remover un miembro se eliminan sus grants, se invalidan sus sesiones de workspace y se conserva la autoría histórica.
- Nunca se puede eliminar o degradar al último owner. La transferencia de ownership es explícita y exclusiva del owner.

### Invitaciones

- Son privadas, de un uso y ligadas al correo normalizado.
- El token se guarda exclusivamente como hash, expira y se invalida al aceptar, revocar o reenviar.
- La aceptación exige una sesión con el mismo correo. El registro conserva el flujo sin exponer el token en logs.
- Admin solo invita `member`; owner puede invitar `admin` o `member`.
- Reenviar invalida el token anterior, actualiza el último envío y no crea dos cupos pendientes para el mismo correo.
- Invitar falla antes del envío si no quedan cupos o ya existe una membresía/invitación pendiente para el correo.
- Los estados canónicos serán `pending`, `accepted`, `revoked` y `expired`; el estado de entrega de correo se modelará aparte para no confundir membresía con transporte.

### Cupos

- La UI muestra `miembros activos / límite del plan` cerca de la acción **Invitar miembro**.
- Las invitaciones pendientes reservan un cupo. La regla evita aceptar una invitación cuando el límite ya se agotó.
- Sin límite contractual se presenta “Miembros ilimitados”; no se inventa un número desde Web.
- Cambiar plan o facturación queda fuera de Teams y enlaza a Billing cuando exista esa capacidad.

### Auditoría

Se registran como mínimo: invitación creada, reenviada, revocada, expirada y aceptada; rol cambiado; grants reemplazados; miembro removido; workspace abandonado; ownership transferido.

Los metadatos públicos nunca incluyen token, hash, credenciales ni payloads completos del proveedor de correo.

## Modelo existente

La base conserva `workspaces`, `workspace_memberships`, `social_account_memberships`, `workspace_invitations` y `workspace_membership_audit_events`. `0019_minor_stick.sql` creó la base de membresías; `0023_mature_whizzer.sql` añadió cupos, entrega y unicidad de invitaciones, y `0024_teams-invitation-backfill.sql` sanea datos heredados de forma idempotente. Las dos últimas están aplicadas y verificadas localmente y en remoto.

```text
workspace_invitations
  id, workspace_id, invited_by_user_id
  email_normalized, role
  token_hash, status: pending | accepted | revoked | expired
  delivery_status: pending | sent | failed, last_sent_at nullable
  expires_at, accepted_by_user_id nullable, accepted_at nullable
  created_at, updated_at

workspace_membership_audit_events
  id, workspace_id, actor_user_id nullable, subject_user_id nullable
  type, metadata_safe jsonb, created_at
```

`workspaces.member_limit` es nullable: `null` significa sin límite contractual. Aceptar la primera colaboración convierte el workspace de `personal` a `team`; la transferencia también garantiza ese tipo para no colisionar con el workspace personal del nuevo owner.

`workspace_memberships.permissions` permanece temporalmente por compatibilidad, pero no es fuente de autorización para Teams/Publishing nuevos. Solo se retirará al comprobar que no quedan consumidores.

## Superficie mock objetivo

### Composición común

- Ruta única: `/portal/teams`.
- El shell mantiene el título de ruta; la página empieza con acciones y contenido operativo, sin hero card duplicada.
- Acción primaria: **Invitar miembro**, visible solo para owner/admin y deshabilitada con explicación cuando no quedan cupos.
- Indicador compacto de cupos junto a la acción principal.
- Pestañas sin contadores: **Miembros**, **Invitaciones pendientes** y **Actividad**.
- El buscador permanece en la misma posición al cambiar de pestaña, pero conserva una consulta independiente por pestaña. Nunca filtra datos de otra pestaña.
- La acción contextual usa el patrón de Files: tres puntos verticales, acciones normales agrupadas y acción destructiva separada al final.
- Tablas con la densidad y composición canónica de `diseño ideal/dashboard/users` y `TablePagination` solo cuando el volumen lo requiera.

### Miembros — owner/admin

Columnas: miembro, rol, alcance, fecha de incorporación y acciones.

Menú según permisos del actor:

1. **Gestionar acceso**: rol permitido y cuentas asignadas.
2. **Transferir propiedad**: solo owner, únicamente sobre un admin elegible y con confirmación explícita.
3. Separador.
4. **Eliminar miembro**: confirmación destructiva y restricciones para owner/último owner.

El usuario actual se identifica con “Tú”. La fila owner no ofrece acciones que el actor no pueda completar.

### Mi acceso — member

Un member no recibe una pantalla de “sin permiso”. Ve una superficie de solo lectura con:

- su rol;
- cuentas a las que tiene acceso;
- explicación breve del alcance;
- directorio básico de miembros, sin correos o controles administrativos que no necesite;
- acción **Abandonar workspace** con confirmación.

### Invitaciones pendientes

Columnas: correo, rol, invitado por, último envío, vencimiento, estado de entrega y acciones.

Menú:

1. **Ver detalles**.
2. **Reenviar invitación** con estado pending y feedback de éxito/error.
3. Separador.
4. **Revocar invitación** con confirmación.

El detalle muestra datos de negocio, no el token ni enlaces internos. El estado vencido deja de ser una invitación pendiente accionable; puede ofrecer una nueva invitación prellenada en vez de reutilizar el token.

### Actividad

Listado cronológico de eventos de acceso con actor, acción, sujeto y fecha. La primera iteración tendrá filtros por tipo y paginación; no expondrá el JSON de metadatos ni funcionará como auditoría técnica general de Admin.

### Estados obligatorios del mock

| Estado             | Comportamiento esperado                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| Normal             | Datos sintéticos deterministas y acciones según rol.                              |
| Loading            | Skeleton que conserva tabs, buscador y forma de la tabla.                         |
| Vacío inicial      | Mensaje contextual; no duplica la acción persistente **Invitar miembro**.         |
| Sin resultados     | Mensaje con **Limpiar filtros** de la pestaña activa.                             |
| Error              | Error persistente con **Reintentar**.                                             |
| Sin gestión        | Vista **Mi acceso**, no bloqueo genérico.                                         |
| Acción pendiente   | Control disparador deshabilitado, spinner y prevención de doble envío.            |
| Cupos agotados     | Explicación visible; no abre un diálogo que vaya a fallar.                        |
| Invitación vencida | No permite aceptar, reenviar el mismo token ni presentarla como pendiente válida. |
| Último owner       | No permite degradar, eliminar o abandonar sin transferir propiedad.               |
| Responsive         | Tabla/lista utilizable y menús accesibles en móvil.                               |
| Temas              | Contraste y jerarquía verificados en claro y oscuro.                              |

## Estado técnico actual

### UI y fixtures

- `/portal/teams` usa `teamsApi`; se eliminaron `features/teams/fixtures`, `mocks` y tipos locales duplicados.
- Owner/admin tienen **Miembros**, **Invitaciones pendientes** y **Actividad**, sin números en los tabs y con búsqueda independiente persistente en la misma posición.
- El menú contextual replica el patrón de Files: acciones normales, separador y destructiva al final.
- Member recibe **Mi acceso**, sus cuentas y un directorio de solo lectura; los correos de terceros y las invitaciones no llegan en la respuesta.
- Existen skeleton estructural, error con reintento, vacíos iniciales/filtrados, pending sin doble envío, cupos agotados y variantes desktop/móvil en claro/oscuro.
- `/invite` recupera el token desde el fragmento privado, lo retira de la URL, obtiene un preview por POST y conserva el flujo durante login o registro.
- El selector aparece en el shell de Portal cuando la sesión tiene dos o más workspaces activos.
- Durante un despliegue escalonado, el shell tolera temporalmente una respuesta de sesión sin `workspaces`: conserva el workspace activo, oculta el selector y evita interrumpir Portal hasta que el API actualizado entregue la lista completa.

### REST Nest existente

```text
POST   /v1/public/teams/invitations/preview
POST   /v1/auth/workspaces/activate
GET    /v1/portal/teams
GET    /v1/portal/teams/activity
POST   /v1/portal/teams/invitations
POST   /v1/portal/teams/invitations/accept
POST   /v1/portal/teams/invitations/:id/resend
DELETE /v1/portal/teams/invitations/:id
PATCH  /v1/portal/teams/members/:userId/role
PUT    /v1/portal/teams/members/:userId/account-grants
PUT    /v1/portal/teams/members/:userId/access
DELETE /v1/portal/teams/members/:userId
POST   /v1/portal/teams/leave
POST   /v1/portal/teams/ownership/transfer
```

Nest valida workspace y rol en cada operación. Las mutaciones sensibles bloquean el workspace para serializar cupos, cambios de rol, eliminación, abandono y transferencia. Reenviar rota el token; aceptar condiciona la escritura al hash vigente. Revocar no puede sobrescribir una invitación ya aceptada. La entrega SMTP actualiza un estado separado y nunca expone token/hash en REST o auditoría.

El endpoint de actividad filtra por categoría y texto, pagina en servidor y solo está disponible para owner/admin. `PUT /members/:userId/access` actualiza rol y grants en una sola transacción; los endpoints anteriores se conservan por compatibilidad.

### Errores públicos

La vertical expone códigos estables, entre ellos `TEAM_ACCESS_DENIED`, `TEAM_MEMBER_ALREADY_EXISTS`, `INVITATION_INVALID`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_ALREADY_PENDING`, `INVITATION_RESEND_NOT_ALLOWED`, `ROLE_CHANGE_NOT_ALLOWED`, `ACCOUNT_GRANT_NOT_ALLOWED`, `MEMBER_LIMIT_REACHED` y `LAST_OWNER_PROTECTED`.

## Plan de cierre — ingreso por invitación

### Brecha de partida, cerrada al 2026-08-09

- El correo generaba una URL sin una ruta Web que pudiera consumirla.
- `teamsApi.acceptInvitation()` existía, pero ninguna superficie Web lo invocaba.
- Login y registro no conservaban el contexto de invitación.
- Aceptar creaba la membresía, pero no activaba el workspace invitado ni renovaba la cookie de acceso.
- Una cuenta con varias membresías no tenía selector de workspace.

### Resultado objetivo

```text
Correo con fragmento privado
→ /invite recupera token sin enviarlo en URL al servidor
→ preview público por POST
→ login/registro con retorno preservado
→ aceptación autenticada y ligada al mismo correo
→ activación explícita del workspace invitado
→ Portal abierto en el nuevo contexto
```

La invitación siempre pertenece a un **workspace**. Teams es la superficie que administra sus membresías, roles y grants; no crea una entidad paralela llamada equipo.

### Superficies y estados

- Crear primero en `diseño ideal` la ruta canónica `/invite`; copiar después composición y estados a V2.
- La ruta pública cubre: loading, token ausente, inválido, usado, vencido, invitado sin sesión, sesión con correo distinto, aceptación pendiente, éxito y error recuperable.
- Login y registro reciben solo un retorno interno permitido hacia `/invite`; el token permanece en `sessionStorage`, nunca en parámetros de esas rutas.
- El shell de Portal muestra selector solo cuando existen dos o más workspaces activos. Cambiarlo actualiza la sesión actual, renueva autenticación y recarga el contexto.

### Contrato y backend

- `POST /v1/public/teams/invitations/preview`: recibe token en body y devuelve workspace, rol, correo invitado, existencia de cuenta, vencimiento y estado público normalizado.
- `POST /v1/portal/teams/invitations/accept`: conserva validaciones actuales y devuelve el workspace aceptado.
- `POST /v1/auth/workspaces/activate`: valida membresía activa, cambia `auth_sessions.active_workspace_id` para la sesión actual y renueva cookies.
- `GET /v1/auth/session`, login, registro y refresh devuelven lista de workspaces activos para Portal.
- No se requiere migración: `auth_sessions.active_workspace_id` y las relaciones de membresía ya existen.

### Orden y criterios verificables

19. [x] Crear y validar mock navegable `/invite` en `diseño ideal`.
20. [x] Añadir schemas Zod, errores públicos y cliente REST para preview, aceptación y activación.
21. [x] Implementar preview sin filtrar token/hash y activación limitada a membresías del usuario.
22. [x] Hacer que aceptación devuelva workspace y que auth liste/active contextos con cookie renovada.
23. [x] Implementar `/invite`, continuidad login/registro y selector de workspace copiando la fuente visual.
24. [x] Probar cuenta existente, cuenta nueva, correo distinto, token inválido/vencido/usado, cupo agotado y cambio de workspace.
25. [x] Validar typecheck, lint/build, smoke visual responsive y actualizar evidencia de cierre.

## Plan — correos transaccionales de Teams

### Estado de partida

- V2 tenía dos plantillas de correo reales: restablecimiento de contraseña e invitación a workspace. No existía una tercera plantilla.
- Teams solo enviaba la invitación básica; aceptación, cambio de acceso, eliminación y transferencia de propiedad no tenían plantilla ni aviso.

### Alcance aprobado

- Centralizar todas las plantillas en `apps/api/src/email/templates/` con layout común y contenido compatible con clientes de correo.
- Teams tendrá cinco plantillas: invitación, invitación aceptada, acceso actualizado, miembro eliminado y propiedad transferida.
- Invitación conserva entrega bloqueante y estado `sent/failed`. Los avisos posteriores se envían después del commit y no revierten una acción de negocio correcta si SMTP falla.
- Todos los envíos usan exclusivamente la integración SMTP habilitada y probada en Admin. No se añaden credenciales, provider alterno ni migración.

### Orden y criterios verificables

26. [x] Crear layout común y reorganizar las dos plantillas existentes.
27. [x] Crear las cuatro plantillas Teams adicionales con asuntos y datos mínimos.
28. [x] Conectar invitación enriquecida y avisos posteriores a eventos Teams reales.
29. [x] Probar render HTML/texto y entregas de invitación, aceptación, acceso, eliminación y ownership.
30. [x] Validar typecheck, lint, build y registrar evidencia final.

## Fuera de alcance de esta iteración

- chat, salas, menciones o mensajes directos;
- aprobación y comentarios de publicaciones dentro de Teams;
- permisos libres por usuario;
- enlaces públicos, códigos cortos o QR de invitación;
- grupos de acceso y aprobadores externos;
- SSO, SCIM, dominio verificado, MFA obligatoria y administración corporativa de sesiones;
- edición completa del perfil del workspace;
- compra o cambio de plan dentro de Teams;
- automatizaciones del Worker, salvo que una acción futura requiera expiración o entrega asíncrona durable.

## Secuencia de implementación

### Base ya construida

1. [x] Auditar Laravel y registrar divergencias de seguridad.
2. [x] Crear la primera UI mock con miembros e invitaciones separadas.
3. [x] Definir roles, grants, invitaciones seguras, contratos Zod y errores base.
4. [x] Añadir y aplicar la persistencia de invitaciones y auditoría mediante `0019_minor_stick.sql`.
5. [x] Implementar en Nest listado, invitación, aceptación, revocación, rol, grants y eliminación.

### Superficie aprobada

6. [x] Completar la superficie con usuario actual, cupos, entrega de invitaciones y eventos de actividad.
7. [x] Sustituir el bloqueo de member por **Mi acceso** y directorio de solo lectura.
8. [x] Añadir reenvío y estados completos a **Invitaciones pendientes**.
9. [x] Añadir indicador de cupos y sus restricciones visuales.
10. [x] Añadir **Actividad** con filtros y paginación.
11. [x] Modelar transferencia de ownership y abandono con confirmaciones y guardas.
12. [x] Validar normal/loading/empty/error/permisos/pending/móvil/claro/oscuro.

### Integración real

13. [x] Ajustar contratos Zod y errores a la UI aprobada; definir endpoints faltantes sin adelantar capacidades diferidas.
14. [x] Completar autorización y tests focales de owner/admin/member, último owner, grants, cupos y tokens invalidados.
15. [x] Implementar los cambios aditivos de Nest/Drizzle; no fue necesario añadir trabajo al Worker.
16. [x] Sustituir fixtures por cliente REST y cubrir loading/error/pending con estado real.
17. [x] Conectar Publishing, AI Publishing y Channels a la política central de roles/grants sin duplicarla.
18. [x] Actualizar superficie Swagger/Nest, cliente, documentación y evidencia de cierre local.

## Evidencia de cierre local

- `0023` y `0024` aplicadas en `zapi_v2_local`: 25 migraciones registradas, índice parcial presente, cero duplicados pendientes y cero entregas heredadas en `pending`.
- Pruebas de integración de Teams y política de acceso: **10 pass, 0 fail, 73 assertions**. Cubren privacidad, permisos por rol, cupos/duplicados, rotación de token, aceptación, revocación posterior inocua, ownership, workspace personal del destinatario, abandono, actividad y filtros de Publishing/AI/Channels.
- Pruebas focales del cierre de invitaciones y sesión: **7 pass, 0 fail, 75 assertions**. Cubren preview para cuenta existente y nueva, correo distinto, token inválido/vencido/reutilizado, cupo agotado, aceptación idempotente y activación autorizada de workspace.
- Typecheck global sin errores en siete paquetes ejecutables, incluido Worker; lint focal sin errores en Teams, Channels y rutas Web afectadas.
- Build focal exitoso para Contracts, Nest API y Next Web; `/invite` y `/portal/teams` aparecen en la salida de producción. El build global del repositorio de diseño conserva un bloqueo preexistente por `@shadcn/react/questionnaire`, ajeno a `/invite`; Biome sí valida los dos archivos nuevos.
- Smoke autenticado de interacción: **2 pass** para búsqueda contextual/atajo, menús, diálogos, privacidad de tokens y correos. Revisión visual completada en desktop/móvil y temas claro/oscuro.
- Smoke de navegador real del ingreso: enlace con fragmento → preview → registro → retorno a `/invite` → aceptación → membresía activa → activación del workspace. También se verificó que el token desaparece de la URL y que el layout responde en desktop/móvil.
- Regresión del selector validada con una sesión sin `workspaces`: renderiza sin excepción y permanece oculto; typecheck, lint focal y build Web finalizan sin errores.
- Plantillas de correo: **7 pass, 0 fail, 26 assertions** para HTML, texto plano y escape de contenido. Teams: **7 pass, 0 fail, 72 assertions** para invitación enriquecida y avisos de aceptación, acceso, eliminación y ownership; un fallo SMTP posterior al commit no revierte la acción.
- Validación del cierre de correo: ESLint focal sin errores, typecheck y build de API exitosos. Las seis plantillas viven en `apps/api/src/email/templates/` y usan la integración SMTP configurada en Admin; no requirieron migración.
- Los datos y sesiones sintéticos usados para QA se eliminaron y se verificó conteo cero.
- `0023` y `0024` aplicadas y verificadas en la base remota: 25 migraciones registradas, columnas y constraints presentes, índice parcial creado, cero duplicados pendientes y health de API/PostgreSQL/Redis en `ok`.

## Criterio de cierre

Teams se considera terminado cuando el mock aprobado, los contratos, la autorización, la persistencia y la UI conectada describen las mismas capacidades; existen pruebas de ownership, límites e ingreso por invitación; no quedan datos mock en la ruta; y Publishing/Channels consumen la política central sin permisos paralelos.

Ese criterio se cumple localmente. En remoto ya están verificados el schema y el historial Drizzle; la validación funcional en línea de `/invite` y `/portal/teams` corresponde al siguiente despliegue de esta implementación.
