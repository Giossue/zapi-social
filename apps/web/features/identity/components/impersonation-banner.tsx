"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { LogOut, UserRoundCheck } from "lucide-react"

import { adminImpersonationApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

export function ImpersonationBanner({ userName }: { userName: string }) {
  const t = useTranslations("impersonation")
  const [pending, setPending] = useState(false)

  async function leave() {
    setPending(true)
    try {
      await adminImpersonationApi.leave()
      window.location.assign("/admin/users")
    } catch {
      toast.error(t("leaveFailed"))
      setPending(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <UserRoundCheck className="size-4 shrink-0 text-warning" />
        <span className="truncate">{t("viewingAs", { name: userName })}</span>
      </span>
      <Button
        disabled={pending}
        onClick={() => void leave()}
        size="sm"
        type="button"
        variant="brand-secondary"
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <LogOut data-icon="inline-start" />
        )}
        {t("leave")}
      </Button>
    </div>
  )
}
