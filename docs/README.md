# Documentación Zapi V2

La documentación se organiza por intención, no por tecnología ni antigüedad.

```text
conocimiento/  # cómo funciona o cómo está compuesto algo hoy
reglas/        # normas obligatorias y límites de trabajo
planes/        # decisiones, equivalencias Laravel → V2 y trabajo pendiente
```

`AGENTS.md` dirige el trabajo. [`ARCHITECTURE.md`](../ARCHITECTURE.md) ubica responsabilidades en el monorepo. Ninguno sustituye la fuente de verdad específica de cada dominio.

## Cómo encontrar información

| Necesito                                                     | Leer primero                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Límites entre Web, API, Worker y packages                    | [`ARCHITECTURE.md`](../ARCHITECTURE.md)                                                                                                                                                                                            |
| Tokens, primitives, 21st, UI, Next o Tailwind                | [`reglas/design.md`](./reglas/design.md)                                                                                                                                                                                           |
| Definition of Done, pruebas o revisión                       | [`reglas/calidad.md`](./reglas/calidad.md)                                                                                                                                                                                         |
| Sesión, permisos, ownership, secretos y fronteras            | [`reglas/seguridad.md`](./reglas/seguridad.md)                                                                                                                                                                                     |
| Commits, publicación y pull requests                         | [`reglas/entrega.md`](./reglas/entrega.md)                                                                                                                                                                                         |
| Descubrimiento, `.env`, privilegios o migraciones            | [`reglas/workflow.md`](./reglas/workflow.md)                                                                                                                                                                                       |
| Stack, paquetes y responsabilidades observadas               | [`conocimiento/stack.md`](./conocimiento/stack.md)                                                                                                                                                                                 |
| Despliegue, Dokploy o variables por servicio                 | [`conocimiento/deployment/dokploy.md`](./conocimiento/deployment/dokploy.md)                                                                                                                                                       |
| Cómo traducir la interfaz o añadir un idioma                 | [`conocimiento/i18n.md`](./conocimiento/i18n.md)                                                                                                                                                                                   |
| Shell, navegación o sidebar Portal                           | [`conocimiento/ui/portal-sidebar.md`](./conocimiento/ui/portal-sidebar.md)                                                                                                                                                         |
| Dirección y fases globales de V2                             | [`planes/implementacion-v2.md`](./planes/implementacion-v2.md)                                                                                                                                                                     |
| Roles, sesión, Admin y Portal                                | [`planes/separacion-admin-portal.md`](./planes/separacion-admin-portal.md)                                                                                                                                                         |
| Refactor visual de V2 desde `template-shadcn-superdashboard` | [`planes/refactor-visual-design-ideal-v2.md`](./planes/refactor-visual-design-ideal-v2.md)                                                                                                                                         |
| Channels, providers, contratos y equivalencia Laravel        | [`planes/channels-v2.md`](./planes/channels-v2.md)                                                                                                                                                                                 |
| Publishing, AI, Bulk Posts y RSS                             | [`planes/publishing-v2.md`](./planes/publishing-v2.md), [`planes/ai-studio-v2.md`](./planes/ai-studio-v2.md), [`planes/bulk-posts-v2.md`](./planes/bulk-posts-v2.md), [`planes/rss-schedules-v2.md`](./planes/rss-schedules-v2.md) |
| Groups y Automation                                          | [`planes/groups-v2.md`](./planes/groups-v2.md), [`planes/automation-v2.md`](./planes/automation-v2.md)                                                                                                                             |
| Teams, roles, invitaciones y alcance de cuentas              | [`planes/teams-v2.md`](./planes/teams-v2.md)                                                                                                                                                                                       |
| Commerce y afiliados                                         | [`planes/commerce-v2.md`](./planes/commerce-v2.md)                                                                                                                                                                                 |
| Billing Admin y pasarela Polar.sh                            | [`planes/billing-polar-v2.md`](./planes/billing-polar-v2.md)                                                                                                                                                                       |
| MVP CodeCanyon: hoja de ruta y criterio de publicable        | [`planes/mvp-codecanyon-v2.md`](./planes/mvp-codecanyon-v2.md)                                                                                                                                                                     |
| Admin operativo: roles, impersonación, reporte, teams        | [`planes/admin-operativo-v2.md`](./planes/admin-operativo-v2.md)                                                                                                                                                                   |
| Pasarelas de pago múltiples                                  | [`planes/pasarelas-pago-v2.md`](./planes/pasarelas-pago-v2.md)                                                                                                                                                                     |
| Límites de plan y su enforcement                             | [`planes/limites-de-plan-v2.md`](./planes/limites-de-plan-v2.md)                                                                                                                                                                   |
| Instalación y paquete del comprador                          | [`planes/instalacion-comprador-v2.md`](./planes/instalacion-comprador-v2.md)                                                                                                                                                       |
| Captcha de Login y Registro                                  | [`planes/turnstile-v2.md`](./planes/turnstile-v2.md)                                                                                                                                                                               |
| Búsqueda e importación de media online                       | [`planes/online-media-v2.md`](./planes/online-media-v2.md)                                                                                                                                                                         |
| Google Drive en Files y Publishing                           | [`planes/google-drive-picker-v2.md`](./planes/google-drive-picker-v2.md)                                                                                                                                                           |
| Tickets de Portal y su futura administración                 | [`planes/support-v2.md`](./planes/support-v2.md)                                                                                                                                                                                   |
| Anuncios de plataforma y campana del Portal                  | [`planes/notificaciones-v2.md`](./planes/notificaciones-v2.md)                                                                                                                                                                     |
| Textos de los correos transaccionales                        | [`planes/plantillas-correo-v2.md`](./planes/plantillas-correo-v2.md)                                                                                                                                                               |
| Idiomas y traducciones de la interfaz                        | [`planes/i18n-v2.md`](./planes/i18n-v2.md)                                                                                                                                                                                         |
| Pasarelas de pago y equivalencia con ZapiSocial              | [`planes/pasarelas-pago-v2.md`](./planes/pasarelas-pago-v2.md)                                                                                                                                                                     |
| Conectores de publicación por red social                     | [`planes/canales-publicacion-v2.md`](./planes/canales-publicacion-v2.md)                                                                                                                                                           |
| Idiomas gestionados desde Admin                              | [`planes/idiomas-admin-v2.md`](./planes/idiomas-admin-v2.md)                                                                                                                                                                       |
| Tableros kanban de tareas y de contenido                     | [`planes/tableros-v2.md`](./planes/tableros-v2.md)                                                                                                                                                                                 |
| Reglas de marca de agua de Publishing                        | [`planes/watermarks-v2.md`](./planes/watermarks-v2.md)                                                                                                                                                                             |
| Gobernanza documental y de agentes                           | [`planes/gobernanza-agentes-v2.md`](./planes/gobernanza-agentes-v2.md)                                                                                                                                                             |
| Sitio público de marketing dentro de `apps/web`               | [`planes/landing-en-web-v2.md`](./planes/landing-en-web-v2.md)                                                                                                                                                                     |
| Mocks pendientes, código muerto y docs desalineadas          | [`planes/deuda-tecnica.md`](./planes/deuda-tecnica.md)                                                                                                                                                                             |

## Estado de una referencia

- **Conocimiento** describe implementación observada; no sustituye revisar el código cuando una afirmación deba ser exacta.
- **Regla** es obligatoria mientras no sea reemplazada explícitamente.
- **Plan** describe una decisión, equivalencia o intención. Sus checklists se marcan solo con evidencia de validación.

## Si no existe documentación

1. No inventar una ruta, contrato, permiso, decisión o estado.
2. Buscar primero por nombre en `docs/` y después en código, schema y contratos.
3. Para comportamiento heredado, auditar `ZapiSocial` antes de proponer equivalencia V2.
4. Si la evidencia no resuelve la duda o el cambio es irreversible, pedir aclaración al usuario.
5. Si se toma una decisión nueva o se inicia un módulo, crear o actualizar un plan breve en `planes/` con alcance, referencia, estado mock y pendiente antes de implementar backend.

No almacenar secretos, tokens, datos de producción ni valores de `.env` en ningún documento.
