"use client"

import { useEffect } from "react"

import { linkBioApi } from "@workspace/api-client"
import type { PublicLinkBioPage } from "@workspace/contracts"

import { LinkBioRenderer } from "./link-bio-renderer"

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
    <main className="min-h-svh">
      <LinkBioRenderer
        onItemClick={(event, blockIndex, itemIndex, url) =>
          void openLink(event, blockIndex, itemIndex, url)
        }
        page={page}
      />
    </main>
  )
}
