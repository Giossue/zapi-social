import { ArrowRightIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import type { PublicSitePostSummary } from "@workspace/contracts"

import Container from "./container"

const LatestPosts = async ({ posts }: { posts: PublicSitePostSummary[] }) => {
  if (!posts.length) return null

  const t = await getTranslations("marketing.latestPosts")

  return (
    <div
      id="blog"
      className="relative flex w-full flex-col items-center justify-center py-20"
    >
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-heading text-2xl leading-snug! font-medium md:text-4xl lg:text-5xl">
            {t.rich("title", {
              accent: (chunks) => (
                <span className="font-subheading italic">{chunks}</span>
              ),
            })}
          </h2>
          <p className="mt-4 text-center text-base text-accent-foreground/80 md:text-lg">
            {t("subtitle")}
          </p>
        </div>
      </Container>

      <Container delay={0.1} className="mt-12">
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
              <h3 className="mt-2 text-lg font-medium">{post.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-accent-foreground/80">
                {post.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </Container>

      <Container delay={0.2} className="mt-10">
        <div className="flex items-center justify-center">
          <Link
            href="/blog"
            className="link inline-flex items-center gap-2 text-sm transition-all duration-300 hover:text-foreground"
          >
            {t("all")}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </Container>
    </div>
  )
}

export default LatestPosts
