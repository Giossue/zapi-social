"use client"

import { useEffect } from "react"

import { linkBioApi } from "@workspace/api-client"
import type { PublicLinkBioPage } from "@workspace/contracts"
import { cn } from "@workspace/ui/lib/utils"

import { linkBioTemplate } from "../link-bio-templates"

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

/**
 * Página pública. Registra la visita al montar y cada clic antes de salir,
 * usando el endpoint público que devuelve el destino ya validado.
 */
export function PublicLinkBio({ page }: { page: PublicLinkBioPage }) {
  useEffect(() => {
    void linkBioApi.track(page.slug, { type: "view" }).catch(() => {
      // Una visita no registrada no debe romper la página.
    })
  }, [page.slug])

  const align =
    page.appearance.contentAlign === "left" ? "text-left" : "text-center"

  async function openLink(
    event: React.MouseEvent<HTMLAnchorElement>,
    blockIndex: number,
    itemIndex: number,
    url: string
  ) {
    if (!url) return
    event.preventDefault()
    try {
      await linkBioApi.track(page.slug, {
        blockIndex,
        itemIndex,
        type: "click",
      })
    } catch {
      // El clic se abre igual aunque no se pueda registrar.
    }
    window.open(url, "_blank", "noreferrer")
  }

  return (
    <main
      className="min-h-svh px-4 py-10 [background:var(--bio-bg)] [color:var(--bio-fg)]"
      style={linkBioTemplate(page.templateKey).theme}
    >
      <div className={cn("mx-auto flex w-full max-w-md flex-col gap-6", align)}>
        <header className="flex flex-col items-center gap-3">
          {page.avatarUrl ? (
            <img
              alt={page.title}
              className={cn(
                "size-24 border object-cover [border-color:var(--bio-border)]",
                avatarShape[page.appearance.avatarStyle]
              )}
              src={page.avatarUrl}
            />
          ) : null}
          <div className={cn("flex w-full flex-col gap-1", align)}>
            <h1 className="font-heading text-2xl font-semibold">
              {page.title}
            </h1>
            {page.headline ? (
              <p className="text-sm [color:var(--bio-muted)]">{page.headline}</p>
            ) : null}
            {page.description ? (
              <p className="text-sm [color:var(--bio-muted)]">
                {page.description}
              </p>
            ) : null}
          </div>
        </header>

        {page.blocks.map((block, blockIndex) => (
          <section className="flex flex-col gap-3" key={blockIndex}>
            {block.title ? (
              <h2 className="text-sm font-medium tracking-wide uppercase [color:var(--bio-muted)]">
                {block.title}
              </h2>
            ) : null}

            {block.type === "header" && block.content ? (
              <p className="text-sm leading-relaxed">{block.content}</p>
            ) : null}

            {block.type === "video" && block.url ? (
              <a
                className="text-sm underline underline-offset-4 [color:var(--bio-accent)]"
                href={block.url}
                rel="noreferrer"
                target="_blank"
              >
                Ver video
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
                      "flex items-center justify-between gap-3 border px-4 py-3 text-sm font-medium transition-colors [background:var(--bio-card)] [border-color:var(--bio-border)] [color:var(--bio-card-fg)] hover:[background:var(--bio-hover)]",
                      buttonShape[page.appearance.buttonStyle]
                    )}
                    href={item.url || "#"}
                    key={itemIndex}
                    onClick={(event) =>
                      void openLink(event, blockIndex, itemIndex, item.url)
                    }
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="flex min-w-0 flex-col text-left">
                      <span className="truncate">{item.label}</span>
                      {item.note ? (
                        <span className="truncate text-xs font-normal [color:var(--bio-muted)]">
                          {item.note}
                        </span>
                      ) : null}
                    </span>
                    {item.price ? (
                      <span className="shrink-0 text-sm [color:var(--bio-accent)]">{item.price}</span>
                    ) : null}
                  </a>
                ))
              : null}
          </section>
        ))}

        {page.appearance.brandingText ? (
          <p className="pt-4 text-center text-xs [color:var(--bio-muted)]">
            {page.appearance.brandingText}
          </p>
        ) : null}
      </div>
    </main>
  )
}
