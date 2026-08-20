import type { LinkBioBlock, LinkBioBlockType } from "@workspace/contracts"

export const blockLabels: Record<LinkBioBlockType, string> = {
  links: "Enlaces",
  header: "Encabezado",
  social: "Redes sociales",
  contact: "Contacto",
  gallery: "Galería",
  faq: "Preguntas frecuentes",
  product: "Productos",
  video: "Video",
  embed: "Incrustado",
}

export const blockHints: Record<LinkBioBlockType, string> = {
  links: "Lista de botones hacia tus destinos.",
  header: "Título y texto de presentación.",
  social: "Iconos hacia tus perfiles.",
  contact: "Correo, teléfono o dirección.",
  gallery: "Cuadrícula de imágenes.",
  faq: "Preguntas con su respuesta.",
  product: "Artículos con precio y enlace.",
  video: "Un video incrustado por su URL.",
  embed: "Contenido externo incrustado.",
}

/** Tipos cuyo contenido se edita como lista de ítems. */
export const itemBlockTypes: LinkBioBlockType[] = [
  "links",
  "social",
  "contact",
  "gallery",
  "faq",
  "product",
]

export const blockTypes = Object.keys(blockLabels) as LinkBioBlockType[]

export function emptyItem(): LinkBioBlock["items"][number] {
  return {
    answer: "",
    fieldType: "text",
    icon: "",
    image: "",
    label: "",
    note: "",
    placeholder: "",
    price: "",
    url: "",
    value: "",
  }
}

export function emptyBlock(type: LinkBioBlockType): LinkBioBlock {
  return {
    buttonLabel: "",
    buttonUrl: "",
    content: "",
    enabled: true,
    items: itemBlockTypes.includes(type) ? [emptyItem()] : [],
    subtitle: "",
    title: blockLabels[type],
    type,
    url: "",
  }
}

export const templates = [
  {
    description: "Degradado oscuro con bloques de vidrio.",
    key: "aurora",
    label: "Aurora",
  },
  {
    description: "Fondo claro, tipografía grande.",
    key: "minimal",
    label: "Minimal",
  },
  {
    description: "Foco en una sola llamada a la acción.",
    key: "spotlight",
    label: "Spotlight",
  },
  {
    description: "Tarjetas apiladas sobre papel.",
    key: "paper",
    label: "Paper",
  },
  {
    description: "Oscuro sobrio para marcas.",
    key: "pro-dark",
    label: "Pro dark",
  },
  { description: "Tonos cálidos y bordes suaves.", key: "soft", label: "Soft" },
] as const
