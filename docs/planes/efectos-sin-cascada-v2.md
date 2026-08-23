# Efectos sin renders en cascada V2

## Estado

Abierto el 23 de agosto de 2026. `bun run lint` en `apps/web` arrastra **51
avisos de `react-hooks/set-state-in-effect`** repartidos por 38 archivos. Son
el 96 % de los avisos que quedan tras limpiar el resto.

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

- [ ] Aplicar el patrón de temporizador a los 30 avisos del caso A.
- [ ] Comprobar en cada pantalla que la cancelación no rompe el buscador ni la
      paginación.

### Fase 2 — Sincronización con props

- [ ] Clasificar los 21 avisos del caso B en `key`, derivar o ajustar.
- [ ] Aplicarlos por tandas, empezando por los de `key`, que son los más
      seguros.

### Fase 3 — Cierre

- [ ] `bun run lint` sin avisos de `set-state-in-effect`.
- [ ] Registrar el recuento final y la evidencia.

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
