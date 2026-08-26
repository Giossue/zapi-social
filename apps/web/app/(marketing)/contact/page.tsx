import { ClockIcon, MailIcon, PhoneIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"

import Container from "@/features/marketing/components/container"
import MarketingPageHeader from "@/features/marketing/components/page-header"
import Wrapper from "@/features/marketing/components/wrapper"
import { getSiteOverview } from "@/features/marketing/site"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.contact")
  return { title: t("title"), description: t("subtitle") }
}

export default async function ContactPage() {
  const site = await getSiteOverview()
  if (site && !site.sections.showContact) notFound()

  const t = await getTranslations("marketing.contact")
  const settings = site?.settings

  const entries = [
    settings?.contactEmail
      ? {
          key: "email",
          icon: MailIcon,
          label: t("email"),
          value: settings.contactEmail,
          href: `mailto:${settings.contactEmail}`,
        }
      : null,
    settings?.contactPhone
      ? {
          key: "phone",
          icon: PhoneIcon,
          label: t("phone"),
          value: settings.contactPhone,
          href: `tel:${settings.contactPhone.replace(/\s+/g, "")}`,
        }
      : null,
    settings?.supportHours
      ? {
          key: "hours",
          icon: ClockIcon,
          label: t("hours"),
          value: settings.supportHours,
          href: null,
        }
      : null,
  ].filter((entry) => entry !== null)

  return (
    <Wrapper className="relative py-20 lg:py-32">
      <MarketingPageHeader title={t("title")} description={t("subtitle")} />

      <Container className="mt-12">
        {entries.length ? (
          <div className="mx-auto grid w-full max-w-3xl gap-4 md:grid-cols-3">
            {entries.map((entry) => (
              <div
                key={entry.key}
                className="flex flex-col items-start rounded-2xl border border-foreground/10 bg-background/20 p-6"
              >
                <entry.icon className="size-5 text-primary" />
                <span className="mt-4 text-sm text-muted-foreground">
                  {entry.label}
                </span>
                {entry.href ? (
                  <Link
                    href={entry.href}
                    className="link mt-1 text-base transition-all duration-300 hover:text-foreground"
                  >
                    {entry.value}
                  </Link>
                ) : (
                  <span className="mt-1 text-base">{entry.value}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-accent-foreground/70">{t("empty")}</p>
        )}
      </Container>
    </Wrapper>
  )
}
