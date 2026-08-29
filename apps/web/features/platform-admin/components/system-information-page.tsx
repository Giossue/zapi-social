"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { CheckCircle2, CircleAlert, ShieldCheck, XCircle } from "lucide-react"

import { ApiError, adminSystemApi } from "@workspace/api-client"
import type { AdminSystemInformation } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Separator } from "@workspace/ui/components/separator"
import { loginPath } from "@/features/identity/login-redirect"

const serviceNames: Record<
  AdminSystemInformation["services"][number]["key"],
  string
> = {
  postgres: "PostgreSQL",
  redis: "Redis",
}

export function SystemInformationPage() {
  const router = useRouter()
  const t = useTranslations("systemInformation")
  const [data, setData] = useState<AdminSystemInformation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(await adminSystemApi.information())
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("System information request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={ShieldCheck}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !data) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError || !data) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void load()}
                variant="brand-secondary"
              />
            }
            description={t("loadFailed")}
            icon={CircleAlert}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader description={t("description")} title={t("title")} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="font-medium">{t("dependencies")}</p>
            {data.services.map((service, index) => (
              <div className="flex flex-col gap-3" key={service.key}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-start gap-3">
                  {service.passed ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-success"
                    />
                  ) : (
                    <XCircle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {serviceNames[service.key]}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {service.passed
                        ? service.version
                          ? t("version", { version: service.version })
                          : t("available")
                        : t("noResponse")}
                    </p>
                  </div>
                  <Badge variant={service.passed ? "success" : "destructive"}>
                    {service.passed ? t("up") : t("down")}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="font-medium">Runtime</p>
            {data.runtime.map((item, index) => (
              <div className="flex flex-col gap-3" key={item.key}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {t(`runtime.${item.key}`)}
                  </span>
                  <span className="font-mono text-sm">{item.value}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
