#!/usr/bin/env python3
"""Migra literales de interfaz a claves de `messages/`, reusando lo ya traducido.

Herramienta de un solo uso para la fase 2 de i18n. Toma los literales que
encuentra `audit_i18n_hardcoded`, y para cada uno:

1. resuelve el espacio de nombres activo en esa línea (`useTranslations(...)`);
2. si ese espacio ya tiene una clave con el mismo texto español, la reutiliza;
3. si el texto existe en otro espacio, copia el par es/en al espacio local;
4. si no existe en ningún sitio, lo deja para traducir a mano.

Solo reescribe el código en los casos 2 y 3, donde la traducción inglesa ya
está escrita y verificada. Los del caso 4 se listan para decidirlos uno a uno.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_i18n_hardcoded as audit  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
MESSAGES = ROOT / "packages/contracts/src/messages"

NAMESPACE = re.compile(r'const (\w+) = useTranslations\("([^"]+)"\)')

STOPWORDS = {"the", "a", "an", "of", "for", "with", "to", "in", "on", "and", "or"}


def flatten(node: dict, prefix: str = "") -> dict[str, str]:
    flat: dict[str, str] = {}
    for key, value in node.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            flat.update(flatten(value, f"{path}."))
        elif isinstance(value, str):
            flat[path] = value
    return flat


def slug(text: str) -> str:
    """Convierte un texto inglés en un nombre de clave en camelCase."""
    plain = "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )
    words = [w for w in re.findall(r"[A-Za-z0-9]+", plain.lower())]
    words = [w for w in words if w not in STOPWORDS] or words
    if not words:
        return "label"
    head, *rest = words[:3]
    return head + "".join(w.capitalize() for w in rest)


def namespace_at(lines: list[str], line: int) -> tuple[str, str] | None:
    """Último `useTranslations` declarado antes de esa línea: (variable, espacio)."""
    found = None
    for index, text in enumerate(lines[:line], start=1):
        match = NAMESPACE.search(text)
        if match:
            found = (match.group(1), match.group(2))
    return found


def set_key(node: dict, path: str, value: str) -> bool:
    """Escribe la clave salvo que pise un grupo o una traducción distinta."""
    parts = path.split(".")
    for part in parts[:-1]:
        node = node.setdefault(part, {})
        if not isinstance(node, dict):
            return False
    leaf = parts[-1]
    current = node.get(leaf)
    # Un grupo (`goal.engagement`) no puede convertirse en cadena: se perderían
    # sus hijos en silencio.
    if isinstance(current, dict):
        return False
    if isinstance(current, str) and current != value:
        return False
    node[leaf] = value
    return True


def sort_deep(value):
    if isinstance(value, dict):
        return collections.OrderedDict(
            sorted((k, sort_deep(v)) for k, v in value.items())
        )
    return value


def replacement(source: str, start: int, end: int, call: str) -> str:
    """Envuelve la llamada según dónde aparezca el literal."""
    before = source[:start].rstrip()
    if before.endswith(">"):          # nodo de texto JSX
        return "{" + call + "}"
    if before.endswith("="):          # prop de JSX
        return "{" + call + "}"
    return call                        # objeto o argumento de función


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Escribe los cambios.")
    parser.add_argument("--only", help="Limita a las rutas que contengan este texto.")
    args = parser.parse_args()

    catalogs = {
        locale: json.loads((MESSAGES / f"{locale}.json").read_text())
        for locale in ("es", "en")
    }
    flat_es = flatten(catalogs["es"])
    flat_en = flatten(catalogs["en"])
    by_text: dict[str, list[str]] = collections.defaultdict(list)
    for key, value in flat_es.items():
        by_text[value.strip()].append(key)

    reused = added = manual = 0
    pending: list[tuple[str, int, str]] = []

    for path in audit.files():
        if args.only and args.only not in str(path):
            continue
        source = path.read_text()
        lines = source.split("\n")
        edits: list[tuple[int, int, str]] = []

        for pattern in audit.PATTERNS:
            for match in pattern.finditer(source):
                text = match.group(1).strip()
                if not audit.is_ui_text(text):
                    continue
                line = source[: match.start()].count("\n") + 1
                scope = namespace_at(lines, line)
                if not scope:
                    pending.append((str(path), line, text))
                    manual += 1
                    continue
                variable, space = scope

                # Solo se reutiliza una clave del propio espacio y de primer
                # nivel: una anidada pertenece a otro contexto (un paso de
                # asistente no es la cabecera de una tabla) y acoplarlas haría
                # que cambiar una moviera la otra.
                local = [
                    k for k in by_text.get(text, [])
                    if k.startswith(f"{space}.")
                    and "." not in k[len(space) + 1:]
                ]
                if local:
                    key = local[0][len(space) + 1:]
                    reused += 1
                elif by_text.get(text):
                    origin = by_text[text][0]
                    english = flat_en.get(origin)
                    if english is None:
                        pending.append((str(path), line, text))
                        manual += 1
                        continue
                    # El nombre sale del inglés: las claves del repositorio son
                    # semánticas en inglés, no transliteraciones del español.
                    key = slug(english)
                    full = f"{space}.{key}"
                    if full in flat_es and flat_es[full] != text:
                        key = f"{key}Label"
                        full = f"{space}.{key}"
                    if not (
                        set_key(catalogs["es"], full, text)
                        and set_key(catalogs["en"], full, english)
                    ):
                        pending.append((str(path), line, text))
                        manual += 1
                        continue
                    flat_es[full] = text
                    flat_en[full] = english
                    by_text[text].append(full)
                    added += 1
                else:
                    pending.append((str(path), line, text))
                    manual += 1
                    continue

                call = f'{variable}("{key}")'
                edits.append((
                    match.start(1),
                    match.end(1),
                    replacement(source, match.start(1), match.end(1), call),
                ))

        if edits and args.apply:
            for start, end, value in sorted(edits, reverse=True):
                # El literal va entre comillas: se sustituyen también.
                left = start - 1 if source[start - 1] in "\"'" else start
                right = end + 1 if end < len(source) and source[end] in "\"'" else end
                source = source[:left] + value + source[right:]
            path.write_text(source)

    if args.apply:
        for locale, data in catalogs.items():
            target = MESSAGES / f"{locale}.json"
            target.write_text(
                json.dumps(sort_deep(data), ensure_ascii=False, indent=2) + "\n"
            )

    print(f"reutilizadas del mismo espacio: {reused}")
    print(f"copiadas de otro espacio:       {added}")
    print(f"sin traducción previa:          {manual}")
    if pending:
        print("\nPendientes de traducir a mano:")
        seen = set()
        for file, line, text in pending:
            if text in seen:
                continue
            seen.add(text)
            print(f"  {Path(file).name}:{line}  {text}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
