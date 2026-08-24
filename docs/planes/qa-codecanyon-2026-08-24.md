# QA integral para CodeCanyon — 24 de agosto de 2026

## Veredicto

El candidato es instalable, compila, migra desde cero, pasa las suites locales
y de navegador, y ya tiene setup, demo de solo lectura, documentación inglesa
y ZIP limpio. El cierre interno está completo; antes de publicar la versión
1.0 queda el gate externo de validar proveedores con cuentas reales o sandbox.

## Matriz ejecutada

| Área         | Evidencia                                                 | Resultado                                                            |
| ------------ | --------------------------------------------------------- | -------------------------------------------------------------------- |
| Dependencias | `bun install --frozen-lockfile`, `bun audit`              | Lock reproducible; 0 vulnerabilidades conocidas                      |
| Estática     | `bun run lint`, `bun run typecheck`, `bun run build`      | Verde en los 10 workspaces; Web generó 89 rutas                      |
| API          | PostgreSQL local migrado, suite completa `--runInBand`    | 35 suites, 133 pruebas, 0 skips, 0 fallos                            |
| Worker       | Misma base local, suite completa `--runInBand`            | 9 suites, 41 pruebas, 0 skips, 0 fallos                              |
| UI           | Auditor `--fail-on-findings`, lint, typecheck y build Web | Sin hallazgos después de corregir Setup                              |
| Navegador    | Playwright Chromium, escritorio y móvil                   | 12 flujos: auth, Admin, Portal, sheets, notificaciones y tema oscuro |
| i18n         | Sincronización y cadenas hardcoded                        | 4381 claves sincronizadas; 0 textos de UI en código                  |
| Schema       | Auditor de 96 tablas y 1067 columnas                      | 4 muertas, 10 dudosas y 3 solo-schema registradas como deuda         |
| Runtime demo | API y Web de producción contra PostgreSQL y Redis         | Health OK; escritura 403; login permitido; aviso visible             |
| Seeder demo  | Dos ejecuciones consecutivas                              | 2 canales, 9 posts, 3 tareas y 2 notificaciones, sin duplicados      |
| Contenedores | Build API y Web; inspección de runtime                    | Imágenes correctas; usuarios finales `bun` y `node`; seeder incluido |
| Instalación  | Compose limpio ejecutado durante el cierre                | 48 migraciones, setup, login, Admin, Portal y apagado limpio         |
| Distribución | `release:codecanyon -- 1.0.0-qa`                          | ZIP válido de 2.2 MB; checksum reproducible; exclusiones verificadas |

## Seguridad revisada

- Helmet, CORS con origen explícito, proxies privados conocidos, cookies
  configurables, validación Zod, rate limits y separación Admin/Portal están
  activos.
- No hay `.env` real versionado, marcadores de credenciales privadas ni TLS
  deshabilitado en las integraciones.
- Las únicas ejecuciones externas localizadas usan `execFile` con argumentos,
  límites y rutas internas para `ffmpeg`; no hay `eval`, `new Function` ni
  construcción de comandos de shell desde entradas.
- Las llamadas SQL `unsafe` restantes son consultas constantes de salud e
  información del sistema, no interpolan entrada del usuario.
- El modo demo bloquea globalmente mutaciones de producto y conserva solo
  lecturas y operaciones de sesión explícitas.
- El paquete se crea desde `git archive`: no copia el working tree, secretos,
  datos subidos, dependencias, builds ni documentación interna.

## Correcciones hechas durante el examen

- Dependencias vulnerables actualizadas y auditoría en cero.
- API endurecida con Helmet, CORS, proxies confiables y límites globales.
- Healthcheck de Redis acotado y consultas temporales del Worker corregidas.
- Contenedores multi-stage, no-root, con shutdown limpio y Next standalone.
- Setup único y seguro, planes iniciales, redirecciones y separación de roles.
- Demo de solo lectura con error estable, aviso global y datos sintéticos.
- Formulario Setup sin validación nativa, errores por toast y submit bloqueado
  mientras falten campos.
- Downgrade a plan gratuito programable y cancelable, con sincronización
  `cancelAtPeriodEnd` y transición idempotente en Worker.
- Todos los sheets usan una sola barra de acciones persistente, separador
  uniforme y scroll central; el auditor impide regresiones del patrón.
- Suite Playwright reproducible en escritorio y móvil. El build real detectó
  y corrigió la necesidad de compilar Database antes de arrancar API.
- Documentación HTML inglesa, créditos y empaquetador reproducible.

## Gate antes de publicar 1.0

**Proveedores reales:** OAuth, publicación, SMTP, Turnstile y webhooks de
Polar necesitan cuentas sandbox/reales. Las pruebas locales cubren fallos,
contratos, retornos de checkout y estados de UI, pero no certifican cambios
externos de cada proveedor.

## Riesgos y deuda no bloqueante

- El workflow de GitHub Actions queda preparado localmente, pero el token de
  publicación actual no tiene permiso para modificar workflows. Además se
  corrigió su base a `zapi_v2_local`; otro nombre hacía que 45 pruebas se
  saltaran silenciosamente. Debe publicarse con credenciales que incluyan ese
  permiso.
- Solo Polar está implementado. Cumple el criterio mínimo de una pasarela, pero
  Stripe y PayPal siguen siendo una desventaja comercial por región.
- El auditor de schema conserva cuatro campos sin consumidores:
  `aiRequests.schemaVersion`, `auditReleases.deployedByUserId`,
  `providerIntegrations.configVersion` y `publishingPosts.networkOptions`.
- La política CSP de Helmet está desactivada por compatibilidad con widgets y
  proveedores; debe definirse una matriz de orígenes antes de endurecerla.
- Swagger está público en `/api/docs`. No expone secretos, pero conviene hacer
  configurable su publicación en instalaciones cerradas.
- Faltan las plantillas AI iniciales, auto-update y verificación de purchase
  code. Los dos últimos permanecen fuera del MVP de instalación.

## Gate comercial externo

La cuenta del autor debe estar habilitada para publicar. Al 24 de agosto de
2026, Envato informa que las nuevas solicitudes de autor están cerradas; esto
no afecta a cuentas ya aprobadas. La entrega debe seguir los requisitos
oficiales de código organizado, créditos/licencias, documentación inglesa en
HTML o PDF y un único archivo ZIP.

Fuentes: [Code item preparation](https://help.author.envato.com/hc/en-us/articles/360000471583-Code-Item-Preparation-Technical-Requirements),
[upload requirements](https://help.author.envato.com/hc/en-us/articles/360000471943-How-to-Upload-Your-Items-to-Envato),
[review process](https://help.author.envato.com/hc/en-us/articles/360000471923-How-to-Get-Your-Items-Through-Review-at-Envato).
