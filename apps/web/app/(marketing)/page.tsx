import Analysis from "@/features/marketing/components/analysis"
import Companies from "@/features/marketing/components/companies"
import CtaSection from "@/features/marketing/components/cta-section"
import FAQ from "@/features/marketing/components/faq"
import Features from "@/features/marketing/components/features"
import Hero from "@/features/marketing/components/hero"
import Integration from "@/features/marketing/components/integration"
import LanguageSupport from "@/features/marketing/components/language-support"
import Pricing from "@/features/marketing/components/pricing"
import Wrapper from "@/features/marketing/components/wrapper"
import { toMarketingPlans } from "@/features/marketing/plans"
import { getSiteOverview, hasSession } from "@/features/marketing/site"

export default async function MarketingHomePage() {
  const [site, signedIn] = await Promise.all([getSiteOverview(), hasSession()])
  const registrationEnabled = site?.settings.registrationEnabled ?? true
  const plans = toMarketingPlans(
    site?.plans ?? [],
    signedIn,
    registrationEnabled
  )

  return (
    <Wrapper className="relative py-20">
      <Hero signedIn={signedIn} registrationEnabled={registrationEnabled} />
      <Companies />
      <Features />
      <Analysis />
      <Integration
        signedIn={signedIn}
        registrationEnabled={registrationEnabled}
      />
      <Pricing plans={plans} />
      <FAQ faqs={site?.faqs ?? []} />
      <LanguageSupport languages={site?.languages ?? []} />
      <CtaSection signedIn={signedIn} />
    </Wrapper>
  )
}
