import { notFound } from "next/navigation"

import { linkBioApi } from "@workspace/api-client"

import { PublicLinkBio } from "@/features/link-bio/components/public-link-bio"

type PublicLinkBioRouteProps = { params: Promise<{ slug: string }> }

export default async function PublicLinkBioRoute({
  params,
}: PublicLinkBioRouteProps) {
  const { slug } = await params
  try {
    const page = await linkBioApi.publicPage(slug)
    return <PublicLinkBio page={page} />
  } catch {
    notFound()
  }
}
