import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import Link from "next/link"

import { MarkdownContent } from "@/components/markdown-content"
import Container from "@/features/marketing/components/container"
import Wrapper from "@/features/marketing/components/wrapper"
import { getSitePost, getSitePosts } from "@/features/marketing/site"

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

  const t = await getTranslations("marketing.blog")
  const related = await getSitePosts({ limit: 4 })
  const relatedPosts = (related?.posts ?? [])
    .filter((entry) => entry.slug !== slug)
    .slice(0, 3)

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
        <article className="mt-8 leading-relaxed text-accent-foreground/90">
          <MarkdownContent>{post.content}</MarkdownContent>
        </article>
      </Container>

      {relatedPosts.length ? (
        <Container className="mx-auto mt-16 max-w-3xl">
          <h2 className="font-heading text-xl font-medium">{t("related")}</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {relatedPosts.map((entry) => (
              <Link
                key={entry.slug}
                href={`/blog/${entry.slug}`}
                className="flex flex-col rounded-2xl border border-foreground/10 bg-background/20 p-4 transition-colors hover:border-foreground/20"
              >
                <span className="text-sm font-medium">{entry.title}</span>
                <span className="mt-2 line-clamp-2 text-xs text-accent-foreground/70">
                  {entry.excerpt}
                </span>
              </Link>
            ))}
          </div>
        </Container>
      ) : null}
    </Wrapper>
  )
}
