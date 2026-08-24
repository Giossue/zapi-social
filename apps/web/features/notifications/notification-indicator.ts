const notificationUnreadEvent = "zapi:notification-unread-changed"

export function publishNotificationUnread(unread: number) {
  window.dispatchEvent(
    new CustomEvent<number>(notificationUnreadEvent, { detail: unread })
  )
}

export function subscribeToNotificationUnread(
  listener: (unread: number) => void
) {
  const handleUnread = (event: Event) => {
    listener((event as CustomEvent<number>).detail)
  }

  window.addEventListener(notificationUnreadEvent, handleUnread)
  return () => window.removeEventListener(notificationUnreadEvent, handleUnread)
}
