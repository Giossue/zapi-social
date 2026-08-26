# Landing dentro de apps/web

## Decisión

El sitio público de marketing deja de ser una aplicación independiente en Dokploy y pasa a vivir dentro de `apps/web`, como grupo de rutas `(marketing)`. Dokploy queda con tres aplicaciones —API, Web y Worker— en vez de cuatro.

El origen es el repositorio `../landing-zapi-social` (plantilla `vetra`, Next 15.1.4 + Tailwind 3). Su historial no se traslada: el código se porta y ese repositorio queda archivado.

## Por qué

La separación no aportaba ningún límite real y sí tres costes:

- La landing salía a internet (`ZAPI_API_ORIGIN=https://api.zapisocial.com`) para pintar planes, FAQs y páginas estáticas que la propia plataforma ya sirve.
- Los CTA cruzaban dominio (`NEXT_PUBLIC_APP_URL`), así que cada enlace al panel era absoluto y dependía de una variable.
- Cualquier cambio compartido —un token, un icono, el logo— había que hacerlo dos veces, en dos repositorios con dos versiones de Next y de Tailwind.

Dentro de `apps/web` las tres desaparecen: la API se consume por la red interna, los CTA son enlaces relativos y hay un solo sitio donde tocar.

## Dominios

Se conservan los dos dominios y su significado actual. Ambos apuntan a la misma aplicación Web de Dokploy.

| Dominio              | Sirve                                                             |
| -------------------- | ----------------------------------------------------------------- |
| `zapisocial.com`     | **Solo la landing**: `/`, `/blog`, `/blog/[slug]`, `/[slug]`      |
| `app.zapisocial.com` | Portal y Admin; `/` redirige a `/portal/dashboard` o `/login`     |

El apex no sirve el panel. `/login`, `/register`, `/portal/*`, `/admin/*` y `/setup` redirigen a `app.zapisocial.com` conservando la ruta. Sin esa separación el login quedaba accesible en dos dominios y el widget de Turnstile fallaba en el apex, porque su lista de hosts autorizados solo tiene `app.`.

La distinción vive en `apps/web/proxy.ts` como regla por host, gobernada por la variable `PORTAL_HOST`. Si esa variable falta, todos los hosts sirven la landing en `/`: es lo correcto en local y lo que rompería producción si se olvida en Dokploy.

`COOKIE_DOMAIN=.zapisocial.com` **sigue haciendo falta**. Landing y panel comparten contenedor pero no host, así que los CTA «Ir al panel» solo detectan la sesión desde el apex si la cookie abarca el dominio raíz.

## Dónde queda cada cosa

```text
apps/web/app/(marketing)/          rutas: /, /blog, /blog/[slug], /[slug]
apps/web/features/marketing/       componentes, constantes y adaptadores del sitio público
apps/web/public/marketing/         imágenes e iconos propios de la landing
apps/web/public/fonts/             Satoshi (woff2 local)
packages/ui/src/styles/globals.css capa .marketing
```

`apps/web/app/page.tsx` se elimina: su redirección a `/login` o `/portal/dashboard` pasa a la regla por host de `proxy.ts`, porque dos páginas no pueden resolver la misma ruta `/`.

## Datos

El cliente a mano `src/lib/zapi.ts` de la landing **no se porta**. `@workspace/api-client` ya expone `publicSiteApi` (`overview`, `posts`, `post`, `page`) contra `/v1/public/site`, con los tipos `PublicSiteOverview`, `PublicSitePost`, `PublicSitePage` y `PublicSitePostsResponse` de `packages/contracts`. La landing pasa a consumir ese cliente, como cualquier otra superficie de Web.

Se conserva el comportamiento que sí era una decisión de producto: **si la API no responde, la sección cae a su contenido por defecto en vez de romper la página**. El sitio público no puede caerse por un fallo del backend.

## Divergencias frente a `docs/reglas/design.md`

