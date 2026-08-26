import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import CtaSection from "@/features/marketing/components/cta-section"
import FAQ from "@/features/marketing/components/faq"
import MarketingPageHeader from "@/features/marketing/components/page-header"
import Pricing from "@/features/marketing/components/pricing"
import Wrapper from "@/features/marketing/components/wrapper"
import { toMarketingPlans } from "@/features/marketing/plans"
import { getSiteOverview, hasSession } from "@/features/marketing/site"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.pricingPage")
  return { title: t("title"), description: t("subtitle") }
}

export default async function PricingPage() {
  const [site, signedIn] = await Promise.all([getSiteOverview(), hasSession()])
  if (site && !site.sections.showPricing) notFound()

  const t = await getTranslations("marketing.pricingPage")
  const registrationEnabled = site?.settings.registrationEnabled ?? true
  const plans = toMarketingPlans(
    site?.plans ?? [],
    signedIn,
    registrationEnabled
  )
  const faqs = site?.sections.showFaqs
    ? site.faqs.slice(0, site.sections.featuredFaqsLimit)
    : []

  return (
    <Wrapper className="relative py-20 lg:py-32">
      <MarketingPageHeader title={t("title")} description={t("subtitle")} />
      <Pricing plans={plans} showHeading={false} />
      <FAQ faqs={faqs} />
      <CtaSection signedIn={signedIn} />
    </Wrapper>
  )
}
