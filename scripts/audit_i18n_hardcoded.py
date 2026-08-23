#!/usr/bin/env python3
"""Encuentra texto de interfaz escrito directamente en el código de `apps/web`.

`audit:i18n` comprueba que los idiomas tengan las mismas claves, pero no ve una
superficie que nunca se migró: si el texto sigue en el `.tsx`, los dos catálogos
están sincronizados y el auditor pasa. Este hueco fue real —el plan dio el
Portal por terminado con Marca de agua e Integraciones sin migrar— y esto lo
cierra.

Heurística: una cadena es texto de interfaz cuando aparece en una posición de
presentación (nodo JSX, prop de rótulo, `toast.*`) y contiene una palabra
funcional española o una letra acentuada. Los datos de ejemplo de `fixtures/`
quedan fuera a propósito: son contenido del mock, no interfaz.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"

# Rutas cuyo texto no es interfaz traducible.
EXCLUDED_PARTS = ("node_modules", "/fixtures/", "/messages/")
EXCLUDED_SUFFIXES = (".d.json.ts",)

SPANISH_WORDS = re.compile(
    r"\b(el|la|los|las|un|una|de|del|para|con|sin|que|por|más|está|este|esta"
    r"|cada|todo|todos|todas|no|se|su|sus|al|y|o|en)\b",
    re.IGNORECASE,
)
ACCENTED = re.compile(r"[áéíóúñ¿¡]")

LABEL_PROPS = (
    "placeholder|aria-label|ariaLabel|label|title|description|helper"
    "|itemLabel|successMessage|emptyTitle|emptyDescription|createLabel"
    "|searchPlaceholder|formDescription|sheetDescription"
)

PATTERNS = (
    # Prop de rótulo con texto literal.
    re.compile(rf'(?:{LABEL_PROPS})\s*[:=]\s*"([^"]{{3,}})"'),
    # Nodo de texto dentro de JSX.
    re.compile(r">\s*([A-ZÁÉÍÓÚÑ¿][^<>{}\n]{3,})\s*<"),
    # Aviso al usuario.
    re.compile(r'toast\.(?:success|error|info)\(\s*"([^"]+)"'),
    # Cadena suelta que empieza como una frase.
    re.compile(r'(?<![\w.])"([A-ZÁÉÍÓÚÑ¿][^"]{4,})"'),
)


def is_ui_text(value: str) -> bool:
    value = value.strip()
    if not value or value.startswith(("http", "/", "#")):
        return False
    # Códigos de error y constantes técnicas.
    if re.fullmatch(r"[A-Z_0-9]+", value):
        return False
    return bool(ACCENTED.search(value) or SPANISH_WORDS.search(value))


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
    return sorted(found.items())


def files() -> list[Path]:
    return sorted(
        path
        for path in WEB.rglob("*.ts*")
        if not any(part in str(path) for part in EXCLUDED_PARTS)
        and not path.name.endswith(EXCLUDED_SUFFIXES)
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--detail",
        action="store_true",
        help="Lista cada cadena con su línea en vez del resumen por archivo.",
    )
    args = parser.parse_args()

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
