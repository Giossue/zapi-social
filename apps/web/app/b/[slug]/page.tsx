import { notFound } from "next/navigation"

import { linkBioApi } from "@workspace/api-client"

import { PublicLinkBio } from "@/features/link-bio/components/public-link-bio"

type PublicLinkBioRouteProps = { params: Promise<{ slug: string }> }

export default async function PublicLinkBioRoute({
  params,
}: PublicLinkBioRouteProps) {
  const { slug } = await params
  // Solo la llamada puede fallar: construir el JSX dentro del `try` haría que
  // un error de render acabara en `notFound()` en vez de en el límite de error.
  let page
  try {
    page = await linkBioApi.publicPage(slug)
  } catch {
    notFound()
  }

  return <PublicLinkBio page={page} />
}
