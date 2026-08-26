import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import Container from "@/features/marketing/components/container"
import Wrapper from "@/features/marketing/components/wrapper"
import { getSitePosts } from "@/features/marketing/site"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.blog")
  return { title: t("title"), description: t("subtitle") }
}

export default async function BlogPage() {
  const t = await getTranslations("marketing.blog")
  const data = await getSitePosts()
  const posts = data?.posts ?? []

  return (
    <Wrapper className="relative py-20 lg:py-32">
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="font-heading text-3xl leading-snug! font-medium md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-base text-accent-foreground/80 md:text-lg">
            {t("subtitle")}
          </p>
        </div>
      </Container>
      <Container className="mt-12">
        {posts.length ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="flex flex-col rounded-2xl border border-foreground/10 bg-background/20 p-6 transition-colors hover:border-foreground/20"
              >
                {post.categoryName ? (
                  <span className="text-xs text-accent-foreground/60">
                    {post.categoryName}
                  </span>
                ) : null}
                <h2 className="mt-2 text-lg font-medium">{post.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-accent-foreground/80">
                  {post.excerpt}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-accent-foreground/70">{t("empty")}</p>
        )}
      </Container>
    </Wrapper>
  )
}
