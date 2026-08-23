import { Suspense } from "react"
import { useTranslations } from "next-intl"

import { PageLoading } from "@/components/page-loading"

import { AiChatPage } from "@/features/ai-studio/components/ai-chat-page"

export default function AIStudioRoutePage() {
  const t = useTranslations("routeStates")

  return (
    <Suspense fallback={<PageLoading aria-label={t("aiStudioLoading")} />}>
      <AiChatPage />
    </Suspense>
  )
}