`design.md` gobierna Portal y Admin: un solo tema, los tokens de `packages/ui`, sin tipografía ni keyframes locales. El sitio público es otra superficie —no operativa, con identidad de marca propia— y necesita tres cosas que esa tabla no contempla:

1. **Tipografía propia**: Satoshi para titulares e Instrument Serif para los énfasis en cursiva.
2. **Animaciones propias**: `orbit`, `ripple`, `blob`, `image-glow`, `flip`, `rotate`.
3. **Paleta propia**: fondo casi negro (`#09090b`) y cards más oscuras que el lienzo, al revés que en producto.

Se resuelve declarando todo eso en `packages/ui/src/styles/globals.css` bajo el ámbito `.marketing`, que solo aplica el layout del grupo de rutas. Portal y Admin no ven ninguna de estas declaraciones y sus tokens no cambian. Ninguna feature de producto puede usar la capa `.marketing`.

`Sheet` y `Accordion` sí se unifican: la landing usa los de `@workspace/ui` y se elimina la copia de shadcn que arrastraba la plantilla.

El **botón no**. Se intentó unificar y rompió todos los CTA de la página: el `size="lg"` de producto es `h-10 px-2.5` —un control compacto de panel— frente al `h-10 px-8` de la plantilla, y el primitive de V2 no tiene ni el desplazamiento al pasar el ratón, ni el anillo, ni la variante `white` que usan las tarjetas de precios. Un botón de marketing y uno de panel no son el mismo rol visual. `features/marketing/components/button.tsx` conserva las variantes y tamaños de la plantilla y solo lo usa esta superficie.

## Migración Tailwind 3 → 4

`tailwind.config.ts` desaparece; su contenido se traduce a CSS. Clases de la plantilla que Tailwind 4 ya no reconoce y hay que sustituir:

| Clase de la plantilla | Sustitución    |
| --------------------- | -------------- |
| `max-w-screen-xl`     | `max-w-7xl`    |
| `blur-sm`             | `blur-xs`      |
| `outline-none`        | `outline-hidden` |
| `scrollbar-hide`      | declarada en la capa `.marketing` |
| `!leading-snug`       | `leading-snug!`                   |
| `top-1/8`             | `top-[12.5%]`                     |

La escala `spacing: {"1/8": "12.5%"}` de la plantilla solo la usaban tres clases del hero y del CTA, así que se sustituyen por valores arbitrarios en vez de arrastrar la extensión al tema.

## Textos

Todo el texto del sitio público se migra a `next-intl` en este mismo cambio, bajo el espacio de nombres `marketing` en `packages/contracts/src/messages/{es,en}.json`. No es opcional: `audit:i18n-hardcoded` prohíbe cualquier literal en posición de presentación, así que una landing con texto incrustado no pasaría el cierre.

El sitio público no tiene sesión, de modo que el idioma sale de la cookie `zapi_locale` cuando existe y del idioma por defecto cuando no. El mecanismo es el descrito en [`conocimiento/i18n.md`](../conocimiento/i18n.md); esta vertical no lo altera.

## Lo que se corrigió al portar

Cinco cosas de la plantilla no se copiaron tal cual porque estaban mal:

- **Planes inventados de respaldo.** `PLANS` traía dos planes con precios ficticios (29 $ y 79 $) que se mostraban cuando la API no respondía. Enseñar precios falsos es peor que no enseñar la sección: ahora el bloque de precios no se renderiza sin planes reales, igual que ya hacía el de preguntas. La garantía de «la landing nunca se cae» se mantiene; no exigía inventarse las cifras.
- **Enlaces legales a páginas inexistentes.** El pie enlazaba a `/privacy-policy` y `/terms-of-use` cuando el Admin no había publicado ninguna página. Eran dos 404 garantizados. La columna Legal ahora solo lista páginas publicadas.
- **El destacado de plan nunca se activaba.** Comparaba `plan.title === "Mastermind"`, un nombre de la plantilla que ningún plan de Zapi tiene. Ahora usa el campo `featured` que ya publica la API.
- **Moneda fija.** El precio se formateaba siempre en USD ignorando `plan.currency`.
- **Un `<button>` decorativo** en el hero, sin acción ni rótulo, y el logo SVG con `role="img"` compitiendo con el texto contiguo. Ahora son un `div` y un icono decorativo.

