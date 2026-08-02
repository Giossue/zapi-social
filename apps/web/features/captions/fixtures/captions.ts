import type { Caption } from "@/features/captions/types/captions"

/** Datos sintéticos y deterministas para la biblioteca AppCaptions. */
export const captionsFixture: readonly Caption[] = [
  {
    id: "caption_01",
    name: "Lanzamiento de colección",
    sourceType: "manual",
    status: "active",
    content:
      "Ya está aquí la colección que imaginamos para acompañar tus días. Descubre las piezas, guarda tus favoritas y cuéntanos cuál llevarías primero.",
    notes: "Usar con carrusel de producto y enlace a la colección.",
    tags: ["lanzamiento", "producto", "instagram"],
    updatedAt: "2026-07-30T10:15:00.000Z",
  },
  {
    id: "caption_02",
    name: "Tip de planificación semanal",
    sourceType: "ai",
    status: "active",
    content:
      "Planificar no es llenar un calendario: es dejar espacio para responder a lo que tu comunidad necesita. Empieza con una intención, elige tres ideas y revisa resultados cada viernes.",
    notes: "Revisado por el equipo de contenido.",
    tags: ["educativo", "planificación", "linkedin"],
    updatedAt: "2026-07-28T15:40:00.000Z",
  },
  {
    id: "caption_03",
    name: "Historias detrás del equipo",
    sourceType: "manual",
    status: "draft",
    content:
      "Detrás de cada entrega hay conversaciones, pruebas y muchas versiones. Hoy queremos mostrarte una parte del proceso que normalmente no se ve.",
    notes: null,
    tags: ["equipo", "behind-the-scenes"],
    updatedAt: "2026-07-24T09:20:00.000Z",
  },
  {
    id: "caption_04",
    name: "Cierre de campaña de verano",
    sourceType: "ai",
    status: "archived",
    content:
      "Gracias por acompañarnos este verano. Guardamos los mejores momentos, aprendizajes y mensajes para volver con ideas nuevas.",
    notes: "Campaña finalizada; conservar como referencia de tono.",
    tags: ["campaña", "verano", "archivo"],
    updatedAt: "2026-07-18T13:05:00.000Z",
  },
] as const
