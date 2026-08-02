# Documentación Zapi V2

La documentación se organiza por intención, no por tecnología ni antigüedad.

```text
conocimiento/  # cómo funciona o cómo está compuesto algo hoy
reglas/        # normas obligatorias y límites de trabajo
planes/        # decisiones, equivalencias Laravel → V2 y trabajo pendiente
```

## Cómo encontrar información

| Necesito | Leer primero |
| --- | --- |
| Tokens, primitives, 21st, UI, Next o Tailwind | [`reglas/design.md`](./reglas/design.md) |
| Stack, paquetes y responsabilidades | [`conocimiento/stack.md`](./conocimiento/stack.md) |
| Despliegue, Dokploy o variables por servicio | [`conocimiento/deployment/dokploy.md`](./conocimiento/deployment/dokploy.md) |
| Shell, navegación o sidebar Portal | [`conocimiento/ui/portal-sidebar.md`](./conocimiento/ui/portal-sidebar.md) |
| Dirección y fases globales de V2 | [`planes/implementacion-v2.md`](./planes/implementacion-v2.md) |
| Roles, sesión, Admin y Portal | [`planes/separacion-admin-portal.md`](./planes/separacion-admin-portal.md) |
| Channels, providers, contratos y equivalencia Laravel | [`planes/channels-v2.md`](./planes/channels-v2.md) |
| Prioridad y pendientes de providers Channels | [`planes/channels-providers.md`](./planes/channels-providers.md) |

## Estado de una referencia

- **Conocimiento** describe la implementación observada; no sustituye revisar el código cuando una afirmación deba ser exacta.
- **Regla** es obligatoria mientras no sea reemplazada explícitamente.
- **Plan** describe una decisión o intención. Sus checklists deben actualizarse al cerrar trabajo relevante.

## Si no existe documentación

1. No inventar una ruta, contrato, permiso, decisión o estado.
2. Buscar primero por nombre en `docs/` y después en código, schema y contratos.
3. Para comportamiento heredado, auditar `ZapiSocial` antes de proponer equivalencia V2.
4. Si la evidencia no resuelve la duda o el cambio es irreversible, pedir aclaración al usuario.
5. Si se toma una decisión nueva o se inicia un módulo nuevo, crear o actualizar un documento breve en `planes/` con alcance, referencia y pendiente antes de implementar backend.

No almacenar secretos, tokens, datos de producción ni valores de `.env` en ningún documento.
