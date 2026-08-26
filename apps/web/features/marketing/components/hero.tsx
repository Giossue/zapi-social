import { ArrowRightIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import { marketingCta } from "@/features/marketing/cta"

import Container from "./container"
import Icons from "./icons"
import { OrbitingCircles } from "./orbiting-circles"

interface HeroProps {
  signedIn: boolean
  registrationEnabled: boolean
}

const Hero = async ({ signedIn, registrationEnabled }: HeroProps) => {
  const t = await getTranslations("marketing.hero")
  const tCta = await getTranslations("marketing.cta")
  const cta = marketingCta(signedIn, registrationEnabled)

  return (
    <div className="relative flex w-full flex-col items-center justify-center py-20">
      <div className="absolute top-0 left-1/2 -z-10 flex size-40 -translate-x-1/2 rounded-full bg-blue-500 blur-[10rem] lg:hidden" />

      <div className="relative flex flex-col items-center justify-center gap-y-8">
        <Container className="absolute inset-0 top-0 -z-10 mb-auto hidden min-h-screen w-full flex-col items-center justify-center lg:flex">
          <OrbitingCircles speed={0.5} radius={300}>
            <Icons.circle1 className="size-4 text-foreground/70" />
            <Icons.circle2 className="size-1 text-foreground/80" />
          </OrbitingCircles>
          <OrbitingCircles speed={0.25} radius={400}>
            <Icons.circle2 className="size-1 text-foreground/50" />
            <Icons.circle1 className="size-4 text-foreground/60" />
            <Icons.circle2 className="size-1 text-foreground/90" />
          </OrbitingCircles>
          <OrbitingCircles speed={0.1} radius={500}>
            <Icons.circle2 className="size-1 text-foreground/50" />
            <Icons.circle2 className="size-1 text-foreground/90" />
            <Icons.circle1 className="size-4 text-foreground/60" />
            <Icons.circle2 className="size-1 text-foreground/90" />
          </OrbitingCircles>
        </Container>

        <div className="flex flex-col items-center justify-center gap-y-4 bg-background/0 text-center">
          <Container className="relative hidden overflow-hidden lg:block">
            <div className="group relative mx-auto grid overflow-hidden rounded-full px-2 py-1 shadow-[0_1000px_0_0_hsl(0_0%_15%)_inset] transition-colors duration-200">
              <span>
                <span className="spark mask-gradient absolute inset-0 h-full w-full animate-flip overflow-hidden rounded-full [mask:linear-gradient(white,_transparent_50%)] before:absolute before:[inset:0_auto_auto_50%] before:aspect-square before:w-[200%] before:[translate:-50%_-15%] before:rotate-[-90deg] before:animate-rotate before:bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] before:content-['']" />
              </span>
              <span className="backdrop absolute inset-[1px] rounded-full bg-background transition-colors duration-200 group-hover:bg-neutral-800" />
              <span className="z-10 flex items-center py-0.5 text-sm text-neutral-100">
                <span className="mr-2 flex h-[18px] items-center justify-center rounded-full bg-gradient-to-r from-sky-400 to-blue-600 px-2 py-[0.5px] text-[9px] font-medium tracking-wide text-white">
                  {t("badge")}
                </span>
                {t("announcement")}
              </span>
            </div>
          </Container>
          <Container delay={0.15}>
            <h1 className="mx-auto max-w-4xl text-center text-4xl leading-tight! font-bold md:text-4xl lg:text-7xl">
              {t("title")}
            </h1>
          </Container>
          <Container delay={0.2}>
            <p className="mx-auto mt-2 max-w-xl text-center text-base text-muted-foreground lg:text-lg">
              {t("subtitle")}
            </p>
          </Container>
          <Container delay={0.25} className="z-20">
            <div className="mt-6 flex items-center justify-center gap-x-4">
              <Link href={cta.href} className="group flex items-center gap-2">
                <Button size="lg">
                  {tCta(cta.messageKey)}
                  <ArrowRightIcon className="size-4 transition-all duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </Container>
          <Container delay={0.3} className="relative">
            <div className="relative mx-auto mt-10 max-w-6xl rounded-xl border border-border p-2 backdrop-blur-lg lg:rounded-[32px]">
              <div className="absolute inset-0 top-[12.5%] left-1/2 -z-10 h-1/4 w-1/2 -translate-x-1/2 -translate-y-1/2 animate-image-glow bg-gradient-to-r from-sky-500 to-blue-600 blur-[4rem] lg:w-3/4 lg:blur-[10rem]" />
              <div className="absolute inset-0 -top-[12.5%] left-1/2 -z-20 hidden h-1/4 w-1/4 -translate-x-1/2 -translate-y-1/2 animate-image-glow bg-blue-600 blur-[10rem] lg:block" />

              <div className="rounded-lg border border-border bg-background lg:rounded-[22px]">
                <Image
                  src="/marketing/dashboard.png"
                  alt={t("dashboardAlt")}
                  width={1920}
                  height={1080}
                  priority
                  className="rounded-lg lg:rounded-[20px]"
                />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1/2 w-full bg-gradient-to-t from-background to-transparent" />
          </Container>
        </div>
      </div>
    </div>
  )
}

export default Hero
