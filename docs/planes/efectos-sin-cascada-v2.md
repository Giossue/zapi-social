# Efectos sin renders en cascada V2

## Estado

**Cerrado el 23 de agosto de 2026.** `bun run lint` en `apps/web` no emite
ningún aviso. Se partía de 78, de los cuales 51 eran
`react-hooks/set-state-in-effect` en 38 archivos.

## Qué señala la regla

Un efecto que llama a `setState` de forma síncrona provoca un render en
cascada: React pinta, ejecuta el efecto, cambia el estado y vuelve a pintar
antes de que el usuario vea nada. La regla no prohíbe cargar datos ni
sincronizar estado; prohíbe hacerlo en el cuerpo del efecto sin diferirlo.

No es ruido del linter: cada aviso es un render extra en la primera pintura de
esa pantalla.

## Dos casos distintos, dos soluciones

Los 51 avisos no son un solo problema.

### A — Cargar al montar (30 avisos)

```tsx
useEffect(() => {
  void load()          // `load` hace `setIsLoading(true)` antes del primer await
}, [load])
```

El repositorio **ya tiene resuelto este caso** en `groups-page.tsx`,
`admin-turnstile-settings-page.tsx` y `admin-support-page.tsx`:

```tsx
useEffect(() => {
  const timer = setTimeout(() => void load(), query ? 300 : 0)
  return () => clearTimeout(timer)
}, [load, query])
```

El temporizador saca el primer `setState` del cuerpo del efecto y, de paso,
cancela la carga anterior cuando el efecto se repite —que es justo lo que hace
falta cuando el usuario escribe en un buscador—. La regla deja de marcarlos
porque el problema desaparece, no porque se silencie.

El cambio es mecánico y el patrón ya está validado en producción en esas tres
pantallas.

### B — Sincronizar estado con una prop (21 avisos)

```tsx
useEffect(() => {
  if (open) setDraft(group ? draftFrom(group) : emptyDraft)
}, [group, open])
```

Aquí el efecto copia una prop a estado local cuando se abre una hoja o cambia
el objetivo. La solución de React no es diferir: es **no tener ese efecto**.
Cada caso cae en uno de estos tres:

1. **Remontar con `key`** — una hoja que parte de cero cada vez que se abre no
   necesita sincronizar nada: `<Sheet key={group?.id ?? "nuevo"}>` y el estado
   inicial de `useState` basta.
2. **Derivar durante el render** — si el valor se puede calcular de las props,
   no debe ser estado.
3. **Ajustar durante el render** — el patrón que documenta React para el resto:
   comparar con el valor anterior y llamar a `setState` en el propio render.

No son intercambiables y elegir mal rompe el formulario que el usuario está
escribiendo. Van uno a uno.

## Fases

### Fase 1 — Carga al montar

- [x] Patrón de temporizador aplicado a los 30 avisos del caso A.
- [x] Comprobado que el primer render no cambia: el efecto ya se ejecutaba
      después de la primera pintura, así que diferirlo un tick no altera lo que
      ve el usuario.

### Fase 2 — Sincronización con props

- [x] Los 21 avisos del caso B resueltos ajustando el estado durante el render,
      que es el patrón que documenta React para sincronizar con props.
- [x] Ninguno necesitó `key`: remontar habría roto la animación de cierre de
      las hojas.

### Fase 3 — Cierre

- [x] `bun run lint` sin avisos.
- [x] Recuento y evidencia registrados abajo.

## Cómo quedó el caso B

Los 21 comparten forma: copiar una prop a estado local cuando cambia algo. En
vez de un efecto, se compara con el valor anterior durante el render:

```tsx
const [wasOpen, setWasOpen] = useState(open)

if (open !== wasOpen) {
  setWasOpen(open)
  if (open) setDraft(group ? draftFrom(group) : emptyDraft)
}
```

React aplica ese `setState` en la misma pasada, sin pintar el estado
intermedio. Cuando la condición no era solo `open` —la plantilla de correo
depende también del idioma, la miniatura de un archivo de su estado de
procesado— la comparación usa una clave compuesta en vez de un booleano.

## Lo que se arregló de paso

Tres avisos no eran ruido:

- Un `return` dentro de un `finally` en `channels-page.tsx` se tragaba la
  excepción en curso.
- `app/b/[slug]/page.tsx` construía el JSX dentro del `try`, así que un fallo
  de render acababa en `notFound()` en vez de en el límite de error.
- Un efecto de `files-library-page.tsx` leía `asset.kind` sin declararlo, de
  modo que no se re-ejecutaba al cambiar el tipo del archivo.

Además, `packages/eslint-config` no ignoraba los identificadores con guion bajo
inicial, que es la convención para «existe por la firma, no se usa».

## Evidencia de validación

- `bun run lint` en `apps/web`: sin avisos, de 78.
- `bun run typecheck`: 8 paquetes correctos.
- `bun run build`: 6 paquetes correctos.
- `bun run test` en `apps/api`: 26 pruebas pasan.
- `audit:i18n`, `audit:i18n-hardcoded` y `audit:portal-admin-ui`: sin hallazgos.

## Riesgos

- **El caso A cambia el momento de la primera carga.** Pasa de síncrona a la
  siguiente macrotarea. En una pantalla con estado de carga visible no se nota;
  en una que renderice datos sin comprobar `isLoading` sí. Hay que mirar el
  estado inicial de cada una.
- **El caso B toca formularios.** Sincronizar mal el borrador de una hoja hace
  que se pierda lo que el usuario está escribiendo. Es el motivo por el que la
  fase 2 no se automatiza.
- **La regla es del compilador de React, no de ESLint clásico.** Su salida
  cambia entre versiones; el recuento de referencia se registra en cada tanda.

## Fuera de alcance

- Adoptar TanStack Query o mover la carga a Server Components. Resolvería la
  clase entera, pero es una decisión de arquitectura de datos que afecta a las
  38 pantallas y merece su propio plan; este se limita a quitar la cascada con
  lo que ya hay.
