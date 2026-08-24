"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { useRouter } from "next/navigation"
import { useCallback, useEffect } from "react"
import {
  getAreaDestination,
  getSessionArea,
} from "@/features/identity/session-area"
import { loginPath } from "@/features/identity/login-redirect"
import { syncLocaleCookie } from "@/i18n/locale-cookie"

const logoutStorageKey = "zapi:session:logout"
const sessionInvalidEvent = "zapi:session-invalid"

export function announceSessionLogout() {
  const timestamp = String(Date.now())
  window.localStorage.setItem(logoutStorageKey, timestamp)
  window.dispatchEvent(new Event(sessionInvalidEvent))
}

function isProtectedPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/")
  )
}

export function SessionSynchronizer() {
  const router = useRouter()

  const redirectToLogin = useCallback(() => {
    if (!isProtectedPath(window.location.pathname)) return
    router.replace(loginPath())
    router.refresh()
  }, [router])

  const validateWhenActive = useCallback(async () => {
    if (!isProtectedPath(window.location.pathname)) return
    try {
      const session = await authApi.session()
      const localeChanged = syncLocaleCookie(session.user.locale)
      const area = getSessionArea(session)
      if (area) {
        const destination = getAreaDestination(area)
        const inExpectedArea =
          area === "admin"
            ? window.location.pathname.startsWith("/admin")
            : window.location.pathname.startsWith("/portal")
        if (!inExpectedArea) {
          router.replace(destination)
          router.refresh()
          return
        }
      }
      if (localeChanged) router.refresh()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirectToLogin()
    }
  }, [redirectToLogin, router])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === logoutStorageKey) redirectToLogin()
    }
    function handleSessionInvalid() {
      redirectToLogin()
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") void validateWhenActive()
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(sessionInvalidEvent, handleSessionInvalid)
    window.addEventListener("focus", handleVisibility)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(sessionInvalidEvent, handleSessionInvalid)
      window.removeEventListener("focus", handleVisibility)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [redirectToLogin, validateWhenActive])

  return null
}
