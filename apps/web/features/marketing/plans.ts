import type { PublicSitePlan } from "@workspace/contracts"

import { marketingCta } from "./cta"

export interface MarketingPlan {
  slug: string
  name: string
  description: string
  currency: string
  monthlyPrice: number
  yearlyPrice: number
  featured: boolean
  isFree: boolean
  features: string[]
  href: string
}

const YEARLY_DISCOUNT = 0.88

function planFeatures(description: string): string[] {
  const lines = description
    .split(/\r?\n|·/)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length > 1 ? lines : []
}

export function toMarketingPlans(
  plans: PublicSitePlan[],
  signedIn: boolean,
  registrationEnabled: boolean
): MarketingPlan[] {
  const byName = new Map<
    string,
    { monthly?: PublicSitePlan; yearly?: PublicSitePlan }
  >()

  for (const plan of plans) {
    const entry = byName.get(plan.name) ?? {}
    entry[plan.billingType === "yearly" ? "yearly" : "monthly"] = plan
    byName.set(plan.name, entry)
  }

  const result: MarketingPlan[] = []

  for (const [name, entry] of byName) {
    const base = entry.monthly ?? entry.yearly
    if (!base) continue

    const monthlyPrice = (entry.monthly ?? base).priceMinor / 100
    const yearlyPrice = entry.yearly
      ? entry.yearly.priceMinor / 100
      : Math.round(monthlyPrice * 12 * YEARLY_DISCOUNT)

    const cta = marketingCta(signedIn, registrationEnabled)

    result.push({
      slug: base.slug,
      name,
      description: base.description,
      currency: base.currency,
      monthlyPrice,
      yearlyPrice,
      featured: base.featured,
      isFree: base.isFree,
      features: planFeatures(base.description),
      href:
        signedIn || !registrationEnabled
          ? cta.href
          : `/register?plan=${encodeURIComponent(base.slug)}`,
    })
  }

  return result.sort((a, b) => a.monthlyPrice - b.monthlyPrice)
}
