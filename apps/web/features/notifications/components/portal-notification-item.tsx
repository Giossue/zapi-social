"use client"

import type { PortalNotification } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@workspace/ui/components/item"
import { cn } from "@workspace/ui/lib/utils"
import { Archive, Check, ExternalLink } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"

function workspaceNotificationBody(
  notification: Extract<PortalNotification, { source: "workspace" }>,
  t: ReturnType<typeof useTranslations<"notificationKind">>
) {
  const title = notification.payload.title ?? ""
  const actor = notification.payload.actor ?? ""

  switch (notification.kind) {
    case "board.task_assigned":
      return t("board.task_assigned.body", { actor, title })
    case "board.task_commented":
      return t("board.task_commented.body", { actor, title })
    case "board.task_due_soon":
      return t("board.task_due_soon.body", { title })
  }
}

export function PortalNotificationItem({
  compact = false,
  notification,
  onArchive,
  onMarkRead,
  pending = false,
}: {
  compact?: boolean
  notification: PortalNotification
  onArchive: (notification: PortalNotification) => void
  onMarkRead: (notification: PortalNotification) => void
  pending?: boolean
}) {
  const format = useFormatter()
  const t = useTranslations("portalNotifications")
  const tKind = useTranslations("notificationKind")
  const title =
    notification.source === "announcement"
      ? notification.title
      : tKind(`${notification.kind}.title`)
  const body =
    notification.source === "announcement"
      ? notification.body
      : workspaceNotificationBody(notification, tKind)

  return (
    <Item
      className={cn(
        "items-start rounded-none border-0",
        notification.readAt ? "opacity-70" : ""
      )}
      role="listitem"
      size={compact ? "xs" : "default"}
    >
      <ItemContent>
        <ItemTitle>
          {!notification.readAt ? (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          ) : null}
          {notification.url ? (
            <a
              className="inline-flex min-w-0 items-center gap-1 hover:underline"
              href={notification.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="truncate">{title}</span>
              <ExternalLink
                aria-label={t("openLink")}
                className="size-3 shrink-0 text-muted-foreground"
              />
            </a>
          ) : (
            title
          )}
        </ItemTitle>
        <ItemDescription className={compact ? "line-clamp-2" : "line-clamp-3"}>
          {body}
        </ItemDescription>
        <ItemFooter>
          <span className="text-xs text-muted-foreground">
            {format.dateTime(new Date(notification.publishedAt), "dateTime")}
          </span>
        </ItemFooter>
      </ItemContent>
      <ItemActions>
        {!notification.readAt && !notification.archivedAt ? (
          <Button
            aria-label={t("actions.markRead")}
            disabled={pending}
            onClick={() => onMarkRead(notification)}
            size="icon-xs"
            type="button"
            variant="brand-secondary"
          >
            <Check />
          </Button>
        ) : null}
        {!notification.archivedAt ? (
          <Button
            aria-label={t("actions.archive")}
            disabled={pending}
            onClick={() => onArchive(notification)}
            size="icon-xs"
            type="button"
            variant="brand-secondary"
          >
            <Archive />
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  )
}
