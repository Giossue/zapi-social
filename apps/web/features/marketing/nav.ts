export interface MarketingNavLink {
  key: "features" | "pricing" | "blog" | "faq"
  href: string
}

export const MARKETING_NAV_LINKS: MarketingNavLink[] = [
  { key: "features", href: "/#features" },
  { key: "pricing", href: "/#pricing" },
  { key: "blog", href: "/blog" },
  { key: "faq", href: "/#faq" },
]
