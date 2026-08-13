"use client"

import { useCallback, useEffect, useRef } from "react"
import Script from "next/script"

import { Field, FieldLabel } from "@workspace/ui/components/field"

type TurnstileOptions = {
  sitekey: string
  theme: "auto" | "dark" | "light"
  size: "flexible" | "normal" | "compact"
  callback: (token: string) => void
  "error-callback": () => void
  "expired-callback": () => void
}

type TurnstileApi = {
  ready: (callback: () => void) => void
  render: (container: HTMLElement, options: TurnstileOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function currentWidgetId(ref: { current: { id: string | null } }) {
  return ref.current.id
}

export function TurnstileWidget({
  siteKey,
  resetKey,
  onError,
  onTokenChange,
}: {
  siteKey: string
  resetKey: number
  onError: () => void
  onTokenChange: (token: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetRef = useRef<{ id: string | null }>({ id: null })
  const previousResetKeyRef = useRef(resetKey)

  const render = useCallback(() => {
    const container = containerRef.current
    const turnstile = window.turnstile
    if (container === null || !turnstile || currentWidgetId(widgetRef)) return

    turnstile.ready(() => {
      if (currentWidgetId(widgetRef)) return
      widgetRef.current.id = turnstile.render(container, {
        sitekey: siteKey,
        theme: "auto",
        size: "flexible",
        callback: onTokenChange,
        "error-callback": () => {
          onTokenChange("")
          onError()
        },
        "expired-callback": () => onTokenChange(""),
      })
    })
  }, [onError, onTokenChange, siteKey])

  useEffect(() => {
    const widget = widgetRef.current
    render()
    return () => {
      const widgetId = currentWidgetId({ current: widget })
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId)
        widget.id = null
      }
    }
  }, [render])

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) return
    previousResetKeyRef.current = resetKey
    const widgetId = currentWidgetId(widgetRef)
    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId)
      onTokenChange("")
    }
  }, [onTokenChange, resetKey])

  return (
    <Field className="gap-1.5">
      <FieldLabel>
        Verificación de seguridad <RequiredMark />
      </FieldLabel>
      <Script
        id="cloudflare-turnstile"
        onError={onError}
        onReady={render}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div className="min-h-[65px]" ref={containerRef} />
    </Field>
  )
}
