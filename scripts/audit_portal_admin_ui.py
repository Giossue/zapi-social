#!/usr/bin/env python3
"""Audita regresiones de UI que afectan rutas visibles de Portal y Admin.

No sustituye una revisión visual. Evita que regresiones mecánicas conocidas
obliguen a revisar módulo por módulo: scrollbars nativos en tabs, validación
nativa, pickers nativos, conteos duplicados, contexto duplicado en tablas y
enlaces de navegación sin ruta y composiciones inconsistentes de Sheet.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = (
    ROOT / "apps/web/app/admin",
    ROOT / "apps/web/app/portal",
    ROOT / "apps/web/features",
)
EXTENSIONS = {".ts", ".tsx"}
NATIVE_PICKERS = "date|time|datetime-local|month|week|color"
TABLE_ACTION_SHEET_FILES = frozenset(
    {
        "apps/web/features/plans/components/plans-page.tsx",
        "apps/web/features/platform-admin/components/admin-module-preview.tsx",
        "apps/web/features/platform-admin-mockups/components/admin-secondary-module-mockup.tsx",
        "apps/web/features/portal-mockups/components/portal-module-mockup.tsx",
        "apps/web/features/support/components/support-tickets-page.tsx",
        "apps/web/features/teams/components/team-dialogs.tsx",
    }
)
PORTAL_TABLE_HEADER_CONTEXT_ALLOWLIST: frozenset[str] = frozenset()
PORTAL_TABLE_HEADER_CONTEXT_ROOTS = (
    "apps/web/features/ai-studio/",
    "apps/web/features/captions/",
    "apps/web/features/channels/",
    "apps/web/features/commerce/",
    "apps/web/features/dashboard/",
    "apps/web/features/portal-mockups/",
    "apps/web/features/publishing/",
    "apps/web/features/rss-schedules/",
    "apps/web/features/support/",
    "apps/web/features/teams/",
)


@dataclass(frozen=True)
class Finding:
    rule: str
    path: str
    line: int
    message: str


def line_of(source: str, position: int) -> int:
    return source.count("\n", 0, position) + 1


def source_files() -> list[Path]:
    files: set[Path] = set()
    for root in SOURCE_ROOTS:
        if root.exists():
            files.update(path for path in root.rglob("*") if path.suffix in EXTENSIONS)
    return sorted(files)


def finding(rule: str, path: Path, source: str, position: int, message: str) -> Finding:
    return Finding(rule, str(path.relative_to(ROOT)), line_of(source, position), message)


def inspect_tabs(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    for match in re.finditer(r"<TabsList\b(?P<attrs>[\s\S]*?)>", source):
        attributes = match.group("attrs")
        if re.search(r"overflow-[xy]-auto", attributes):
            findings.append(
                finding(
                    "tabs-scrollbar",
                    path,
                    source,
                    match.start(),
                    "TabsList no puede usar overflow auto; usa flex h-auto flex-wrap.",
                )
            )
    return findings


def inspect_sheets(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    for match in re.finditer(r"<SheetFooter(?:\s|>)", source):
        findings.append(
            finding(
                "sheet-footer",
                path,
                source,
                match.start(),
                "Usa SheetActions para conservar el separador y el pie persistente compartido.",
            )
        )
    for match in re.finditer(r"<SheetContent\b(?P<attrs>[\s\S]*?)>", source):
        if re.search(r"overflow-[xy]-(?:auto|scroll)", match.group("attrs")):
            findings.append(
                finding(
                    "sheet-content-scroll",
                    path,
                    source,
                    match.start(),
                    "SheetContent no se desplaza completo; el cuerpo usa min-h-0 flex-1 overflow-y-auto y SheetActions queda fuera.",
                )
            )
    return findings


def inspect_forms(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    for match in re.finditer(r"<form\b(?P<attrs>[\s\S]*?)>", source):
        if "noValidate" not in match.group("attrs"):
            findings.append(
                finding(
                    "native-validation",
                    path,
                    source,
                    match.start(),
                    "Todo formulario de producto debe declarar noValidate y reportar errores por toast.",
                )
            )
    return findings


def inspect_native_pickers(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    picker = re.compile(
        rf"<(?:input|Input)\b(?P<attrs>[\s\S]*?\btype\s*=\s*[\"'](?:{NATIVE_PICKERS})[\"'][\s\S]*?)>",
        re.IGNORECASE,
    )
    for match in picker.finditer(source):
        findings.append(
            finding(
                "native-picker",
                path,
                source,
                match.start(),
                "No usar picker nativo visible; compón Select, Popover, Calendar o TimePicker compartido.",
            )
        )
    return findings


def inspect_duplicate_counts(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    pattern = re.compile(r"\b(?:resultados?|registros?)\s+en\s+(?:esta|la)\s+vista\b", re.IGNORECASE)
    for match in pattern.finditer(source):
        findings.append(
            finding(
                "duplicate-table-count",
                path,
                source,
                match.start(),
                "El total de una tabla paginada se muestra únicamente en TablePagination.",
            )
        )
    return findings


def inspect_table_action_containers(path: Path, source: str) -> list[Finding]:
    relative_path = str(path.relative_to(ROOT))
    if relative_path not in TABLE_ACTION_SHEET_FILES:
        return []

    match = re.search(r"<Dialog(?:\s|>)", source)
    if not match:
        return []

    return [
        finding(
            "table-action-dialog",
            path,
            source,
            match.start(),
            "Crear, editar y ver desde una tabla operativa deben abrir Sheet; Channels es la única excepción.",
        )
    ]


def jsx_self_closing_blocks(source: str, tag: str) -> list[tuple[int, int]]:
    blocks: list[tuple[int, int]] = []
    start_token = f"<{tag}"
    start = 0

    while (opening := source.find(start_token, start)) != -1:
        index = opening + len(start_token)
        braces = 0
        quote: str | None = None

        while index < len(source):
            character = source[index]

            if quote:
                if character == "\\":
                    index += 2
                    continue
                if character == quote:
                    quote = None
                index += 1
                continue

            if character in {"\"", "'", "`"}:
                quote = character
            elif character == "{":
                braces += 1
            elif character == "}" and braces:
                braces -= 1
            elif character == "/" and index + 1 < len(source) and source[index + 1] == ">" and braces == 0:
                blocks.append((opening, index + 2))
                index += 2
                break
            index += 1
        else:
            break

        start = index

    return blocks


def jsx_top_level_attributes(block: str) -> str:
    attributes: list[str] = []
    braces = 0
    quote: str | None = None

    for character in block:
        if quote:
            if braces == 0:
                attributes.append(character)
            if character == quote:
                quote = None
            continue

        if character in {"\"", "'", "`"}:
            quote = character
            if braces == 0:
                attributes.append(character)
        elif character == "{":
            braces += 1
        elif character == "}" and braces:
            braces -= 1
        elif braces == 0:
            attributes.append(character)

    return "".join(attributes)


def inspect_portal_table_context(path: Path, source: str) -> list[Finding]:
    relative_path = str(path.relative_to(ROOT))
    if relative_path in PORTAL_TABLE_HEADER_CONTEXT_ALLOWLIST:
        return []
    if not relative_path.startswith(PORTAL_TABLE_HEADER_CONTEXT_ROOTS):
        return []

    findings: list[Finding] = []
    for start, end in jsx_self_closing_blocks(source, "DataTableHeader"):
        attributes = jsx_top_level_attributes(source[start:end])
        if not re.search(r"\b(?:title|description)\s*=", attributes):
            continue
        findings.append(
            finding(
                "portal-table-context",
                path,
                source,
                start,
                "Portal usa CollectionHeader fuera de Card para su título y descripción; DataTableHeader conserva solo búsqueda y acción.",
            )
        )
    return findings


def route_exists(href: str) -> bool:
    route = ROOT / "apps/web/app" / href.lstrip("/") / "page.tsx"
    return route.exists()


def inspect_navigation(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    for match in re.finditer(r'href:\s*["\'](?P<href>/(?:admin|portal)[^"\']*)["\']', source):
        href = match.group("href")
        if not route_exists(href):
            findings.append(
                finding(
                    "missing-navigation-route",
                    path,
                    source,
                    match.start(),
                    f"{href} no tiene una page.tsx explícita.",
                )
            )
    return findings


def audit() -> list[Finding]:
    findings: list[Finding] = []
    for path in source_files():
        source = path.read_text(encoding="utf-8")
        findings.extend(inspect_tabs(path, source))
        findings.extend(inspect_sheets(path, source))
        findings.extend(inspect_forms(path, source))
        findings.extend(inspect_native_pickers(path, source))
        findings.extend(inspect_duplicate_counts(path, source))
        findings.extend(inspect_table_action_containers(path, source))
        findings.extend(inspect_portal_table_context(path, source))
        if path.name.endswith("navigation.ts"):
            findings.extend(inspect_navigation(path, source))
    return sorted(findings, key=lambda item: (item.path, item.line, item.rule))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Emite hallazgos como JSON.")
    parser.add_argument(
        "--fail-on-findings",
        action="store_true",
        help="Devuelve código 1 si encuentra una regresión.",
    )
    args = parser.parse_args()

    findings = audit()
    if args.json:
        print(json.dumps([asdict(item) for item in findings], ensure_ascii=False, indent=2))
    elif findings:
        print(f"UI audit: {len(findings)} hallazgo(s)")
        for item in findings:
            print(f"{item.path}:{item.line} [{item.rule}] {item.message}")
    else:
        print("UI audit: sin hallazgos.")

    return 1 if args.fail_on_findings and findings else 0


if __name__ == "__main__":
    sys.exit(main())
