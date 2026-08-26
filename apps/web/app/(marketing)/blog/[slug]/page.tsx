import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import Container from "@/features/marketing/components/container"
import Wrapper from "@/features/marketing/components/wrapper"
import { getSitePost } from "@/features/marketing/site"

interface PostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getSitePost(slug)
  if (!post) {
    const t = await getTranslations("marketing.blog")
    return { title: t("notFound") }
  }
  return { title: post.title, description: post.excerpt }
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params
  const post = await getSitePost(slug)
  if (!post) notFound()

  return (
    <Wrapper className="relative py-20 lg:py-32">
      <Container className="mx-auto max-w-3xl">
        {post.categoryName ? (
          <span className="text-sm text-accent-foreground/60">
            {post.categoryName}
          </span>
        ) : null}
        <h1 className="mt-2 font-heading text-3xl leading-snug! font-medium md:text-5xl">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="mt-4 text-base text-accent-foreground/80 md:text-lg">
            {post.excerpt}
          </p>
        ) : null}
        <article className="mt-8 leading-relaxed whitespace-pre-line text-accent-foreground/90">
          {post.content}
        </article>
      </Container>
    </Wrapper>
  )
}
