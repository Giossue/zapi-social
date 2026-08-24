"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react"
import { useTranslations } from "next-intl"

import { notificationsApi } from "@workspace/api-client"
import type {
  PortalNotification,
  PortalNotificationsFilter,
  PortalNotificationsResponse,
} from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ItemGroup, ItemSeparator } from "@workspace/ui/components/item"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"

import { PageLoading } from "@/components/page-loading"
import { PortalNotificationItem } from "@/features/notifications/components/portal-notification-item"

const filters = ["all", "unread", "read", "archived"] as const
const pageSize = 20

export function PortalNotificationsPage() {
  const t = useTranslations("portalNotifications")
  const [filter, setFilter] = useState<PortalNotificationsFilter>("all")
  const [page, setPage] = useState(1)
  const [response, setResponse] = useState<PortalNotificationsResponse | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const fetchPage = useCallback(
    () => notificationsApi.feed({ filter, limit: pageSize, page }),
    [filter, page]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setResponse(await fetchPage())
      setError(false)
    } catch (nextError) {
      console.error("Notifications history request failed", nextError)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  async function mutate(
    notification: PortalNotification,
    action: (id: string) => Promise<PortalNotificationsResponse>
  ) {
    setPendingId(notification.id)
    try {
      await action(notification.id)
      const nextResponse = await fetchPage()
      if (!nextResponse.notifications.length && page > 1) setPage(page - 1)
      else setResponse(nextResponse)
    } catch (nextError) {
      console.error("Notification action failed", nextError)
      toast.error(t("actionFailed"))
    } finally {
      setPendingId(null)
    }
  }

  function changeFilter(value: string) {
    setFilter(value as PortalNotificationsFilter)
    setPage(1)
    setResponse(null)
  }

  function content() {
    if (loading && !response) return <PageLoading aria-label={t("title")} />

    if (error || !response) {
      return (
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>{t("loadFailedTitle")}</CardTitle>
            <CardDescription>{t("loadFailedDescription")}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => void load()} variant="brand-secondary">
              {t("retry")}
            </Button>
          </CardFooter>
        </Card>
      )
    }

    if (!response.notifications.length) {
      return (
        <Card variant="subtle">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>{t(`empty.${filter}`)}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        </Card>
      )
    }

    const rangeStart = (response.page - 1) * response.limit + 1
    const rangeEnd = Math.min(response.page * response.limit, response.total)

    return (
      <Card aria-busy={loading} variant="subtle">
        <CardHeader className="sr-only">
          <CardTitle>{t(`filters.${filter}`)}</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-0">
            {response.notifications.map((notification, index) => (
              <div key={`${notification.source}:${notification.id}`}>
                {index ? <ItemSeparator className="my-0" /> : null}
                <PortalNotificationItem
                  notification={notification}
                  onArchive={(item) =>
                    void mutate(item, notificationsApi.archive)
                  }
                  onMarkRead={(item) =>
                    void mutate(item, notificationsApi.markRead)
                  }
                  pending={pendingId !== null}
                />
              </div>
            ))}
          </ItemGroup>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {t("range", {
              from: rangeStart,
              to: rangeEnd,
              total: response.total,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              disabled={response.page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              size="sm"
              variant="brand-secondary"
            >
              <ChevronLeft data-icon="inline-start" />
              {t("previous")}
            </Button>
            <Button
              disabled={
                response.page * response.limit >= response.total || loading
              }
              onClick={() => setPage((current) => current + 1)}
              size="sm"
              variant="brand-secondary"
            >
              {t("next")}
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader description={t("description")} title={t("title")} />
      <Tabs onValueChange={changeFilter} value={filter}>
        <TabsList aria-label={t("title")} className="w-full sm:w-fit">
          {filters.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`filters.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {filters.map((value) => (
          <TabsContent key={value} value={value}>
            {value === filter ? content() : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
