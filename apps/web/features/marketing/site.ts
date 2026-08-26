import { cookies } from "next/headers"

import { publicSiteApi } from "@workspace/api-client"
import type {
  PublicSiteFaqsQuery,
  PublicSiteFaqsResponse,
  PublicSiteOverview,
  PublicSitePage,
  PublicSitePost,
  PublicSitePostsQuery,
  PublicSitePostsResponse,
  PublicSiteSections,
} from "@workspace/contracts"

const sessionCookieName = "zapi_session"

async function tolerate<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch {
    return null
  }
}

const DEFAULT_SECTIONS: PublicSiteSections = {
  landingEnabled: true,
  docsUrl: "",
  showPricing: true,
  showFaqs: true,
  showBlog: true,
  showLanguages: true,
  showContact: true,
  featuredPlansLimit: 3,
  featuredFaqsLimit: 6,
  latestPostsLimit: 3,
}

export async function getSiteOverview(): Promise<PublicSiteOverview | null> {
  const site = await tolerate<PublicSiteOverview>(() =>
    publicSiteApi.overview()
  )
  if (!site) return null
  return {
    ...site,
    sections: { ...DEFAULT_SECTIONS, ...(site.sections ?? {}) },
    stats: site.stats ?? { plans: 0, posts: 0, faqs: 0 },
    latestPosts: site.latestPosts ?? [],
    plans: site.plans ?? [],
    faqs: site.faqs ?? [],
    languages: site.languages ?? [],
    pages: site.pages ?? [],
  }
}

export const getSitePosts = (query: Partial<PublicSitePostsQuery> = {}) =>
  tolerate<PublicSitePostsResponse>(() => publicSiteApi.posts(query))

export const getSiteFaqs = (query: Partial<PublicSiteFaqsQuery> = {}) =>
  tolerate<PublicSiteFaqsResponse>(() => publicSiteApi.faqs(query))

export const getSitePost = (slug: string) =>
  tolerate<PublicSitePost>(() => publicSiteApi.post(slug))

export const getSitePage = (slug: string) =>
  tolerate<PublicSitePage>(() => publicSiteApi.page(slug))

export async function hasSession(): Promise<boolean> {
  const store = await cookies()
  return store.has(sessionCookieName)
}
