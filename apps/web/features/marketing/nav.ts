import type { PublicSiteSections } from "@workspace/contracts"

export interface MarketingNavLink {
  key: "features" | "pricing" | "blog" | "faq" | "contact"
  href: string
  section?: keyof PublicSiteSections
}

export const MARKETING_NAV_LINKS: MarketingNavLink[] = [
  { key: "features", href: "/#features" },
  { key: "pricing", href: "/pricing", section: "showPricing" },
  { key: "blog", href: "/blog", section: "showBlog" },
  { key: "faq", href: "/faqs", section: "showFaqs" },
  { key: "contact", href: "/contact", section: "showContact" },
]

export function visibleNavLinks(
  sections: PublicSiteSections | null
): MarketingNavLink[] {
  if (!sections) return MARKETING_NAV_LINKS
  return MARKETING_NAV_LINKS.filter(
    (link) => !link.section || sections[link.section] === true
  )
}
