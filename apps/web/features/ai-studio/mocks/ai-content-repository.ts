import { aiContentStudioFixture } from "@/features/ai-studio/fixtures/ai-content"
import type {
  AIContentResult,
  AIContentStudioData,
} from "@/features/ai-studio/types/ai-content"

export async function getAIContentStudioMock(): Promise<AIContentStudioData> {
  return aiContentStudioFixture
}

export function createAIContentResultsMock(
  prompt: string
): readonly AIContentResult[] {
  const subject = prompt.trim().replace(/\s+/g, " ").slice(0, 88)

  return [
    {
      id: "generated-direct",
      title: "Versión directa",
      content: `Empezamos con una idea clara: ${subject}. Conecta esa intención con una escena concreta, mantén un tono cercano y termina con una invitación sencilla para que la comunidad participe.`,
      tags: ["#ContenidoConIntención", "#Comunidad", "#ZapiMock"],
    },
    {
      id: "generated-conversational",
      title: "Versión conversacional",
      content: `¿Qué te inspira hoy? ${subject}. Comparte el momento, la pregunta o el detalle que abre la conversación y deja espacio para que cada persona responda desde su propia experiencia.`,
      tags: ["#Conversación", "#IdeasParaPublicar", "#ZapiMock"],
    },
  ]
}
