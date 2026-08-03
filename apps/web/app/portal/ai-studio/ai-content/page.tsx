import { AIContentStudioPage } from "@/features/ai-studio/components/ai-content-studio-page"
import { getAIContentStudioMock } from "@/features/ai-studio/mocks/ai-content-repository"

export default async function AIContentRoutePage() {
  const data = await getAIContentStudioMock()

  return <AIContentStudioPage data={data} />
}
