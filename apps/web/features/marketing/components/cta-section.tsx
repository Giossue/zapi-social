"use client"

import { ArrowRightIcon } from "lucide-react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"

import { MarketingButton } from "./button"

import Container from "./container"
import Particles from "./particles"

const CtaSection = ({ signedIn }: { signedIn: boolean }) => {
  const t = useTranslations("marketing.callToAction")
  const tCta = useTranslations("marketing.cta")

  return (
    <div className="relative flex w-full flex-col items-center justify-center py-20">
      <Container className="mx-auto max-w-6xl py-20">
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-foreground/20 bg-background/20 px-0 py-12 text-center lg:rounded-3xl lg:py-20">
          <Particles
            refresh
            ease={80}
            quantity={80}
            color="#d4d4d4"
            className="absolute inset-0 z-0 hidden lg:block"
          />
          <Particles
            refresh
            ease={80}
            quantity={35}
            color="#d4d4d4"
            className="absolute inset-0 z-0 block lg:hidden"
          />

          <motion.div
            className="absolute -bottom-[12.5%] left-1/3 -z-10 h-32 w-44 -translate-x-1/2 rounded-full blur-[5rem] lg:h-52 lg:w-1/3 lg:blur-[10rem]"
            style={{
              background:
                "conic-gradient(from 0deg at 50% 50%, #a855f7 0deg, #3b82f6 180deg, #06b6d4 360deg)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
          <h2 className="font-heading text-3xl leading-snug! font-medium md:text-5xl lg:text-6xl">
            {t.rich("title", {
              br: () => <br />,
              accent: (chunks) => (
                <span className="font-subheading italic">{chunks}</span>
              ),
            })}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-accent-foreground/80 md:text-lg">
            {t("subtitle")}
          </p>
          <Link
            href={signedIn ? "/portal/dashboard" : "/#pricing"}
            className="mt-8"
          >
            <MarketingButton size="lg">
              {signedIn ? tCta("dashboard") : t("action")}
              <ArrowRightIcon className="size-4" />
            </MarketingButton>
          </Link>
        </div>
      </Container>
    </div>
  )
}

export default CtaSection
