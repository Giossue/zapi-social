"use client"

import NumberFlow from "@number-flow/react"
import { ArrowRightIcon, CheckIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"

import { MarketingButton } from "./button"
import { cn } from "@workspace/ui/lib/utils"

import type { MarketingPlan } from "@/features/marketing/plans"

import Container from "./container"

type BillingCycle = "monthly" | "yearly"

const Pricing = ({ plans }: { plans: MarketingPlan[] }) => {
  const t = useTranslations("marketing.pricing")
  const [cycle, setCycle] = useState<BillingCycle>("monthly")

  if (!plans.length) return null

  return (
    <div
      id="pricing"
      className="relative mx-auto flex max-w-5xl flex-col items-center justify-center py-20"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center">
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <h2 className="mt-6 font-heading text-2xl leading-snug! font-medium md:text-4xl lg:text-5xl">
              {t.rich("title", {
                br: () => <br className="hidden lg:block" />,
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

        <Container delay={0.2}>
          <div className="mt-6 flex items-center justify-center space-x-4">
            <span className="text-base font-medium">{t("monthly")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={cycle === "yearly"}
              aria-label={t("toggleLabel")}
              onClick={() =>
                setCycle((prev) => (prev === "monthly" ? "yearly" : "monthly"))
              }
              className="relative rounded-full focus:outline-hidden"
            >
              <div className="h-6 w-12 rounded-full bg-primary shadow-md outline-hidden transition" />
              <div
                className={cn(
                  "absolute top-1 left-1 inline-flex size-4 items-center justify-center rounded-full bg-white transition-all duration-500 ease-in-out",
                  cycle === "yearly" ? "translate-x-6" : "translate-x-0"
                )}
              />
            </button>
            <span className="text-base font-medium">{t("yearly")}</span>
          </div>
        </Container>
      </div>

      <div
        className={cn(
          "mx-auto grid w-full grid-cols-1 gap-4 pt-8 lg:gap-6 lg:pt-12",
          plans.length === 1 && "max-w-md",
          plans.length === 2 && "max-w-4xl lg:grid-cols-2",
          plans.length > 2 && "max-w-6xl md:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {plans.map((plan, index) => (
          <Container key={plan.slug} delay={0.1 * index + 0.2}>
            <PlanCard plan={plan} cycle={cycle} />
          </Container>
        ))}
      </div>
    </div>
  )
}

const PlanCard = ({
  plan,
  cycle,
}: {
  plan: MarketingPlan
  cycle: BillingCycle
}) => {
  const t = useTranslations("marketing.pricing")

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-start overflow-hidden rounded-2xl border border-foreground/10 transition-all lg:rounded-3xl",
        plan.featured && "border-primary"
      )}
    >
      {plan.featured ? (
        <div className="absolute inset-x-0 top-1/2 -z-10 mx-auto h-12 w-full -rotate-45 rounded-2xl bg-primary blur-[8rem] lg:rounded-3xl" />
      ) : null}

      <div className="relative flex w-full flex-col items-start rounded-t-2xl p-4 md:p-8 lg:rounded-t-3xl">
        <h3 className="pt-5 text-xl font-medium text-foreground">
          {plan.name}
        </h3>
        <h4 className="mt-3 text-3xl font-medium md:text-5xl">
          <NumberFlow
            value={cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
            suffix={cycle === "monthly" ? t("perMonth") : t("perYear")}
            format={{
              currency: plan.currency,
              style: "currency",
              currencySign: "standard",
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
              currencyDisplay: "narrowSymbol",
            }}
          />
        </h4>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {plan.description}
        </p>
      </div>

      <div className="flex w-full flex-col items-start px-4 py-2 md:px-8">
        <Link href={plan.href} className="group w-full">
          <MarketingButton
            size="lg"
            variant={plan.featured ? "blue" : "white"}
            className="w-full"
          >
            {plan.isFree ? t("chooseFree") : t("choose", { name: plan.name })}
            <ArrowRightIcon className="size-4 transition-all duration-300 group-hover:translate-x-1" />
          </MarketingButton>
        </Link>
        <div className="mx-auto h-8 w-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={cycle}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto mt-3 block text-center text-sm text-muted-foreground"
            >
              {cycle === "monthly" ? t("billedMonthly") : t("billedYearly")}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      <div
        className={cn(
          "mb-4 ml-1 w-full flex-col items-start gap-y-2 p-5",
          plan.features.length ? "flex" : "hidden"
        )}
      >
        <span className="mb-2 text-left text-base">{t("includes")}</span>
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-center justify-start gap-2">
            <div className="flex items-center justify-center">
              <CheckIcon className="size-5" />
            </div>
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Pricing
