import { ArrowRightIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import Link from "next/link"

import { MarketingButton } from "./button"
import { cn } from "@workspace/ui/lib/utils"

import { marketingCta } from "@/features/marketing/cta"

import Container from "./container"
import Icons from "./icons"
import Ripple from "./ripple"

const SOCIAL_PLATFORMS = [
  {
    icon: Icons.linkedin,
    offset: "-translate-x-[285px]",
    size: "size-12",
    iconSize: "size-5",
    className: "hidden lg:flex",
  },
  {
    icon: Icons.tiktok,
    offset: "-translate-x-[210px]",
    size: "size-16",
    iconSize: "size-7",
  },
  {
    icon: Icons.insta,
    offset: "-translate-x-[125px]",
    size: "size-20",
    iconSize: "size-10",
  },
  {
    icon: Icons.whatsapp,
    offset: "translate-x-[125px]",
    size: "size-20",
    iconSize: "size-10",
  },
  {
    icon: Icons.x,
    offset: "translate-x-[210px]",
    size: "size-16",
    iconSize: "size-7",
  },
  {
    icon: Icons.facebook,
    offset: "translate-x-[285px]",
    size: "size-12",
    iconSize: "size-5",
    className: "hidden lg:flex",
  },
]

interface IntegrationProps {
  signedIn: boolean
  registrationEnabled: boolean
}

const Integration = async ({
  signedIn,
  registrationEnabled,
}: IntegrationProps) => {
  const t = await getTranslations("marketing.integration")
  const tCta = await getTranslations("marketing.cta")
  const cta = marketingCta(signedIn, registrationEnabled)

  return (
    <div className="relative flex w-full flex-col items-center justify-center py-20">
      <Container className="relative">
        <div className="relative flex flex-col items-center justify-center overflow-visible lg:hidden">
          <div className="absolute top-1/2 right-1/4 -z-10 h-14 w-3/5 -translate-y-1/2 -rotate-12 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 blur-[6.5rem] lg:h-20" />

          <div className="mx-auto mt-8 h-auto w-full max-w-sm">
            <Image
              src="/marketing/integration.svg"
              alt={t("illustrationAlt")}
              width={1000}
              height={1000}
              className="h-auto w-full"
            />
          </div>
        </div>
      </Container>

      <div className="inset-x-0 mx-auto mt-12 flex max-w-3xl flex-col items-center text-center lg:absolute lg:top-1/4 lg:mt-0">
        <h2 className="font-heading text-2xl leading-snug! font-semibold md:text-4xl lg:text-6xl">
          {t("title")}
        </h2>
      </div>
      <div className="inset-x-0 z-20 mx-auto mt-8 flex max-w-3xl flex-col items-center text-center lg:absolute lg:bottom-1/4 lg:mt-0">
        <Link href={cta.href}>
          <MarketingButton size="lg">
            {signedIn ? tCta("dashboard") : t("action")}
            <ArrowRightIcon className="size-4" />
          </MarketingButton>
        </Link>
      </div>

      <Container delay={0.3}>
        <div className="relative hidden items-center justify-center overflow-visible lg:flex">
          <div className="absolute top-1/2 right-1/4 -z-10 h-14 w-3/5 -translate-y-1/2 -rotate-12 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 blur-[6.5rem] lg:h-20" />

          <div className="relative flex h-dvh w-full flex-col items-center justify-center overflow-visible">
            <Ripple />
          </div>

          <div className="group absolute z-20 flex items-center justify-center">
            <Icons.icon className="size-24 transition-all duration-500 group-hover:scale-110" />
          </div>

          {SOCIAL_PLATFORMS.map((platform, index) => (
            <div
              key={index}
              className={cn(
                "absolute z-20 flex items-center justify-center rounded-full bg-gradient-to-b from-foreground/5 to-transparent p-3 shadow-xl shadow-black/10 backdrop-blur-lg transition-all duration-300 hover:scale-110",
                platform.offset,
                platform.size,
                platform.className
              )}
            >
              <platform.icon
                className={cn("size-auto text-foreground", platform.iconSize)}
              />
            </div>
          ))}
        </div>
      </Container>
    </div>
  )
}

export default Integration
