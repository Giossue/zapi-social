import type { CSSProperties } from "react"

import type { LinkBioTemplateKey } from "@workspace/contracts"

export type LinkBioTemplateCategory = "dark" | "light" | "color"

export type LinkBioTemplate = {
  key: LinkBioTemplateKey
  category: LinkBioTemplateCategory
  theme: CSSProperties & Record<`--${string}`, string>
}

function theme(values: {
  bg: string
  fg: string
  muted: string
  card: string
  cardFg: string
  border: string
  hover: string
  accent: string
}) {
  return {
    "--bio-bg": values.bg,
    "--bio-fg": values.fg,
    "--bio-muted": values.muted,
    "--bio-card": values.card,
    "--bio-card-fg": values.cardFg,
    "--bio-border": values.border,
    "--bio-hover": values.hover,
    "--bio-accent": values.accent,
  } satisfies LinkBioTemplate["theme"]
}

export const linkBioTemplates: readonly LinkBioTemplate[] = [
  {
    key: "aurora",
    category: "dark",
    theme: theme({
      bg: "radial-gradient(circle at 50% -10%, rgba(96, 165, 250, 0.35), transparent 55%), #0b1220",
      fg: "#f8fafc",
      muted: "rgba(248, 250, 252, 0.65)",
      card: "rgba(255, 255, 255, 0.06)",
      cardFg: "#f8fafc",
      border: "rgba(255, 255, 255, 0.14)",
      hover: "rgba(255, 255, 255, 0.12)",
      accent: "#60a5fa",
    }),
  },
  {
    key: "pro-dark",
    category: "dark",
    theme: theme({
      bg: "#0a0a0a",
      fg: "#fafafa",
      muted: "rgba(250, 250, 250, 0.6)",
      card: "#141414",
      cardFg: "#fafafa",
      border: "#262626",
      hover: "#1f1f1f",
      accent: "#22d3ee",
    }),
  },
  {
    key: "spotlight",
    category: "dark",
    theme: theme({
      bg: "radial-gradient(circle at 50% 0%, rgba(192, 132, 252, 0.3), transparent 50%), #101014",
      fg: "#faf5ff",
      muted: "rgba(250, 245, 255, 0.62)",
      card: "rgba(255, 255, 255, 0.07)",
      cardFg: "#faf5ff",
      border: "rgba(255, 255, 255, 0.14)",
      hover: "rgba(255, 255, 255, 0.13)",
      accent: "#c084fc",
    }),
  },
  {
    key: "forest",
    category: "dark",
    theme: theme({
      bg: "linear-gradient(170deg, #052e16, #14532d)",
      fg: "#ecfdf5",
      muted: "rgba(236, 253, 245, 0.65)",
      card: "rgba(255, 255, 255, 0.08)",
      cardFg: "#ecfdf5",
      border: "rgba(255, 255, 255, 0.16)",
      hover: "rgba(255, 255, 255, 0.14)",
      accent: "#4ade80",
    }),
  },
  {
    key: "sunset",
    category: "dark",
    theme: theme({
      bg: "linear-gradient(160deg, #7c2d12, #be185d)",
      fg: "#fff7ed",
      muted: "rgba(255, 247, 237, 0.72)",
      card: "rgba(255, 255, 255, 0.12)",
      cardFg: "#fff7ed",
      border: "rgba(255, 255, 255, 0.2)",
      hover: "rgba(255, 255, 255, 0.18)",
      accent: "#fdba74",
    }),
  },
  {
    key: "studio",
    category: "dark",
    theme: theme({
      bg: "linear-gradient(180deg, #0f172a, #1e293b)",
      fg: "#f1f5f9",
      muted: "rgba(241, 245, 249, 0.62)",
      card: "rgba(255, 255, 255, 0.06)",
      cardFg: "#f1f5f9",
      border: "rgba(255, 255, 255, 0.14)",
      hover: "rgba(255, 255, 255, 0.11)",
      accent: "#38bdf8",
    }),
  },
  {
    key: "minimal",
    category: "light",
    theme: theme({
      bg: "#ffffff",
      fg: "#0a0a0a",
      muted: "#737373",
      card: "#fafafa",
      cardFg: "#0a0a0a",
      border: "#e5e5e5",
      hover: "#f0f0f0",
      accent: "#171717",
    }),
  },
  {
    key: "paper",
    category: "light",
    theme: theme({
      bg: "#f7f3ec",
      fg: "#292524",
      muted: "#78716c",
      card: "#fffdf8",
      cardFg: "#292524",
      border: "#e7ded0",
      hover: "#f3ede2",
      accent: "#b45309",
    }),
  },
  {
    key: "soft",
    category: "light",
    theme: theme({
      bg: "linear-gradient(180deg, #f6f1ea, #efe7db)",
      fg: "#44403c",
      muted: "#8f8880",
      card: "#ffffff",
      cardFg: "#44403c",
      border: "#e5dccd",
      hover: "#faf6ef",
      accent: "#a16207",
    }),
  },
  {
    key: "sky",
    category: "light",
    theme: theme({
      bg: "linear-gradient(180deg, #e0f2fe, #eff6ff)",
      fg: "#075985",
      muted: "#4d7fa1",
      card: "#ffffff",
      cardFg: "#075985",
      border: "#bae6fd",
      hover: "#f0f9ff",
      accent: "#0284c7",
    }),
  },
  {
    key: "wave",
    category: "color",
    theme: theme({
      bg: "linear-gradient(160deg, #ecfeff, #dbeafe)",
      fg: "#0c4a6e",
      muted: "#48788f",
      card: "rgba(255, 255, 255, 0.85)",
      cardFg: "#0c4a6e",
      border: "#a5f3fc",
      hover: "#ffffff",
      accent: "#0891b2",
    }),
  },
  {
    key: "promo",
    category: "color",
    theme: theme({
      bg: "linear-gradient(180deg, #fff7ed, #ffedd5)",
      fg: "#7c2d12",
      muted: "#a3603e",
      card: "#ffffff",
      cardFg: "#7c2d12",
      border: "#fed7aa",
      hover: "#fff7ed",
      accent: "#ea580c",
    }),
  },
]

export function linkBioTemplate(key: LinkBioTemplateKey): LinkBioTemplate {
  return (
    linkBioTemplates.find((template) => template.key === key) ??
    linkBioTemplates[0]!
  )
}
