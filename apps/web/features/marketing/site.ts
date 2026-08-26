import { cookies } from "next/headers"

import { publicSiteApi } from "@workspace/api-client"
import type {
  PublicSiteOverview,
  PublicSitePage,
  PublicSitePost,
  PublicSitePostsQuery,
  PublicSitePostsResponse,
} from "@workspace/contracts"

const sessionCookieName = "zapi_session"

async function tolerate<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch {
    return null
  }
}

export const getSiteOverview = () =>
  tolerate<PublicSiteOverview>(() => publicSiteApi.overview())

export const getSitePosts = (query: Partial<PublicSitePostsQuery> = {}) =>
  tolerate<PublicSitePostsResponse>(() => publicSiteApi.posts(query))

export const getSitePost = (slug: string) =>
  tolerate<PublicSitePost>(() => publicSiteApi.post(slug))

export const getSitePage = (slug: string) =>
  tolerate<PublicSitePage>(() => publicSiteApi.page(slug))

export async function hasSession(): Promise<boolean> {
  const store = await cookies()
  return store.has(sessionCookieName)
}
