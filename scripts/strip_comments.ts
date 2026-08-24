import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"
import ts from "typescript"

const ROOTS = ["apps/api/src", "apps/worker/src", "apps/web", "packages"]
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  ".turbo",
  "drizzle",
  "messages",
])
const DIRECTIVE =
  /eslint-disable|eslint-enable|@ts-expect-error|@ts-ignore|@ts-nocheck|prettier-ignore|<reference|@jsxImportSource/

function collect(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) collect(path, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (entry.endsWith(".d.ts")) continue
    out.push(path)
  }
}

function commentRanges(source: ts.SourceFile, text: string) {
  const ranges = new Map<number, number>()
  const record = (list: readonly ts.CommentRange[] | undefined) => {
    for (const range of list ?? []) {
      const body = text.slice(range.pos, range.end)
      if (DIRECTIVE.test(body)) continue
      ranges.set(range.pos, range.end)
    }
  }
  const visit = (node: ts.Node) => {
    record(ts.getLeadingCommentRanges(text, node.getFullStart()))
    record(ts.getTrailingCommentRanges(text, node.getEnd()))
    if (ts.isJsxExpression(node) && !node.expression) {
      const start = node.getStart(source)
      const inner = text.slice(start + 1, node.getEnd() - 1).trim()
      if (!inner || inner.startsWith("/*") || inner.startsWith("//")) {
        if (!DIRECTIVE.test(inner)) ranges.set(start, node.getEnd())
      }
    }
    for (const child of node.getChildren(source)) visit(child)
  }
  visit(source)
  return [...ranges.entries()]
    .map(([pos, end]) => ({ pos, end }))
    .sort((a, b) => a.pos - b.pos)
}

function widen(text: string, pos: number, end: number) {
  let lineStart = text.lastIndexOf("\n", pos - 1) + 1
  let lineEnd = text.indexOf("\n", end)
  if (lineEnd === -1) lineEnd = text.length
  const before = text.slice(lineStart, pos)
  const after = text.slice(end, lineEnd)
  if (!before.trim() && !after.trim()) {
    return { pos: lineStart, end: Math.min(lineEnd + 1, text.length) }
  }
  let start = pos
  while (start > lineStart && /[ \t]/.test(text[start - 1]!)) start -= 1
  return { pos: start, end }
}

function merge(ranges: { pos: number; end: number }[]) {
  const merged: { pos: number; end: number }[] = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.pos <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

const files: string[] = []
for (const root of ROOTS) collect(root, files)

const changed: string[] = []
for (const file of files) {
  const text = readFileSync(file, "utf8")
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind
  )
  const raw = commentRanges(source, text)
  if (!raw.length) continue
  const ranges = merge(raw.map(({ pos, end }) => widen(text, pos, end)))
  let output = text
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const { pos, end } = ranges[index]!
    output = output.slice(0, pos) + output.slice(end)
  }
  output = output.replace(/\n{3,}/g, "\n\n")
  if (output !== text) {
    writeFileSync(file, output)
    changed.push(relative(".", file))
  }
}

console.log(`Comentarios eliminados en ${changed.length} archivos.`)
for (const file of changed) console.log(`  ${file}`)
