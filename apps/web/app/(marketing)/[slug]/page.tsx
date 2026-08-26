import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import Container from "@/features/marketing/components/container"
import Wrapper from "@/features/marketing/components/wrapper"
import { getSitePage } from "@/features/marketing/site"

interface StaticPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: StaticPageProps): Promise<Metadata> {
  const { slug } = await params
  const page = await getSitePage(slug)
  if (!page) {
    const t = await getTranslations("marketing.page")
    return { title: t("notFound") }
  }
  return { title: page.title }
}

export default async function StaticPage({ params }: StaticPageProps) {
  const { slug } = await params
  const page = await getSitePage(slug)
  if (!page) notFound()

  return (
    <Wrapper className="relative py-20 lg:py-32">
      <Container className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl leading-snug! font-medium md:text-5xl">
          {page.title}
        </h1>
        <article className="mt-8 leading-relaxed whitespace-pre-line text-accent-foreground/90">
          {page.content}
        </article>
      </Container>
    </Wrapper>
  )
}
