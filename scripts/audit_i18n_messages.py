#!/usr/bin/env python3
"""Comprueba que cada idioma traduzca exactamente las claves del idioma fuente.

El tipado de `next-intl` solo cubre el idioma fuente (`es.json`): una clave que
falte en otro idioma no rompe el typecheck y solo se nota en pantalla. Este
auditor cierra ese hueco antes de cerrar un cambio.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MESSAGES = ROOT / "apps/web/messages"
SOURCE_LOCALE = "es"


def flatten(node: dict, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    for key, value in node.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            keys |= flatten(value, f"{path}.")
        else:
            keys.add(path)
    return keys


def load(locale: str) -> set[str]:
    return flatten(json.loads((MESSAGES / f"{locale}.json").read_text("utf-8")))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fail-on-findings", action="store_true")
    arguments = parser.parse_args()

    source = load(SOURCE_LOCALE)
    findings: list[str] = []

    for path in sorted(MESSAGES.glob("*.json")):
        locale = path.stem
        if locale == SOURCE_LOCALE:
            continue
        keys = load(locale)
        for key in sorted(source - keys):
            findings.append(f"{locale}: falta «{key}»")
        for key in sorted(keys - source):
            findings.append(f"{locale}: sobra «{key}» (no existe en {SOURCE_LOCALE})")

    if not findings:
        print(f"i18n: {len(source)} claves sincronizadas en todos los idiomas.")
        return 0

    for finding in findings:
        print(finding)
    print(f"i18n: {len(findings)} hallazgos.")
    return 1 if arguments.fail_on_findings else 0


if __name__ == "__main__":
    sys.exit(main())
