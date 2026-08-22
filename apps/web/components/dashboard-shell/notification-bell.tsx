"use client"

import { useCallback, useEffect, useState } from "react"
import { Archive, Bell, CheckCheck, ExternalLink } from "lucide-react"

import { ApiError, notificationsApi } from "@workspace/api-client"
import type { PortalNotification } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
  }).format(new Date(value))
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await notificationsApi.feed()
      setNotifications(response.notifications)
      setUnread(response.unread)
      setUnavailable(false)
    } catch (error) {
      /** Sin sesión Portal la campana simplemente no se muestra. */
      if (error instanceof ApiError) setUnavailable(true)
      else console.error("Notifications feed request failed", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setPending(true)
    try {
      await action()
    } catch (error) {
      console.error("Notification action failed", error)
    } finally {
      setPending(false)
    }
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
          aria-label={
            unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"
          }
          className="relative"
          size="icon-sm"
          variant="brand-secondary"
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
      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <p className="text-sm font-medium">Notificaciones</p>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Marcar todo como leído"
              disabled={pending || !notifications.length}
              onClick={() =>
                void run(async () => {
                  const response = await notificationsApi.markAllRead()
                  setNotifications(response.notifications)
                  setUnread(response.unread)
                })
              }
              size="icon-sm"
              variant="brand-secondary"
            >
              <CheckCheck />
            </Button>
            <Button
              aria-label="Archivar todo"
              disabled={pending || !notifications.length}
              onClick={() =>
                void run(async () => {
                  const response = await notificationsApi.archiveAll()
                  setNotifications(response.notifications)
                  setUnread(response.unread)
                })
              }
              size="icon-sm"
              variant="brand-secondary"
            >
              <Archive />
            </Button>
          </div>
        </div>
        <div className="max-h-88 overflow-y-auto">
          {isLoading && !notifications.length ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Spinner /> Cargando
            </div>
          ) : notifications.length ? (
            <ul className="divide-y">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    className={cn(
                      "flex w-full flex-col gap-1 p-3 text-left hover:bg-accent",
                      notification.readAt ? "opacity-70" : ""
                    )}
                    onClick={() =>
                      void run(async () => {
                        const response = await notificationsApi.markRead(
                          notification.id
                        )
                        setNotifications(response.notifications)
                        setUnread(response.unread)
                        if (notification.url)
                          window.open(
                            notification.url,
                            "_blank",
                            "noopener,noreferrer"
                          )
                      })
                    }
                    type="button"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {notification.readAt ? null : (
                        <span
                          aria-hidden="true"
                          className="size-1.5 shrink-0 rounded-full bg-primary"
                        />
                      )}
                      {notification.title}
                      {notification.url ? (
                        <ExternalLink className="size-3 text-muted-foreground" />
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {notification.body}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(notification.publishedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
