#!/usr/bin/env python3
"""Localiza tablas y columnas del schema Drizzle que el código no usa.

El typecheck no detecta una columna muerta: sigue existiendo en el tipo
inferido de la tabla, así que nadie tiene que leerla para que compile. Este
auditor cruza cada tabla y cada columna de ``packages/database/src/schema.ts``
con el resto del monorepo y reparte los hallazgos en tres niveles de certeza,
porque no todos los nombres se pueden buscar con la misma confianza:

- ``muerta``: ni el nombre camelCase ni el snake_case aparecen en ningún
  archivo fuera del schema. Es un hallazgo seguro.
- ``dudosa``: el nombre solo aparece en archivos que no tocan la tabla. Suele
  ser una colisión (``name``, ``status``, ``id`` viven en todas partes), pero a
  veces es uso real vía DTO. Hay que mirarlo.
- ``solo-schema``: la columna únicamente se menciona dentro del propio schema,
  en un índice, una constraint o una clave foránea. Existe para la base de
  datos, no para el producto.

Las migraciones y los artefactos de build quedan fuera del barrido: nombran
todas las columnas siempre y convertirían cualquier campo muerto en usado.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "packages/database/src/schema.ts"
SOURCES = [ROOT / "apps", ROOT / "packages"]
EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
EXCLUDED = {"node_modules", "dist", "build", ".next", ".turbo", "drizzle", "coverage"}

TABLE_HEADER = re.compile(
    r'export const (\w+) = pgTable\(\s*\n?\s*"([a-z0-9_]+)"\s*,', re.MULTILINE
)
SHARED_GROUP = re.compile(r"^const (\w+) = \{$", re.MULTILINE)
# Una columna es `prop: tipo("columna_sql"`; el resto de la cadena da igual.
COLUMN = re.compile(r'^(\w+):\s*\w+\(\s*"([a-z0-9_]+)"')
SPREAD = re.compile(r"^\.\.\.(\w+)")


def block_after(text: str, start: int) -> tuple[str, int]:
    """Devuelve el objeto `{…}` que empieza en `start`, contando llaves.

    Contar llaves y no cortar por indentación evita que un objeto de opciones
    (`{ withTimezone: true }`) o un `sql` multilínea partan la tabla por la
    mitad.
    """
    depth = 0
    index = text.index("{", start)
    opening = index
    in_string: str | None = None
    while index < len(text):
        char = text[index]
        if in_string:
            if char == "\\":
                index += 2
                continue
            if char == in_string:
                in_string = None
        elif char in "\"'`":
            in_string = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[opening + 1 : index], index
        index += 1
    raise ValueError("bloque sin cerrar en el schema")


def properties(block: str) -> list[tuple[str, str | None]]:
    """Propiedades de primer nivel: `(camelCase, columna_sql | None)`.

    El `None` marca un `...spread`, que se resuelve después contra los grupos
    compartidos (`timestamps`).
    """
    found: list[tuple[str, str | None]] = []
    depth = 0
    in_string: str | None = None
    line_start = True
    index = 0
    while index < len(block):
        char = block[index]
        if in_string:
            if char == "\\":
                index += 2
                continue
            if char == in_string:
                in_string = None
        elif char in "\"'`":
            in_string = char
        elif char in "{([":
            depth += 1
        elif char in "})]":
            depth -= 1
        elif char == "\n":
            line_start = True
            index += 1
            continue
        elif depth == 0 and line_start and not char.isspace():
            rest = block[index:]
            column = COLUMN.match(rest)
            spread = SPREAD.match(rest)
            if column:
                found.append((column.group(1), column.group(2)))
            elif spread:
                found.append((spread.group(1), None))
            line_start = False
        elif not char.isspace():
            line_start = False
        index += 1
    return found


def parse_schema() -> tuple[dict[str, dict], dict[str, list[tuple[str, str]]]]:
    text = SCHEMA.read_text("utf-8")

    groups: dict[str, list[tuple[str, str]]] = {}
    for match in SHARED_GROUP.finditer(text):
        block, _ = block_after(text, match.start())
        groups[match.group(1)] = [
            (name, column) for name, column in properties(block) if column
        ]

    tables: dict[str, dict] = {}
    for match in TABLE_HEADER.finditer(text):
        block, _ = block_after(text, match.end())
        columns: list[tuple[str, str]] = []
        for name, column in properties(block):
            if column:
                columns.append((name, column))
            else:
                columns.extend(groups.get(name, []))
        tables[match.group(1)] = {"sql": match.group(2), "columns": columns}
    return tables, groups


def collect_sources() -> dict[Path, str]:
    files: dict[Path, str] = {}
    for root in SOURCES:
        for path in root.rglob("*"):
            if path.suffix not in EXTENSIONS or not path.is_file():
                continue
            if EXCLUDED & set(path.relative_to(ROOT).parts):
                continue
            if path == SCHEMA:
                continue
            files[path] = path.read_text("utf-8", errors="ignore")
    return files


def word(name: str) -> re.Pattern:
    return re.compile(rf"\b{re.escape(name)}\b")


def audit(only: str | None) -> tuple[list[str], dict[str, int]]:
    tables, _ = parse_schema()
    sources = collect_sources()
    schema_text = SCHEMA.read_text("utf-8")

    findings: list[str] = []
    counters = {"tablas": 0, "columnas": 0, "muerta": 0, "dudosa": 0, "solo-schema": 0}

    for table, definition in sorted(tables.items()):
        if only and only not in (table, definition["sql"]):
            continue
        counters["tablas"] += 1

        pattern = word(table)
        sql_pattern = word(definition["sql"])
        owners = {
            path
            for path, text in sources.items()
            if pattern.search(text) or sql_pattern.search(text)
        }

        if not owners:
            counters["muerta"] += 1
            findings.append(
                f"[muerta] tabla {table} ({definition['sql']}): "
                f"{len(definition['columns'])} columnas, cero referencias en el código"
            )
            continue

        for name, column in definition["columns"]:
            counters["columnas"] += 1
            camel = word(name)
            snake = word(column)

            scoped = sum(
                1
                for path in owners
                if camel.search(sources[path]) or snake.search(sources[path])
            )
            if scoped:
                continue

            elsewhere = sum(
                1
                for path, text in sources.items()
                if camel.search(text) or snake.search(text)
            )
            # Restar la propia declaración: `id: uuid("id")` siempre se cita.
            # Cuando camelCase y snake_case coinciden, ambos patrones cuentan
            # las dos apariciones de la misma línea, así que la base es 4.
            in_schema = len(camel.findall(schema_text)) + len(snake.findall(schema_text))
            declaration = 4 if name == column else 2

            if elsewhere:
                counters["dudosa"] += 1
                findings.append(
                    f"[dudosa] {table}.{name} ({column}): sin uso en los "
                    f"{len(owners)} archivos que tocan la tabla, pero el nombre "
                    f"aparece en otros {elsewhere}"
                )
            elif in_schema > declaration:
                counters["solo-schema"] += 1
                findings.append(
                    f"[solo-schema] {table}.{name} ({column}): solo se usa dentro "
                    f"del schema (índice, constraint o clave foránea)"
                )
            else:
                counters["muerta"] += 1
                findings.append(
                    f"[muerta] {table}.{name} ({column}): cero referencias fuera "
                    f"del schema"
                )

    return findings, counters


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", help="auditar solo una tabla (nombre TS o SQL)")
    parser.add_argument(
        "--level",
        choices=["muerta", "dudosa", "solo-schema"],
        action="append",
        help="filtrar por nivel de certeza; repetible",
    )
    parser.add_argument("--fail-on-findings", action="store_true")
    arguments = parser.parse_args()

    findings, counters = audit(arguments.table)
    if arguments.level:
        allowed = tuple(f"[{level}]" for level in arguments.level)
        findings = [line for line in findings if line.startswith(allowed)]

    for line in findings:
        print(line)

    print(
        f"\nschema: {counters['tablas']} tablas y {counters['columnas']} columnas "
        f"revisadas — {counters['muerta']} muertas, {counters['dudosa']} dudosas, "
        f"{counters['solo-schema']} solo-schema."
    )
    return 1 if findings and arguments.fail_on_findings else 0


if __name__ == "__main__":
    sys.exit(main())
