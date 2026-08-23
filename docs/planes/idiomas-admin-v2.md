# Idiomas desde Admin V2

## Estado

**Investigación cerrada el 23 de agosto de 2026; implementación sin empezar.**
Hoy V2 resuelve los idiomas con archivos JSON tipados y el catálogo cerrado en
`packages/contracts` ([`conocimiento/i18n.md`](../conocimiento/i18n.md)). Añadir
ruso exige tocar siete sitios del código. Para un producto que se vende, el
comprador tiene que poder hacerlo desde el panel.

## Cómo lo hace ZapiSocial

### Dos tablas y una idea

```sql
languages            -- name, native_name, code, icon, direction,
                     -- is_default, is_active, auto_translate, sort_order
language_translations -- language_code, key, value, is_custom
                      -- unique(language_code, key)
```

La idea que hace que funcione: **los archivos son la base y la base de datos es
la capa de encima**. `DatabaseTranslationLoader` envuelve al cargador de
archivos de Laravel y fusiona los `overrides` guardados:

```php
public function load($locale, $group, $namespace = null): array
{
    $lines = $this->inner->load($locale, $group, $namespace);

    if ($group === '*' && $namespace === '*') {
        return array_replace($lines, $this->catalog->overridesForLocale($locale));
    }

    return $lines;
}
```

Ni el código de la aplicación ni las vistas se enteran. Siguen llamando a
`__('…')`.

### Las piezas

| Pieza                        | Qué hace                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| `TranslationScanner`          | Recorre el código buscando `__('…')` y escribe `lang/{locale}.json`      |
| `TranslationCatalog`          | Fusiona base + idioma + overrides, pagina, busca, importa y exporta      |
| `LanguageMaintenanceService`  | Al crear un idioma, escanea, traduce y escribe su archivo                |
| `GoogleTranslationService`    | Traduce por lotes de 4.000 caracteres protegiendo los marcadores         |
| `WorldLanguageCatalog`        | **133 idiomas** con código, nombre y nombre nativo                       |
| `LocaleManager`               | Resuelve: ruta → sesión → cookie → `user.locale` → opción → por defecto  |

Dos detalles bien resueltos que conviene copiar:

- **Solo se guarda lo que difiere.** Si el texto editado vuelve a coincidir con
  el original, la fila del override se borra. La tabla no acumula ruido.
- **Se protegen los marcadores al traducir.** Cada `:name` se sustituye por una
  marca antes de mandar el texto a Google y se restaura después. Sin eso, el
  traductor se come las variables.

## Lo que **no** se puede copiar tal cual

**ZapiSocial escribe archivos en disco.** `LanguageMaintenanceService` hace
`writeJson(lang_path("{$code}.json"))` al crear un idioma. En Laravel sobre
hosting compartido eso es normal; el directorio es persistente.

**En V2 no lo es.** La web corre en un contenedor Docker construido desde una
imagen. Un archivo escrito en tiempo de ejecución desaparece en el siguiente
despliegue, y con varias réplicas ni siquiera lo ven todas. Un idioma añadido
por el comprador se perdería sin avisar.

Conclusión: en V2 **todo el contenido de un idioma nuevo vive en PostgreSQL**.
Los archivos siguen siendo la base de `es` y `en`, que son los que se entregan
tipados con el producto.

## Diseño para V2

### Las dos capas

```text
messages/es.json, messages/en.json   → base, tipada, viaja con el producto
workspace/plataforma en PostgreSQL   → idiomas añadidos y textos editados
```

`apps/web/i18n/request.ts` ya carga el JSON del idioma activo. Pasa a:

1. Cargar el JSON base del idioma fuente (`es`).
2. Si el idioma activo es `es` o `en`, cargar su JSON.
3. Pedir a la API los `overrides` del idioma activo y fusionarlos encima.

Los mensajes se piden una vez por render de servidor y se cachean en Redis por
idioma, con invalidación al guardar. Es la misma estrategia de
`TranslationCatalog::overridesForLocale`, que cachea *para siempre* y borra la
clave al guardar.

### Tablas nuevas

Mismo modelo que Laravel, adaptado a los nombres de V2:

```text
platform_languages
  code (pk, varchar 12), name, native_name, direction ('ltr'|'rtl'),
  is_default, is_active, auto_translate, sort_order, timestamps

platform_translations
  language_code, key (varchar 512), value (text), timestamps
  unique(language_code, key)
```

