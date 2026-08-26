"use client"

import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  SquareCodeIcon,
  StrikethroughIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef } from "react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { MarkdownContent } from "@/components/markdown-content"

type Action =
  | { kind: "wrap"; prefix: string; suffix: string }
  | { kind: "line"; prefix: string }
  | { kind: "block"; text: string }

type ToolKey =
  | "bold"
  | "italic"
  | "strikethrough"
  | "heading1"
  | "heading2"
  | "heading3"
  | "link"
  | "image"
  | "bulletList"
  | "orderedList"
  | "quote"
  | "code"
  | "codeBlock"
  | "rule"

const TOOLS: {
  key: ToolKey
  icon: typeof BoldIcon
  action: Action
}[] = [
  {
    key: "bold",
    icon: BoldIcon,
    action: { kind: "wrap", prefix: "**", suffix: "**" },
  },
  {
    key: "italic",
    icon: ItalicIcon,
    action: { kind: "wrap", prefix: "_", suffix: "_" },
  },
  {
    key: "strikethrough",
    icon: StrikethroughIcon,
    action: { kind: "wrap", prefix: "~~", suffix: "~~" },
  },
  {
    key: "heading1",
    icon: Heading1Icon,
    action: { kind: "line", prefix: "# " },
  },
  {
    key: "heading2",
    icon: Heading2Icon,
    action: { kind: "line", prefix: "## " },
  },
  {
    key: "heading3",
    icon: Heading3Icon,
    action: { kind: "line", prefix: "### " },
  },
  {
    key: "link",
    icon: LinkIcon,
    action: { kind: "wrap", prefix: "[", suffix: "](https://)" },
  },
  {
    key: "image",
    icon: ImageIcon,
    action: { kind: "wrap", prefix: "![", suffix: "](https://)" },
  },
  { key: "bulletList", icon: ListIcon, action: { kind: "line", prefix: "- " } },
  {
    key: "orderedList",
    icon: ListOrderedIcon,
    action: { kind: "line", prefix: "1. " },
  },
  { key: "quote", icon: QuoteIcon, action: { kind: "line", prefix: "> " } },
  {
    key: "code",
    icon: CodeIcon,
    action: { kind: "wrap", prefix: "`", suffix: "`" },
  },
  {
    key: "codeBlock",
    icon: SquareCodeIcon,
    action: { kind: "block", text: "\n```\n\n```\n" },
  },
  {
    key: "rule",
    icon: MinusIcon,
    action: { kind: "block", text: "\n\n---\n\n" },
  },
]

function apply(value: string, start: number, end: number, action: Action) {
  if (action.kind === "block") {
    const next = value.slice(0, start) + action.text + value.slice(end)
    return { value: next, cursor: start + action.text.length }
  }

  if (action.kind === "line") {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const lineEnd = value.indexOf("\n", end)
    const stop = lineEnd === -1 ? value.length : lineEnd
    const lines = value.slice(lineStart, stop).split("\n")
    const allPrefixed = lines.every((line) => line.startsWith(action.prefix))
    const next = lines
      .map((line) =>
        allPrefixed ? line.slice(action.prefix.length) : action.prefix + line
      )
      .join("\n")
    return {
      value: value.slice(0, lineStart) + next + value.slice(stop),
      cursor: lineStart + next.length,
    }
  }

  const selected = value.slice(start, end)
  const wrapped = action.prefix + selected + action.suffix
  return {
    value: value.slice(0, start) + wrapped + value.slice(end),
    cursor: selected ? start + wrapped.length : start + action.prefix.length,
  }
}

export function MarkdownEditor({
  id,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const t = useTranslations("markdownEditor")
  const textarea = useRef<HTMLTextAreaElement>(null)

  const run = (action: Action) => {
    const element = textarea.current
    if (!element) return
    const result = apply(
      element.value,
      element.selectionStart,
      element.selectionEnd,
      action
    )
    onChange(result.value)
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(result.cursor, result.cursor)
    })
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div
        aria-label={t("toolbar")}
        className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background p-1"
        role="toolbar"
      >
        {TOOLS.map((tool) => (
          <Button
            aria-label={t(`tools.${tool.key}`)}
            disabled={disabled}
            key={tool.key}
            onClick={() => run(tool.action)}
            size="icon-sm"
            title={t(`tools.${tool.key}`)}
            type="button"
            variant="brand-secondary"
          >
            <tool.icon />
          </Button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <Textarea
          className="min-h-64 flex-1 font-mono text-sm lg:min-h-0"
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          ref={textarea}
          value={value}
        />
        <div className="flex min-h-0 flex-col gap-2">
          <span className="text-sm text-muted-foreground">{t("preview")}</span>
          <div className="min-h-64 flex-1 overflow-y-auto rounded-md border border-border bg-background p-4 lg:min-h-0">
            {value.trim() ? (
              <MarkdownContent>{value}</MarkdownContent>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("previewEmpty")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
