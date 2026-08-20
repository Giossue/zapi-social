import { Suspense } from "react"

import { PageLoading } from "@workspace/ui/components/page-loading"

import { AiChatPage } from "@/features/ai-studio/components/ai-chat-page"

export default function AIStudioRoutePage() {
  return (
    <Suspense fallback={<PageLoading aria-label="Cargando AI Studio" />}>
      <AiChatPage />
    </Suspense>
  )
}
