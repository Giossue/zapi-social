import type { Metadata } from "next"
import Script from "next/script"

import { cn } from "@workspace/ui/lib/utils"

import Footer from "@/features/marketing/components/footer"
import Navbar from "@/features/marketing/components/navbar"
import { instrumentSerif, satoshi } from "@/features/marketing/fonts"
import { getSiteOverview, hasSession } from "@/features/marketing/site"

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteOverview()
  const settings = site?.settings
  if (!settings?.siteName) return {}
  return {
    title: settings.siteDescription
      ? `${settings.siteName} - ${settings.siteDescription}`
      : settings.siteName,
    description: settings.siteDescription || undefined,
  }
}

export default async function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [site, signedIn] = await Promise.all([getSiteOverview(), hasSession()])
  const settings = site?.settings ?? null
  const measurementId = settings?.analytics?.measurementId

  return (
    <div
      className={cn(
        "marketing min-h-screen overflow-x-hidden bg-background text-foreground",
        satoshi.variable,
        instrumentSerif.variable
      )}
    >
      <Navbar
        signedIn={signedIn}
        hasFaqs={Boolean(site?.faqs.length)}
        registrationEnabled={settings?.registrationEnabled ?? true}
      />
      <main className="relative z-40 mx-auto w-full">{children}</main>
      <Footer
        settings={settings}
        pages={site?.pages ?? []}
        registrationEnabled={settings?.registrationEnabled ?? true}
      />
      {measurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${measurementId}');`}
          </Script>
        </>
      ) : null}
    </div>
  )
}
