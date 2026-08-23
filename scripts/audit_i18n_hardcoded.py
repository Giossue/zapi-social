#!/usr/bin/env python3
"""Encuentra texto de interfaz escrito directamente en el código de `apps/web`.

`audit:i18n` comprueba que los idiomas tengan las mismas claves, pero no ve una
superficie que nunca se migró: si el texto sigue en el `.tsx`, los dos catálogos
están sincronizados y el auditor pasa. Este hueco fue real —el plan dio el
Portal por terminado con Marca de agua e Integraciones sin migrar— y esto lo
cierra.

Regla: en una posición de presentación (nodo JSX, prop de rótulo, `toast.*`)
no debe haber ningún literal, sea del idioma que sea. Buscar marcas del
español no basta: «Guardar perfil» o «canales» no llevan acento ni palabra
funcional, así que una heurística por idioma los deja pasar —y así se
escaparon hasta que el usuario los vio en pantalla—.

Lo único permitido son nombres propios y valores técnicos, en `ALLOWED`. Los
datos de ejemplo de `fixtures/` quedan fuera a propósito: son contenido del
mock, no interfaz.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

# `packages/ui` también pinta texto en pantalla. Dejarlo fuera escondió el
# rango de la paginación —«1-1 de 1»— hasta que se vio en el navegador: los
# primitives no traducen, así que cualquier literal suyo es un error de diseño.
SCANNED = (ROOT / "apps/web", ROOT / "packages/ui/src")

# Rutas cuyo texto no es interfaz traducible. `.next` es salida de compilación:
# sus tipos generados no son código de este repositorio.
EXCLUDED_PARTS = ("node_modules", "/.next/", "/fixtures/", "/messages/")
EXCLUDED_SUFFIXES = (".d.json.ts",)

# Nombres propios, marcas y valores técnicos que no se traducen.
ALLOWED = re.compile(
    r"^(Meta|Instagram|Facebook|LinkedIn|WhatsApp[\w ]*|Polar\.sh|Google Drive"
    r"|PostgreSQL|Redis|Node\.js|Sandbox|Webhook|Timeout|Reply-to|Slug|MRR|API"
    r"|OAuth Client ID|Organization Access Token|Prompt|Zapi Social|drive\.file"
    # Nombres de campo de proveedores externos y ejemplos técnicos: se
    # muestran igual en cualquier idioma.
    r"|Browser API Key|App ID|Cloudflare Turnstile|Runtime|Web|Worker"
    r"|G-X+|smtp\.example\.com|Host SMTP|Zapi Social|KB|MB|GB|ms|px"
    r"|Promise|[\W\d]+)$"
)

# Rótulos accesibles que shadcn/ui trae en su código y que se copian literal
# por la regla source-first. No los pone este repositorio; cambiarlos aquí
# haría divergir los primitives de su fuente en cada actualización.
SHADCN_DEFAULTS = frozenset({
    "Close", "Loading", "More", "More pages", "Toggle Sidebar", "Sidebar",
    "Displays the mobile sidebar.", "Previous slide", "Next slide", "slide",
    "carousel", "breadcrumb", "pagination", "Go to previous page",
    "Go to next page", "Command Palette", "Search for a command to run...",
})

# Fragmentos de código que las expresiones capturan por error: genéricos de
# TypeScript (`Promise<...>`), cuerpos de flecha y condicionales sueltos caen
# dentro del patrón de nodo JSX porque también van entre `>` y `<`.
CODE_NOISE = re.compile(
    r"=>|===|\|\||&&|\breturn\b|\bif\s*\(|\bconst\b|\bexport\b"
    r"|\bimport\b|\btype\b|\bPromise\b|\bParameters\b|\bReact\."
    r"|\bcopy\.|[();{}]|:\s"
)

LABEL_PROPS = (
    "placeholder|aria-label|ariaLabel|label|title|description|helper|alt"
    "|itemLabel|successMessage|emptyTitle|emptyDescription|createLabel"
    "|searchPlaceholder|formDescription|sheetDescription"
)

PATTERNS = (
    # Prop de rótulo con texto literal.
    re.compile(rf'(?:{LABEL_PROPS})\s*[:=]\s*"([^"]+)"'),
    # Nodo de texto dentro de JSX. Sin mínimo de longitud: «Tú» es texto de
    # interfaz igual que una frase, y poner un suelo dejaba fuera justo las
    # palabras cortas —que son las más frecuentes en botones y distintivos—.
    re.compile(r">\s*([A-Za-zÁÉÍÓÚÑáéíóúñ¿¡][^<>{}\n]*)\s*<"),
    # Aviso al usuario.
    re.compile(r'toast\.(?:success|error|info)\(\s*"([^"]+)"'),
    # Nodo de texto en su propia línea. Prettier parte el JSX cuando el botón
    # lleva un icono condicional, y entonces el rótulo no comparte línea con
    # `>` ni con `<`: así se quedaron sin migrar «Generar QR» y una veintena
    # más de botones de acción.
    re.compile(r"[>}]\n\s*([A-Za-zÁÉÍÓÚÑáéíóúñ¿¡][^<>{}\n]*?)\s*\n\s*<"),
)

# Plantilla con interpolación: `Acciones de ${name}`. Va aparte porque hay que
# sustituir los `${...}` antes de juzgar el texto —si no, los paréntesis de
# dentro lo hacen pasar por código—.
TEMPLATE = re.compile(r"`([^`\n]*\$\{[^`\n]*)`")
INTERPOLATION = re.compile(r"\$\{[^{}]*\}")


# Utilidades de Tailwind que se escriben sin sufijo. Una lista de clases suele
# delatarse por el guion —`text-sm`, `w-full`—, pero `absolute flex` no tiene
# ninguno y también es código.
BARE_UTILITIES = frozenset({
    "absolute", "relative", "fixed", "sticky", "static", "block", "inline",
    "flex", "grid", "hidden", "truncate", "italic", "underline", "rounded",
    "border", "uppercase", "lowercase", "capitalize", "container", "isolate",
})

CLASS_TOKEN = re.compile(r"^…$|^-?[a-z][\w./%\[\]-]*(?::-?[a-z][\w./%\[\]-]*)*$")


def is_class_list(value: str) -> bool:
    """Distingue una lista de clases de Tailwind de una frase."""
    tokens = value.split()
    if not all(CLASS_TOKEN.match(token) for token in tokens):
        return False
    return any(
        token in BARE_UTILITIES or "-" in token or "/" in token
        for token in tokens
    )


def is_ui_text(value: str) -> bool:
    value = value.strip()
    if not value or value.startswith(("http", "/", "#")):
        return False
    # Códigos de error y constantes técnicas.
    if re.fullmatch(r"[A-Z_0-9]+", value):
        return False
    if value in SHADCN_DEFAULTS:
        return False
    # Clases de Tailwind en objetos de configuración.
    if is_class_list(value):
        return False
    # Una plantilla cuya única parte fija es una marca —`${title} - Zapi Social`—
    # no tiene nada que traducir.
    if value.count("…") and ALLOWED.match(value.replace("…", " ").strip(" -·|")):
        return False
    return not (ALLOWED.match(value) or CODE_NOISE.search(value))


def template_hits(source: str) -> list[tuple[int, str]]:
    hits = []
    for match in TEMPLATE.finditer(source):
        line_start = source.rfind("\n", 0, match.start()) + 1
        prefix = source[line_start : match.start()].lstrip()
        # Los comentarios citan nombres de componentes entre acentos graves, y
        # `console.*` escribe para quien depura, no para quien usa el producto.
        if prefix.startswith(("*", "//")) or "console." in prefix:
            continue
        # El argumento de `t()` es una clave, no texto: `t(`status.${state}`)`.
        if re.search(r"\bt[A-Za-z]*\(\s*$", prefix):
            continue
        value = INTERPOLATION.sub("…", match.group(1)).strip()
        # Sin espacio es un identificador compuesto: una ruta, un `id` de DOM o
        # una clave de traducción construida.
        if " " not in value:
            continue
        if not re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}", value):
            continue
        if is_ui_text(value):
            hits.append((source[: match.start()].count("\n") + 1, value))
    return hits


def scan(path: Path) -> list[tuple[int, str]]:
    source = path.read_text()
    found: dict[int, str] = {}
    for pattern in PATTERNS:
        for match in pattern.finditer(source):
            value = match.group(1).strip()
            if not is_ui_text(value):
                continue
            line = source[: match.start()].count("\n") + 1
            found.setdefault(line, value)
    for line, value in template_hits(source):
        found.setdefault(line, value)
    return sorted(found.items())


def files() -> list[Path]:
    return sorted(
        path
        for root in SCANNED
        for path in root.rglob("*.ts*")
        if not any(part in str(path) for part in EXCLUDED_PARTS)
        and not path.name.endswith(EXCLUDED_SUFFIXES)
    )


# Casos que el detector debe acertar. Sus límites ya fallaron dos veces —una
# heurística por idioma y un mínimo de longitud—, y en ambas el hueco solo se
# vio en pantalla. Esto lo convierte en un fallo del comando.
SELF_TEST = (
    ("<Badge>Tú</Badge>", "Tú"),
    ("<Button>Ver</Button>", "Ver"),
    ("<p>Guardar perfil</p>", "Guardar perfil"),
    ('itemLabel="canales"', "canales"),
    ('label="Tú"', "Tú"),
    ('toast.error("Falló")', "Falló"),
    ('<Badge>{t("you")}</Badge>', None),
    ("<CardTitle>Meta</CardTitle>", None),
    ("      ) : null}\n      Generar QR\n    </Button>", "Generar QR"),
    ("      >\n        Guardar cambios\n      </Button>", "Guardar cambios"),
    ('aria-label={`Acciones de ${name}`}', "Acciones de …"),
    ('aria-label={t("rowActions", { name })}', None),
    ('className={`flex ${size} items-center`}', None),
    ('className={`absolute ${side}`}', None),
    ('t(`status.${row.state}`)', None),
    ('aria-label={`Quitar ${name}`}', "Quitar …"),
    ('`${done} de ${total} completados.`', "… de … completados."),
    ('<title>{`${title} - Zapi Social`}</title>', None),
)


def self_test() -> list[str]:
    """Comprueba el detector contra casos conocidos; devuelve los que fallan."""
    failures = []
    for source, expected in SELF_TEST:
        found = [
            value
            for pattern in PATTERNS
            for match in pattern.finditer(source)
            if is_ui_text(value := match.group(1).strip())
        ] + [value for _, value in template_hits(source)]
        ok = expected in found if expected else not found
        if not ok:
            failures.append(f"{source} -> {found}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--detail",
        action="store_true",
        help="Lista cada cadena con su línea en vez del resumen por archivo.",
    )
    args = parser.parse_args()

    broken = self_test()
    if broken:
        print("i18n: el detector no reconoce sus propios casos:", file=sys.stderr)
        for case in broken:
            print(f"  {case}", file=sys.stderr)
        return 1

    findings = [(path, scan(path)) for path in files()]
    findings = [(path, hits) for path, hits in findings if hits]

    if not findings:
        print("i18n: sin texto de interfaz escrito en el código.")
        return 0

    total = sum(len(hits) for _, hits in findings)
    findings.sort(key=lambda item: len(item[1]), reverse=True)

    print(
        f"i18n: {total} cadenas sin migrar en {len(findings)} archivos.",
        file=sys.stderr,
    )
    for path, hits in findings:
        relative = path.relative_to(ROOT)
        print(f"  {len(hits):>3}  {relative}", file=sys.stderr)
        if args.detail:
            for line, value in hits:
                print(f"       {relative}:{line}  {value}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
