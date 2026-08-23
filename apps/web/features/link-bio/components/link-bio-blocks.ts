import type { LinkBioBlock, LinkBioBlockType } from "@workspace/contracts"

/** El texto de cada tipo vive en `messages/` bajo `linkBio.block`. */
export const blockTypes: LinkBioBlockType[] = [
  "links",
  "header",
  "social",
  "contact",
  "gallery",
  "faq",
  "product",
  "video",
  "embed",
]

/** Tipos cuyo contenido se edita como lista de ítems. */
export const itemBlockTypes: LinkBioBlockType[] = [
  "links",
  "social",
  "contact",
  "gallery",
  "faq",
  "product",
]

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

/** El título inicial lo pone quien crea el bloque, ya traducido. */
export function emptyBlock(type: LinkBioBlockType, title = ""): LinkBioBlock {
  return {
    buttonLabel: "",
    buttonUrl: "",
    content: "",
    enabled: true,
    items: itemBlockTypes.includes(type) ? [emptyItem()] : [],
    subtitle: "",
    title,
    type,
    url: "",
  }
}
