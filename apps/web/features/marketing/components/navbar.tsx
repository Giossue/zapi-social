import { ArrowRightIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import type { PublicSiteSections } from "@workspace/contracts"

import { MarketingButton } from "./button"

import { marketingCta } from "@/features/marketing/cta"
import { visibleNavLinks } from "@/features/marketing/nav"

import Icons from "./icons"
import MobileMenu from "./mobile-menu"
import Wrapper from "./wrapper"

interface NavbarProps {
  signedIn: boolean
  sections: PublicSiteSections | null
  registrationEnabled: boolean
}

const Navbar = async ({
  signedIn,
  sections,
  registrationEnabled,
}: NavbarProps) => {
  const t = await getTranslations("marketing")
  const links = visibleNavLinks(sections)
  const cta = marketingCta(signedIn, registrationEnabled)

  return (
    <header className="sticky top-0 z-50 h-16 w-full bg-background/80 backdrop-blur-xs">
      <Wrapper className="h-full">
        <div className="flex h-full items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Icons.icon className="w-6" />
              <span className="hidden text-xl font-semibold lg:block">
                {t("brand")}
              </span>
            </Link>
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <ul className="flex items-center gap-8">
              {links.map((link) => (
                <li key={link.key} className="link text-sm font-medium">
                  <Link href={link.href}>{t(`nav.${link.key}`)}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-4">
            <Link href={cta.href} className="group hidden lg:block">
              <MarketingButton variant="blue">
                {t(`cta.${cta.messageKey}`)}
                <ArrowRightIcon className="size-4 transition-all duration-300 group-hover:translate-x-1" />
              </MarketingButton>
            </Link>
            <MobileMenu
              ctaHref={cta.href}
              ctaLabel={t(`cta.${cta.messageKey}`)}
              menuLabel={t("nav.menu")}
              links={links.map((link) => ({
                href: link.href,
                label: t(`nav.${link.key}`),
              }))}
            />
          </div>
        </div>
      </Wrapper>
    </header>
  )
}

export default Navbar
