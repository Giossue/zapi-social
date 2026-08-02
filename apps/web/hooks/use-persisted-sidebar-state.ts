"use client"

import { useCallback, useSyncExternalStore } from "react"

const listeners = new Map<string, Set<() => void>>()

function readCollapsed(storageKey: string) {
  if (typeof window === "undefined") return false

  try {
    return window.localStorage.getItem(storageKey) === "collapsed"
  } catch {
    return false
  }
}

function notify(storageKey: string) {
  listeners.get(storageKey)?.forEach((listener) => listener())
}

export function usePersistedSidebarState(storageKey: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const keyListeners = listeners.get(storageKey) ?? new Set<() => void>()
      keyListeners.add(listener)
      listeners.set(storageKey, keyListeners)

      function onStorage(event: StorageEvent) {
        if (event.key === storageKey) listener()
      }

      window.addEventListener("storage", onStorage)
      return () => {
        keyListeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
    [storageKey]
  )

  const getSnapshot = useCallback(() => readCollapsed(storageKey), [storageKey])
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false)

  const setCollapsed = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      const value =
        typeof next === "function" ? next(readCollapsed(storageKey)) : next
      try {
        window.localStorage.setItem(
          storageKey,
          value ? "collapsed" : "expanded"
        )
      } catch {
        return
      }
      notify(storageKey)
    },
    [storageKey]
  )

  return [collapsed, setCollapsed] as const
}
