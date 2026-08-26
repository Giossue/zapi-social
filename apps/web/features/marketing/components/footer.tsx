import { getTranslations } from "next-intl/server"
import Link from "next/link"

import type {
  PublicSitePageSummary,
  PublicSiteSettings,
} from "@workspace/contracts"

import Container from "./container"
import Icons from "./icons"

const PRODUCT_LINKS = [
  { key: "features", href: "/#features" },
  { key: "pricing", href: "/#pricing" },
  { key: "faq", href: "/#faq" },
  { key: "languages", href: "/#languages" },
] as const

const RESOURCE_LINKS = [
  { key: "blog", href: "/blog" },
  { key: "availableLanguages", href: "/#languages" },
  { key: "help", href: "/#faq" },
] as const

const linkClass = "link hover:text-foreground transition-all duration-300"

interface FooterProps {
  settings: PublicSiteSettings | null
  pages: PublicSitePageSummary[]
  registrationEnabled: boolean
}

const Footer = async ({
  settings,
  pages,
  registrationEnabled,
}: FooterProps) => {
  const t = await getTranslations("marketing")
  const tFooter = await getTranslations("marketing.footer")
  const year = String(new Date().getFullYear())

  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center border-t border-foreground/5 px-6 pt-16 pb-8 lg:px-8 lg:pt-32">
      <div className="grid w-full gap-8 xl:grid-cols-3 xl:gap-8">
        <Container>
          <div className="flex flex-col items-start justify-start md:max-w-[200px]">
            <div className="flex items-center gap-2">
              <Icons.icon className="h-5 w-auto" />
              <span className="text-base font-medium text-foreground md:text-lg">
                {t("brand")}
              </span>
            </div>
            <p className="mt-4 text-start text-sm text-muted-foreground">
              {settings?.siteDescription || tFooter("tagline")}
            </p>
            {settings?.contactEmail ? (
              <p className="mt-4 text-start text-sm text-muted-foreground">
                <Link
                  href={`mailto:${settings.contactEmail}`}
                  className={linkClass}
                >
                  {settings.contactEmail}
                </Link>
              </p>
            ) : null}
            {settings?.contactPhone ? (
              <p className="mt-1 text-start text-sm text-muted-foreground">
                {settings.contactPhone}
              </p>
            ) : null}
            {settings?.supportHours ? (
              <p className="mt-1 text-start text-sm text-muted-foreground">
                {settings.supportHours}
              </p>
            ) : null}
          </div>
        </Container>

        <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
          <div className="md:grid md:grid-cols-2 md:gap-8">
            <Container delay={0.1} className="h-auto">
              <h3 className="text-base font-medium text-foreground">
                {tFooter("product")}
              </h3>
              <ul className="mt-4 space-y-4 text-sm text-muted-foreground">
                {PRODUCT_LINKS.map((link) => (
                  <li key={link.key} className="mt-2">
                    <Link href={link.href} className={linkClass}>
                      {tFooter(`links.${link.key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Container>
            <Container delay={0.2} className="h-auto">
              <div className="mt-10 flex flex-col md:mt-0">
                <h3 className="text-base font-medium text-foreground">
                  {tFooter("getStarted")}
                </h3>
                <ul className="mt-4 space-y-4 text-sm text-muted-foreground">
                  {registrationEnabled ? (
                    <li>
                      <Link href="/register" className={linkClass}>
                        {tFooter("links.register")}
                      </Link>
                    </li>
                  ) : null}
                  <li className="mt-2">
                    <Link href="/login" className={linkClass}>
                      {tFooter("links.signIn")}
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link href="/#pricing" className={linkClass}>
                      {tFooter("links.plans")}
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link href="/#features" className={linkClass}>
                      {tFooter("links.included")}
                    </Link>
                  </li>
                </ul>
              </div>
            </Container>
          </div>
          <div className="md:grid md:grid-cols-2 md:gap-8">
            <Container delay={0.3} className="h-auto">
              <h3 className="text-base font-medium text-foreground">
                {tFooter("resources")}
              </h3>
              <ul className="mt-4 space-y-4 text-sm text-muted-foreground">
                {RESOURCE_LINKS.map((link) => (
                  <li key={link.key} className="mt-2">
                    <Link href={link.href} className={linkClass}>
                      {tFooter(`links.${link.key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Container>
            <Container delay={0.4} className="h-auto">
              <div className="mt-10 flex flex-col md:mt-0">
                <h3 className="text-base font-medium text-foreground">
                  {tFooter("legal")}
                </h3>
                <ul className="mt-4 space-y-4 text-sm text-muted-foreground">
                  {pages.map((page) => (
                    <li className="mt-2" key={page.slug}>
                      <Link href={`/${page.slug}`} className={linkClass}>
                        {page.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Container>
          </div>
        </div>
      </div>

      <Container delay={0.5} className="relative mt-12 w-full lg:mt-20">
        <div className="footer mt-8 w-full justify-center md:flex md:items-center">
          <p className="mt-8 text-sm text-muted-foreground md:mt-0">
            {tFooter("copyright", {
              year,
              company:
                settings?.companyName || settings?.siteName || t("brand"),
            })}
          </p>
        </div>
      </Container>
    </footer>
  )
}

export default Footer
