# packages/ui

Fuente única de tokens, primitives y patterns compartidos. No contiene lógica de dominio ni datos de features.

## Antes de editar

- Normas de tokens, variantes, elevación, color y composición: [`docs/reglas/design.md`](../../docs/reglas/design.md).
- Revisar [`COMPONENTS.md`](./COMPONENTS.md) antes de crear un componente: casi siempre ya existe.
- Un pattern sube aquí solo si su contrato es genérico y lo reutilizarán tres o más features.
- Añadir, quitar o promover un primitive obliga a actualizar su fila en `COMPONENTS.md` dentro del mismo cambio.
- `src/styles/globals.css` es el único sitio donde se definen `:root`, `.dark`, radios, sombras y tipografía.

## Antes de cerrar

```bash
bun run typecheck
```
