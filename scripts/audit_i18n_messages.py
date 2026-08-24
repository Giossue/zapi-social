#!/usr/bin/env python3
"""Comprueba la paridad de claves entre idiomas y los prefijos dinámicos.

El tipado de `next-intl` solo cubre el idioma fuente (`es.json`): una clave que
falte en otro idioma no rompe el typecheck y solo se nota en pantalla. Este
auditor cierra ese hueco antes de cerrar un cambio.

También revisa las claves construidas en tiempo de ejecución
(``t(`status.${row.statusKey}`)``). El tipado no puede comprobarlas —el valor
llega de la API o de un catálogo—, así que se verifica que su prefijo exista y
sea un grupo: eso caza la clase de error real que ha aparecido, que es apuntar
al espacio de nombres equivocado.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MESSAGES = ROOT / "packages/contracts/src/messages"
WEB = ROOT / "apps/web"
SOURCE_LOCALE = "es"

# Un argumento es `{nombre}` o `{nombre, tipo, …}`; nunca una rama de plural.
ICU_ARGUMENT = re.compile(r"\{(\w+)\s*[,}]")
ICU_KIND = re.compile(r"\{\w+\s*,\s*(\w+)")

# La variable importa: un archivo puede declarar `t`, `tOps` y `tCommon` a la
# vez, y quedarse con el último espacio declarado resuelve mal las claves.
NAMESPACE = re.compile(
    r'const (\w+) = useTranslations(?:<[^>]*>)?\("([^"]+)"\)'
)
DYNAMIC_KEY = re.compile(r"\b(\w+)\(`([^`]*)`")


def flatten(node: dict, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    for key, value in node.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            keys |= flatten(value, f"{path}.")
        else:
            keys.add(path)
    return keys


def read(locale: str) -> dict:
    return json.loads((MESSAGES / f"{locale}.json").read_text("utf-8"))


def flat_values(locale: str) -> dict:
    """Claves aplanadas con su texto, para comparar mensajes entre idiomas."""
    values: dict[str, str] = {}

    def walk(node: dict, prefix: str = "") -> None:
        for key, value in node.items():
            path = f"{prefix}{key}"
            walk(value, f"{path}.") if isinstance(value, dict) else values.update(
                {path: value}
            )

    walk(read(locale))
    return values


def load(locale: str) -> set[str]:
    return flatten(read(locale))


def resolve(catalog: dict, path: str):
    node = catalog
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


def icu_findings(source: dict, locale: str, target: dict) -> list[str]:
    """Una traducción que pierde un argumento o cambia `plural` por texto plano
    compila igual y falla al renderizar. El tipado solo cubre el idioma fuente,
    así que esto se comprueba aquí."""
    findings: list[str] = []
    for key, value in source.items():
        other = target.get(key)
        if not isinstance(value, str) or not isinstance(other, str):
            continue
        if set(ICU_ARGUMENT.findall(value)) != set(ICU_ARGUMENT.findall(other)):
            findings.append(f"{locale}: «{key}» no usa los mismos argumentos")
        if sorted(ICU_KIND.findall(value)) != sorted(ICU_KIND.findall(other)):
            findings.append(f"{locale}: «{key}» cambia el tipo de formato ICU")
    return findings


def dynamic_prefix_findings(catalog: dict) -> list[str]:
    """Cada `t(`grupo.${valor}`)` debe apuntar a un grupo que exista."""
    findings: list[str] = []
    for path in sorted(WEB.rglob("*.ts*")):
        if "node_modules" in str(path) or "/messages/" in str(path):
            continue
        bindings: dict[str, str] = {}
        for number, line in enumerate(path.read_text("utf-8").split("\n"), 1):
            match = NAMESPACE.search(line)
            if match:
                bindings[match.group(1)] = match.group(2)
            for key in DYNAMIC_KEY.finditer(line):
                variable, value = key.group(1), key.group(2)
                namespace = bindings.get(variable)
                if "${" not in value or not namespace:
                    continue
                prefix = value.split("${")[0].rstrip(".")
                if not prefix:
                    continue
                node = resolve(catalog, f"{namespace}.{prefix}")
                where = f"{path.relative_to(ROOT)}:{number}"
                if node is None:
                    findings.append(
                        f"{where}: «{namespace}.{prefix}» no existe"
                    )
                elif not isinstance(node, dict):
                    findings.append(
                        f"{where}: «{namespace}.{prefix}» no es un grupo"
                    )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fail-on-findings", action="store_true")
    arguments = parser.parse_args()

    source = load(SOURCE_LOCALE)
    catalog = read(SOURCE_LOCALE)
    findings: list[str] = dynamic_prefix_findings(catalog)

    for path in sorted(MESSAGES.glob("*.json")):
        locale = path.stem
        if locale == SOURCE_LOCALE:
            continue
        keys = load(locale)
        findings.extend(icu_findings(flat_values(SOURCE_LOCALE), locale, flat_values(locale)))
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
