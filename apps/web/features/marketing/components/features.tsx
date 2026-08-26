import { getTranslations } from "next-intl/server"
import Image from "next/image"

import { cn } from "@workspace/ui/lib/utils"

import { MARKETING_FEATURES } from "@/features/marketing/features"

import Container from "./container"
import { MagicCard } from "./magic-card"

const Features = async () => {
  const t = await getTranslations("marketing.features")

  return (
    <div
      id="features"
      className="relative flex w-full flex-col items-center justify-center py-20"
    >
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="mt-6 font-heading text-2xl leading-snug! font-medium md:text-4xl lg:text-5xl">
            {t.rich("title", {
              br: () => <br />,
              accent: (chunks) => (
                <span className="font-subheading italic">{chunks}</span>
              ),
            })}
          </h2>
          <p className="mt-6 text-center text-base text-accent-foreground/80 md:text-lg">
            {t("subtitle")}
          </p>
        </div>
      </Container>

      <div className="relative mt-8 grid grid-cols-1 gap-6 overflow-visible md:grid-cols-2 lg:grid-cols-3">
        {MARKETING_FEATURES.map((feature, index) => (
          <Container
            key={feature.key}
            delay={0.1 + index * 0.1}
            className={cn(
              "relative flex flex-col rounded-2xl border border-border/50 bg-card transition-colors hover:border-border lg:rounded-3xl",
              index === 3 && "lg:col-span-2",
              index === 2 && "md:col-span-2 lg:col-span-1"
            )}
          >
            <MagicCard
              gradientFrom="#38bdf8"
              gradientTo="#3b82f6"
              gradientColor="rgba(59,130,246,0.1)"
              className="p-4 lg:rounded-3xl lg:p-6"
            >
              <div className="mb-4 flex items-center space-x-4">
                <h3 className="flex items-center gap-2 text-xl font-semibold">
                  <feature.icon className="size-5 text-primary" />
                  {t(`items.${feature.key}.title`)}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(`items.${feature.key}.description`)}
              </p>

              <div className="mt-6 w-full overflow-hidden bg-card/50">
                <Image
                  src={feature.image}
                  alt={t(`items.${feature.key}.title`)}
                  width={500}
                  height={500}
                  className="h-full w-full object-cover"
                />
              </div>
            </MagicCard>
          </Container>
        ))}
      </div>
    </div>
  )
}

export default Features
