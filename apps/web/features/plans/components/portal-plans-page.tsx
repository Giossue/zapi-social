"use client"

import { ApiError, portalBillingApi } from "@workspace/api-client"
import type { PortalPlan, PortalPlansResponse } from "@workspace/contracts"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { Check, CircleAlert, CreditCard, Sparkles } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useApiErrorMessage } from "@/lib/api-error-message"
import { PageLoading } from "@/components/page-loading"

type BillingInterval = "monthly" | "yearly"

function PlansLoading() {
  const t = useTranslations("portalPlans")

  return <PageLoading aria-label={t("loading")} />
}

export function PortalPlansPage() {
  const t = useTranslations("portalPlans")
  const format = useFormatter()
  const apiErrorMessage = useApiErrorMessage()
  const [catalog, setCatalog] = useState<PortalPlansResponse | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [interval, setInterval] = useState<BillingInterval>("monthly")
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const nextCatalog = await portalBillingApi.plans()
      setCatalog(nextCatalog)
      const current = nextCatalog.plans.find(
        (plan) => plan.id === nextCatalog.currentPlanId
      )
      if (current && !current.isFree) setInterval(current.billingType)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  function retry() {
    setLoading(true)
    void load()
  }

  const plansByInterval = useMemo(
    () => ({
      monthly:
        catalog?.plans.filter(
          (plan) => plan.isFree || plan.billingType === "monthly"
        ) ?? [],
      yearly:
        catalog?.plans.filter(
          (plan) => plan.isFree || plan.billingType === "yearly"
        ) ?? [],
    }),
    [catalog]
  )

  if (loading) return <PlansLoading />

  if (error || !catalog) {
    return (
      <Card variant="subtle">
        <CardHeader>
          <CardTitle>{t("loadFailedTitle")}</CardTitle>
          <CardDescription>{t("loadFailedDescription")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={retry} variant="brand-secondary">
            {t("retry")}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const activeCatalog = catalog
  const currentPlan = activeCatalog.plans.find(
    (plan) => plan.id === activeCatalog.currentPlanId
  )
  const subscriptionActive =
    activeCatalog.subscription?.status === "active" ||
    activeCatalog.subscription?.status === "trialing"

  function limitValue(value: number) {
    return value < 0 ? t("unlimited") : format.number(value)
  }

  function planFeatures(plan: PortalPlan) {
    return [
      t("features.channels", { value: limitValue(plan.limits.maxChannels) }),
      t("features.posts", {
        value: limitValue(plan.limits.maxPostsPerMonth),
      }),
      t("features.team", {
        value: limitValue(plan.limits.maxTeamMembers),
      }),
      t("features.storage", {
        value: limitValue(plan.limits.maxStorageMb),
      }),
      t("features.credits", {
        value: limitValue(plan.limits.creditsPerMonth),
      }),
      t("features.modules", { count: plan.limits.enabledModules.length }),
    ]
  }

  function actionLabel(plan: PortalPlan) {
    if (plan.id === activeCatalog.currentPlanId) return t("planCurrent")
    if (plan.isFree || subscriptionActive) return t("changeWithSupport")
    if (!activeCatalog.canManageBilling) return t("ownerOnly")
    if (!activeCatalog.checkoutAvailable) return t("unavailable")
    return t("selectPlan")
  }

  function actionDisabled(plan: PortalPlan) {
    return (
      plan.id === activeCatalog.currentPlanId ||
      plan.isFree ||
      subscriptionActive ||
      !activeCatalog.canManageBilling ||
      !activeCatalog.checkoutAvailable ||
      pendingPlanId !== null
    )
  }

  async function checkout(plan: PortalPlan) {
    if (actionDisabled(plan)) return
    setPendingPlanId(plan.id)
    try {
      const response = await portalBillingApi.checkout({ planId: plan.id })
      window.location.assign(response.checkoutUrl)
    } catch (nextError) {
      const message =
        nextError instanceof ApiError
          ? apiErrorMessage(nextError.code)
          : t("checkoutFailed")
      toast.error(message)
      setPendingPlanId(null)
    }
  }

  function renewalValue() {
    const periodEnd = activeCatalog.subscription?.currentPeriodEndsAt
    if (!periodEnd) return t("renewalNone")
    const date = format.dateTime(new Date(periodEnd), "date")
    return activeCatalog.subscription?.cancelAtPeriodEnd
      ? t("renewalEndsValue", { date })
      : t("renewalValue", { date })
  }

  function subscriptionBadge() {
    const status = activeCatalog.subscription?.status
    if (!status) return <Badge variant="success">{t("active")}</Badge>
    let variant: "success" | "warning" | "neutral" = "neutral"
    if (status === "active" || status === "trialing") variant = "success"
    if (status === "past_due" || status === "unpaid") variant = "warning"
    return <Badge variant={variant}>{t(`subscriptionStatus.${status}`)}</Badge>
  }

  const billingNotice = !activeCatalog.canManageBilling
    ? t("ownerTitle")
    : !activeCatalog.checkoutAvailable
      ? t("billingUnavailableTitle")
      : subscriptionActive
        ? t("changeUnavailableTitle")
        : null

  function planGrid(plans: PortalPlan[]) {
    if (!plans.length) {
      return (
        <Card variant="subtle">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CreditCard />
              </EmptyMedia>
              <EmptyTitle>{t("noPlansTitle")}</EmptyTitle>
              <EmptyDescription>{t("noPlansDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      )
    }

    return (
      <div className="flex flex-wrap justify-center gap-3">
        {plans.map((plan) => {
          const price = format.number(plan.priceMinor / 100, {
            style: "currency",
            currency: plan.currency,
            maximumFractionDigits: 0,
          })

          return (
            <Card
              className="w-full sm:max-w-sm"
              data-selected={plan.featured || undefined}
              key={plan.id}
              variant="subtle"
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                {plan.featured ? (
                  <CardAction>
                    <Badge variant="secondary">
                      <Sparkles aria-hidden="true" />
                      {t("recommended")}
                    </Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 text-sm">
                {!plan.isFree ? (
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-semibold tracking-tight">
                      {price}
                    </span>
                    <span className="pb-1 text-sm text-muted-foreground">
                      {t(`pricePeriod.${plan.billingType}`)}
                    </span>
                  </div>
                ) : null}
                {plan.trialDays > 0 ? (
                  <Badge variant="outline">
                    {t("trialDays", { count: plan.trialDays })}
                  </Badge>
                ) : null}
                <ul className="flex flex-col gap-2">
                  {planFeatures(plan).map((feature) => (
                    <li className="flex items-start gap-2" key={feature}>
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-primary"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={actionDisabled(plan)}
                  onClick={() => void checkout(plan)}
                  variant={plan.featured ? "default" : "brand-secondary"}
                >
                  {pendingPlanId === plan.id ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  {pendingPlanId === plan.id
                    ? t("checkoutPending")
                    : actionLabel(plan)}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("pageTitle")}
        </h1>
      </header>

      {currentPlan ? (
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>{currentPlan.name}</CardTitle>
            <CardDescription>
              {t("currentPlan")} · {renewalValue()}
            </CardDescription>
            <CardAction>{subscriptionBadge()}</CardAction>
          </CardHeader>
        </Card>
      ) : null}

      {billingNotice ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{billingNotice}</AlertTitle>
        </Alert>
      ) : null}

      <Tabs
        className="gap-4"
        onValueChange={(value) => setInterval(value as BillingInterval)}
        value={interval}
      >
        <TabsList aria-label={t("periodLabel")} className="mx-auto">
          <TabsTrigger value="monthly">{t("monthly")}</TabsTrigger>
          <TabsTrigger value="yearly">{t("annual")}</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly">
          {planGrid(plansByInterval.monthly)}
        </TabsContent>
        <TabsContent value="yearly">
          {planGrid(plansByInterval.yearly)}
        </TabsContent>
      </Tabs>
    </div>
  )
}
