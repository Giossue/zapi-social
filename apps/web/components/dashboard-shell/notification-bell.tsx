"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { Bell } from "lucide-react"

import { ApiError, notificationsApi } from "@workspace/api-client"
import type { PortalNotification } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ItemGroup, ItemSeparator } from "@workspace/ui/components/item"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { PortalNotificationItem } from "@/features/notifications/components/portal-notification-item"

export function NotificationBell() {
  const t = useTranslations("shell.notifications")
  const tNotifications = useTranslations("portalNotifications")
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await notificationsApi.feed({ limit: 10 })
      setNotifications(response.notifications)
      setUnread(response.unread)
      setUnavailable(false)
    } catch (error) {
      if (error instanceof ApiError) setUnavailable(true)
      else console.error("Notifications feed request failed", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  async function run(id: string, action: () => Promise<void>) {
    setPendingId(id)
    try {
      await action()
    } catch (error) {
      console.error("Notification action failed", error)
      toast.error(tNotifications("actionFailed"))
    } finally {
      setPendingId(null)
    }
  }

  function update(response: Awaited<ReturnType<typeof notificationsApi.feed>>) {
    setNotifications(response.notifications)
    setUnread(response.unread)
  }

  if (unavailable) return null

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void load()
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-label={unread ? t("unreadLabel", { unread }) : t("title")}
          className="relative"
          size="icon-sm"
          variant="ghost"
        >
          <Bell />
          {unread ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <p className="text-sm font-medium">{t("title")}</p>
          {unread ? <Badge variant="secondary">{unread}</Badge> : null}
        </div>
        <div className="max-h-88 overflow-y-auto">
          {isLoading && !notifications.length ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Spinner /> {t("loading")}
            </div>
          ) : notifications.length ? (
            <ItemGroup className="gap-0">
              {notifications.map((notification, index) => (
                <div key={`${notification.source}:${notification.id}`}>
                  {index ? <ItemSeparator className="my-0" /> : null}
                  <PortalNotificationItem
                    compact
                    notification={notification}
                    onArchive={(item) =>
                      void run(item.id, async () =>
                        update(await notificationsApi.archive(item.id))
                      )
                    }
                    onMarkRead={(item) =>
                      void run(item.id, async () =>
                        update(await notificationsApi.markRead(item.id))
                      )
                    }
                    pending={pendingId !== null}
                  />
                </div>
              ))}
            </ItemGroup>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          )}
        </div>
        <div className="border-t p-2">
          <Button
            asChild
            className="w-full"
            size="sm"
            variant="brand-secondary"
          >
            <Link href="/portal/notifications" onClick={() => setOpen(false)}>
              {t("viewAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
