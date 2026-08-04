import type {
  FileLibraryData,
  OnlineMediaSearchData,
} from "@/features/files/types/files"

/** Datos sintéticos, estables y locales para diseñar Files antes del contrato REST. */
export const fileLibraryFixture: FileLibraryData = {
  canView: true,
  canUpload: true,
  folders: [],
  assets: [],
}

export const onlineMediaSearchFixture: OnlineMediaSearchData = {
  canSearch: true,
  query: "cafetería de especialidad",
  items: [
    {
      id: "online-terrace",
      title: "Terraza con café de especialidad",
      provider: "Unsplash",
      photographer: "Lucía Torres",
      kind: "photo",
      dimensions: "2400 × 1600",
    },
    {
      id: "online-pour-over",
      title: "Preparación filtrada",
      provider: "Pexels",
      photographer: "Mateo Ríos",
      kind: "photo",
      dimensions: "1920 × 1280",
    },
    {
      id: "online-packaging",
      title: "Empaque para café artesanal",
      provider: "Unsplash",
      photographer: "Noa Acosta",
      kind: "illustration",
      dimensions: "1800 × 1200",
    },
    {
      id: "online-counter",
      title: "Barra de servicio en movimiento",
      provider: "Pexels",
      photographer: "Valentina Soto",
      kind: "video",
      dimensions: "1920 × 1080",
    },
    {
      id: "online-morning",
      title: "Mesa de mañana",
      provider: "Unsplash",
      photographer: "Irene Vidal",
      kind: "photo",
      dimensions: "1600 × 1067",
    },
    {
      id: "online-plant",
      title: "Planta y taza cerámica",
      provider: "Pexels",
      photographer: "Samuel Pérez",
      kind: "photo",
      dimensions: "1800 × 1200",
    },
  ],
}
