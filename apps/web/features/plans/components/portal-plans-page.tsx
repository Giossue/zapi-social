"use client"

import { ApiError, portalBillingApi } from "@workspace/api-client"
import type { PortalPlan, PortalPlansResponse } from "@workspace/contracts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { toast } from "@workspace/ui/components/toast"
import {
  CalendarClock,
  Check,
  CircleAlert,
  CreditCard,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
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

  const visiblePlans = useMemo(
    () =>
      catalog?.plans.filter(
        (plan) => plan.isFree || plan.billingType === interval
      ) ?? [],
    [catalog, interval]
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
    return (
      <Badge variant={variant}>
        {t(`subscriptionStatus.${status}`)}
      </Badge>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("pageDescription")}
        </p>
      </header>

      {currentPlan ? (
        <Card variant="subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard aria-hidden="true" />
              {t("currentPlan")}
            </CardTitle>
            <CardDescription>
              {t("currentPlanDescription", { plan: currentPlan.name })}
            </CardDescription>
            <CardAction>{subscriptionBadge()}</CardAction>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-start gap-2">
              <CalendarClock className="mt-0.5" aria-hidden="true" />
              <div className="grid gap-0.5">
                <span className="font-medium">{t("renewalTitle")}</span>
                <span className="text-muted-foreground text-xs">
                  {renewalValue()}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5" aria-hidden="true" />
              <div className="grid gap-0.5">
                <span className="font-medium">{t("workspaceTitle")}</span>
                <span className="text-muted-foreground text-xs">
                  {t("workspaceDescription")}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5" aria-hidden="true" />
              <div className="grid gap-0.5">
                <span className="font-medium">{t("creditsTitle")}</span>
                <span className="text-muted-foreground text-xs">
                  {t("creditsDescription")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!activeCatalog.canManageBilling ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{t("ownerTitle")}</AlertTitle>
          <AlertDescription>{t("ownerDescription")}</AlertDescription>
        </Alert>
      ) : null}

      {!activeCatalog.checkoutAvailable ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{t("billingUnavailableTitle")}</AlertTitle>
          <AlertDescription>
            {t("billingUnavailableDescription")}
          </AlertDescription>
        </Alert>
      ) : null}

      {subscriptionActive ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{t("changeUnavailableTitle")}</AlertTitle>
          <AlertDescription>
            {t("changeUnavailableDescription")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium text-lg">{t("plansAvailable")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("plansDescription")}
          </p>
        </div>
        <ToggleGroup
          aria-label={t("periodLabel")}
          onValueChange={(value) =>
            value && setInterval(value as BillingInterval)
          }
          type="single"
          value={interval}
          variant="outline"
        >
          <ToggleGroupItem value="monthly">{t("monthly")}</ToggleGroupItem>
          <ToggleGroupItem value="yearly">{t("annual")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {visiblePlans.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {visiblePlans.map((plan) => {
            const isCurrent = plan.id === activeCatalog.currentPlanId
            const price = plan.isFree
              ? t("free")
              : format.number(plan.priceMinor / 100, {
                  style: "currency",
                  currency: plan.currency,
                  maximumFractionDigits: 0,
                })

            return (
              <Card
                data-selected={plan.featured || undefined}
                key={plan.id}
                variant="subtle"
              >
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <CardAction>
                    {isCurrent ? (
                      <Badge variant="success">{t("planCurrent")}</Badge>
                    ) : null}
                    {!isCurrent && plan.featured ? (
                      <Badge variant="secondary">
                        <Sparkles aria-hidden="true" />
                        {t("recommended")}
                      </Badge>
                    ) : null}
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-end gap-1">
                    <span className="font-semibold text-3xl tracking-tight">
                      {price}
                    </span>
                    {!plan.isFree ? (
                      <span className="pb-1 text-muted-foreground text-sm">
                        {t(`pricePeriod.${plan.billingType}`)}
                      </span>
                    ) : null}
                  </div>
                  {plan.trialDays > 0 ? (
                    <Badge variant="outline">
                      {t("trialDays", { count: plan.trialDays })}
                    </Badge>
                  ) : null}
                  <ul className="flex flex-col gap-2">
                    {planFeatures(plan).map((feature) => (
                      <li className="flex items-start gap-2" key={feature}>
                        <Check
                          className="mt-0.5 text-primary"
                          aria-hidden="true"
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
      ) : (
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
      )}
    </div>
  )
}