## Contenido heredado que queda pendiente

Material de relleno de la plantilla que sí se porta tal cual, para no mezclar la fusión con un cambio de contenido. **No es contenido real de Zapi** y conviene revisarlo por separado; ahora está en el catálogo de mensajes, así que cambiarlo es editar `es.json` y `en.json`:

- `Analysis` muestra cifras inventadas (12.834 $, +25 % respecto al mes pasado, campañas «Ventas/Correos/Anuncios») presentadas como si fueran un panel real.
- `Companies` afirma «Con la confianza de leading brands» sobre logotipos de empresas ajenas incluidos en la plantilla.
- Los énfasis en cursiva son palabras en inglés dentro de una página en español: «made simple», «your needs», «dashboard», «languages».

## Deuda aceptada

`features/marketing/components/particles.tsx` conserva un `eslint-disable react-hooks/exhaustive-deps`. Es código de canvas vendorizado cuyos `useEffect` dependen a propósito solo de `color` y `refresh`; añadir las funciones a sus arrays reinicializaría el lienzo en cada render. Se reordenaron las declaraciones para eliminar los avisos de acceso antes de declarar, que sí eran reales.

## Dokploy

1. Añadir `zapisocial.com` (y `www`) como dominio de la aplicación **Web**, con certificado HTTPS.
2. Comprobar que la landing responde en ese dominio y que `app.zapisocial.com` sigue entrando al panel.
3. Eliminar la aplicación **landing**.
4. Retirar de Web las variables que ya no usa nadie: `ZAPI_API_ORIGIN`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_AUTHOR_NAME`.

Los Watch Paths de Web no cambian: la landing vive dentro de `apps/web/**`.

## Estado

- [x] Assets, capa `.marketing` y componentes portados
- [x] Rutas `(marketing)` y regla por host
- [x] Texto migrado a `next-intl` (97 claves en `es` y `en`)
- [x] Validación ejecutada
- [ ] Dominio movido en Dokploy y aplicación landing eliminada

### Evidencia de validación

Ejecutado sobre esta rama:

```text
bun run build                 6/6 tareas; rutas /, /blog, /blog/[slug], /[slug]
bun run typecheck             8/8 tareas
bun run lint                  0 errores, 0 avisos
bun run audit:i18n            4582 claves sincronizadas
bun run audit:i18n-hardcoded  sin texto de interfaz en el código
bun run audit:portal-admin-ui sin hallazgos
podman build -f Dockerfile.web
```

Sobre el contenedor, con `PORTAL_HOST=app.example.com` e `INTERNAL_API_ORIGIN`
apuntando a un puerto muerto:

| Petición                       | Resultado                          |
| ------------------------------ | ---------------------------------- |
| `/` con `Host: example.com`     | 200, landing completa sin API      |
| `/` con `Host: app.example.com` | 307 a `/login`                     |
| `/blog`                        | 200                                |
| `/login`                       | 200                                |
| `/portal/dashboard` sin sesión | 307                                |

`PORTAL_HOST` solo se definió al arrancar el contenedor, no al construir la
imagen: la regla por host se resuelve en tiempo de ejecución.

En el CSS servido se comprobó que `.marketing` declara sus propios
`--background`, `--card` y `--font-sans`, que las utilidades `animate-orbit`,
`animate-ripple`, `animate-image-glow` y `font-subheading` se generan, y que
`.dark` de producto no cambia. `/login` no lleva la clase `marketing`.

Falta la aprobación visual del usuario y el paso de dominios en Dokploy.
