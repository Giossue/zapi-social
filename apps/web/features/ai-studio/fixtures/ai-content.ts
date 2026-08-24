import type { AIContentStudioData } from "@/features/ai-studio/types/ai-content"

export const aiContentStudioFixture: AIContentStudioData = {
  canUse: true,
  creditsAvailable: 84,
  templates: [
    {
      id: "launch",
      title: "Lanzamiento de producto",
      description:
        "Una apertura clara y una invitación a descubrir la novedad.",
      prompt:
        "Presenta nuestra nueva colección de café de origen. Destaca el proceso artesanal y termina con una invitación a visitarnos este fin de semana.",
    },
    {
      id: "community",
      title: "Conversación con la comunidad",
      description: "Una pregunta breve que invita a respuestas genuinas.",
      prompt:
        "Escribe una publicación que pregunte a nuestra comunidad cuál es su ritual favorito al preparar café en casa.",
    },
    {
      id: "educational",
      title: "Contenido educativo",
      description: "Explica una idea en lenguaje simple y práctico.",
      prompt:
        "Explica en tres ideas sencillas qué diferencia un café de especialidad y cómo reconocerlo al comprarlo.",
    },
  ],
  drafts: [
    {
      id: "draft-1",
      title: "Ritual de mañana",
      excerpt:
        "Una pausa, una taza y cinco minutos para empezar con intención.",
      platforms: ["Instagram", "Facebook"],
      updatedAt: "Hoy, 09:24",
    },
    {
      id: "draft-2",
      title: "Origen de la semana",
      excerpt: "Conoce las notas que hacen único a nuestro lote de Nariño.",
      platforms: ["Instagram", "LinkedIn"],
      updatedAt: "Ayer, 16:10",
    },
  ],
  initialResults: [
    {
      id: "result-1",
      title: "Versión directa",
      content:
        "Una nueva colección empieza con una historia que se puede saborear. Esta semana llega nuestro café de origen: tostado en pequeñas partidas, con notas cálidas y un proceso que respeta cada grano. Ven a descubrirlo este fin de semana y cuéntanos qué aroma te acompañó primero.",
      tags: ["#CaféDeOrigen", "#HechoConCalma", "#NuevaColección"],
    },
    {
      id: "result-2",
      title: "Versión cercana",
      content:
        "Hay novedades que se disfrutan mejor sin prisa. Preparamos una nueva colección de café de origen para acompañar conversaciones, mañanas lentas y visitas inesperadas. Pasa este fin de semana, pruébala y encuentra tu taza favorita.",
      tags: ["#CaféDeEspecialidad", "#RitualesDiarios", "#NosVemosAquí"],
    },
  ],
}
