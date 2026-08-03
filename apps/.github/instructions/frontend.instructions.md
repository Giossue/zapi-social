---
applyTo: "apps/web/**,packages/ui/**"
---

# Frontend Zapi V2

- Leer `docs/reglas/design.md` y `docs/reglas/calidad.md` antes de cambiar UI.
- Para una superficie de dominio nueva, auditar Laravel y actualizar el plan antes de implementar.
- Construir primero fixtures sintéticas y repositorio mock; no saltar a API salvo petición explícita.
- Antes de crear markup o componentes, consultar `codebase-memory` en `packages/ui` y revisar `packages/ui/COMPONENTS.md`; reutilizar `@workspace/ui`. Crear componentes específicos en la feature y promover a UI solo patrones genéricos usados por tres o más features, actualizando el catálogo.
- No crear primitives locales ni sobrescribir tokens visuales con clases raw.
- Cubrir normal, loading, empty, error, permisos, móvil y claro/oscuro cuando aplique.
- No exponer IDs internos, tokens, detalles de provider, paths de storage o diagnóstico técnico en Portal.
- Consumir `@workspace/api-client`; Web no accede a PostgreSQL, Redis ni secretos.
- Antes de editar una API de Next, leer la guía concreta de la versión instalada bajo `node_modules/next/dist/docs/`.
