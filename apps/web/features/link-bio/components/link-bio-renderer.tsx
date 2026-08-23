"use client"

import type { CSSProperties, MouseEvent } from "react"

import type {
  LinkBioAppearance,
  LinkBioBlock,
  LinkBioTemplateKey,
} from "@workspace/contracts"
import { useTranslations } from "next-intl"

import { cn } from "@workspace/ui/lib/utils"

import { linkBioTemplate } from "../link-bio-templates"

export type LinkBioRenderData = {
  title: string
  headline: string
  description: string
  avatarUrl: string | null
  coverUrl: string | null
  templateKey: LinkBioTemplateKey
  appearance: LinkBioAppearance
  blocks: LinkBioBlock[]
}

const buttonShape = {
  rounded: "rounded-lg",
  pill: "rounded-full",
  square: "rounded-none",
} as const

const avatarShape = {
  circle: "rounded-full",
  rounded: "rounded-2xl",
  square: "rounded-none",
} as const

const coverPosition = {
  top: "object-top",
  center: "object-center",
  bottom: "object-bottom",
} as const

function initials(title: string) {
  return (
    title
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "·"
  )
}

/**
 * Composición única de la página pública de Link in bio. La usan la ruta
 * `/b/{slug}` y la vista previa del constructor: mismo markup, mismo tema por
 * variables; solo cambian los datos y el manejo de clics.
 */
export function LinkBioRenderer({
  page,
  placeholders = false,
  onItemClick,
}: {
  page: LinkBioRenderData
  /** La vista previa muestra guías en los campos vacíos; la pública no. */
  placeholders?: boolean
  onItemClick?: (
    event: MouseEvent<HTMLAnchorElement>,
    blockIndex: number,
    itemIndex: number,
    url: string
  ) => void
}) {
  const t = useTranslations("linkBio.preview")
  const template = linkBioTemplate(page.templateKey)
  const align =
    page.appearance.contentAlign === "left" ? "text-left" : "text-center"
  const headline = page.headline || (placeholders ? t("headlineHint") : "")
  const description =
    page.description || (placeholders ? t("descriptionHint") : "")
  const overlay = Math.min(Math.max(page.appearance.backgroundOverlay, 0), 85)

  return (
    <div
      className="min-h-full [color:var(--bio-fg)] [background:var(--bio-bg)]"
      style={template.theme as CSSProperties}
    >
      {page.coverUrl ? (
        <div className="relative h-36 w-full overflow-hidden">
          <img
            alt=""
            className={cn(
              "size-full",
              page.appearance.backgroundFit === "contain"
                ? "object-contain"
                : "object-cover",
              coverPosition[page.appearance.backgroundPosition]
            )}
            src={page.coverUrl}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black"
            style={{ opacity: overlay / 100 }}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-10",
          page.coverUrl ? "-mt-12" : "pt-10",
          align
        )}
      >
        <header className="flex flex-col items-center gap-3">
          {page.avatarUrl ? (
            <img
              alt={page.title}
              className={cn(
                "size-24 border-2 [border-color:var(--bio-border)] object-cover [background:var(--bio-card)]",
                avatarShape[page.appearance.avatarStyle]
              )}
              src={page.avatarUrl}
            />
          ) : placeholders ? (
            <span
              aria-hidden="true"
              className={cn(
                "flex size-24 items-center justify-center border-2 [border-color:var(--bio-border)] text-2xl font-semibold [color:var(--bio-card-fg)] [background:var(--bio-card)]",
                avatarShape[page.appearance.avatarStyle]
              )}
            >
              {initials(page.title)}
            </span>
          ) : null}
          <div className={cn("flex w-full flex-col gap-1", align)}>
            <h1 className="font-heading text-2xl font-semibold">
              {page.title || (placeholders ? t("titleHint") : "")}
            </h1>
            {headline ? (
              <p
                className={cn(
                  "text-sm [color:var(--bio-muted)]",
                  placeholders && !page.headline && "italic"
                )}
              >
                {headline}
              </p>
            ) : null}
            {description ? (
              <p
                className={cn(
                  "text-sm [color:var(--bio-muted)]",
                  placeholders && !page.description && "italic"
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
        </header>

        {page.blocks.map((block, blockIndex) =>
          block.enabled === false ? null : (
            <section className="flex flex-col gap-3" key={blockIndex}>
              {block.title ? (
                <h2 className="text-sm font-medium tracking-wide [color:var(--bio-muted)] uppercase">
                  {block.title}
                </h2>
              ) : null}

              {block.type === "header" && block.content ? (
                <p className="text-sm leading-relaxed">{block.content}</p>
              ) : null}

              {block.type === "video" && block.url ? (
                <a
                  className="text-sm [color:var(--bio-accent)] underline underline-offset-4"
                  href={block.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("watchVideo")}
                </a>
              ) : null}

              {block.type === "faq" ? (
                <div className="flex flex-col gap-3">
                  {block.items.map((item, itemIndex) => (
                    <div className="flex flex-col gap-1" key={itemIndex}>
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-sm [color:var(--bio-muted)]">
                        {item.answer}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {block.type === "gallery" ? (
                <div className="grid grid-cols-2 gap-2">
                  {block.items.map((item, itemIndex) =>
                    item.image ? (
                      <img
                        alt={item.label}
                        className="aspect-square w-full rounded-lg object-cover"
                        key={itemIndex}
                        src={item.image}
                      />
                    ) : null
                  )}
                </div>
              ) : null}

              {["links", "social", "contact", "product"].includes(block.type)
                ? block.items.map((item, itemIndex) => (
                    <a
                      className={cn(
                        "flex items-center justify-between gap-3 border [border-color:var(--bio-border)] px-4 py-3 text-sm font-medium [color:var(--bio-card-fg)] transition-colors [background:var(--bio-card)] hover:[background:var(--bio-hover)]",
                        buttonShape[page.appearance.buttonStyle]
                      )}
                      href={item.url || "#"}
                      key={itemIndex}
                      onClick={(event) =>
                        onItemClick
                          ? onItemClick(event, blockIndex, itemIndex, item.url)
                          : event.preventDefault()
                      }
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="flex min-w-0 flex-col text-left">
                        <span className="truncate">
                          {item.label || (placeholders ? t("itemHint") : "")}
                        </span>
                        {item.note ? (
                          <span className="truncate text-xs font-normal [color:var(--bio-muted)]">
                            {item.note}
                          </span>
                        ) : null}
                      </span>
                      {item.price ? (
                        <span className="shrink-0 text-sm [color:var(--bio-accent)]">
                          {item.price}
                        </span>
                      ) : null}
                    </a>
                  ))
                : null}
            </section>
          )
        )}

        {page.appearance.brandingText ? (
          <p className="pt-4 text-center text-xs [color:var(--bio-muted)]">
            {page.appearance.brandingText}
          </p>
        ) : null}
      </div>
    </div>
  )
}