`key` es más larga que en Laravel porque las claves de V2 son rutas anidadas
(`boards.priority.high`), no frases.

### Lo que cambia respecto a Laravel, y por qué

**El tipado no se pierde.** `es.json` sigue siendo la fuente tipada en tiempo de
desarrollo: `createMessagesDeclaration` y `global.d.ts` no se tocan. Un idioma
añadido desde el panel es **dato**, no código, y no participa del tipado. Eso es
correcto: nadie escribe `t("clave")` contra un idioma que no existe al compilar.

**El escáner sobra.** Laravel necesita `TranslationScanner` porque sus claves
son las propias frases repartidas por el código. V2 ya tiene el catálogo
completo y ordenado en `es.json`, y dos auditores que garantizan que está
sincronizado y que no queda texto suelto. La lista de claves a traducir es,
literalmente, `es.json`.

**ICU en vez de `:marcadores`.** Al traducir automáticamente hay que proteger
`{name}`, `{count, plural, …}` y `{n, number}`, que son más frágiles que un
`:name`. Y al guardar una edición manual hay que **rechazar el texto cuyos
argumentos ICU no coincidan con los del original**. El repositorio ya tiene esa
comprobación en `scripts/audit_i18n_messages.py`; la misma regla debe correr en
la API al guardar, no solo en CI.

**RTL de verdad.** `direction` no basta con guardarlo: hay que poner
`dir={direction}` en el `<html>` y repasar los primitives. Es trabajo real de
UI y merece su propia fase.

## Pantalla de Admin

Dos vistas, calcadas en intención a las de ZapiSocial:

1. **Idiomas.** Tabla con bandera, nombre, código, dirección, activo, por
   defecto y progreso de traducción. Alta desde el catálogo mundial de 133
   idiomas, con un interruptor de «traducir automáticamente».
2. **Traducciones.** Buscador sobre las claves del idioma fuente, con el texto
   original al lado del traducido, edición en línea y un filtro de «solo sin
   traducir». Importar y exportar JSON para quien prefiera trabajar fuera.

El botón de «rellenar lo que falta» es el que más se usa: recorre las claves
del idioma fuente que no tienen valor y las traduce en lote.

### Traducción automática

ZapiSocial usa la librería `stichoza/google-translate-php`, que raspa el
endpoint público de Google Translate. Es gratis y funciona, pero no tiene
acuerdo de servicio y se rompe cuando Google cambia algo.

Para un producto que se vende conviene que el proveedor sea **configurable**,
con la misma forma que ya usa AI Studio para sus modelos: el comprador pone su
clave de Google Cloud Translation, DeepL o el proveedor de IA que ya tenga
configurado. Y sin clave, el idioma se crea igual, solo que vacío y se rellena
a mano.

## Fases

### Fase 1 — Datos y fusión

- [ ] `platform_languages` y `platform_translations` con su migración.
- [ ] Endpoint de catálogo de idiomas activos, público, cacheado.
- [ ] `i18n/request.ts` fusionando base + overrides, con caché en Redis.
- [ ] Selector de idioma del perfil alimentado por la API en vez de por la
      unión fija `"es" | "en"`.

### Fase 2 — Admin

- [ ] Pantalla de idiomas con el catálogo mundial de 133.
- [ ] Pantalla de traducciones con buscador, edición y filtro de faltantes.
- [ ] Validación de argumentos ICU al guardar, con el mismo criterio que el
      auditor.
- [ ] Importar y exportar JSON.

### Fase 3 — Traducción automática

- [ ] Proveedor configurable, con la clave cifrada como el resto.
- [ ] Traducción por lotes protegiendo los marcadores ICU.
- [ ] Acción de «rellenar lo que falta».

### Fase 4 — RTL

- [ ] `dir` en el documento según el idioma activo.
- [ ] Repaso de primitives y de las pantallas con tablas y calendario.

## Riesgos

- **La fusión está en el camino crítico de cada render.** Si la caché falla, el
  Portal se queda sin texto. La API debe devolver el catálogo base aunque la
  tabla de overrides no responda, igual que hace `TranslationCatalog` cuando
  falla la caché.
- **Un idioma a medio traducir se ve peor que uno ausente.** El respaldo debe
  ser la clave del idioma fuente, nunca la clave cruda en pantalla.
- **`platform_translations` crece con las claves × idiomas.** Con 4.000 claves y
  diez idiomas son 40.000 filas: nada para PostgreSQL, pero la pantalla de
  traducciones tiene que paginar desde el primer día.
