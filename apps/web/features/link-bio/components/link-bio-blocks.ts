import type { LinkBioBlock, LinkBioBlockType } from "@workspace/contracts"

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
