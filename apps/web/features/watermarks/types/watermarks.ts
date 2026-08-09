export type WatermarkType = "image" | "text"
export type WatermarkPosition =
  "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right"
export type WatermarkTextPreset =
  "glass" | "solid-dark" | "solid-light" | "minimal"
export type WatermarkTextColor =
  "brand-gradient" | "sunset-gradient" | "ocean-gradient" | "dark" | "white"
export type WatermarkTextWeight = "medium" | "semibold" | "bold"

export type WatermarkAccount = {
  id: string
  displayName: string
  providerKey: string
  capabilityKey: string
}

export type WatermarkImageAsset = {
  id: string
  name: string
  previewSrc: string
}

export type WatermarkLibraryFolder = {
  id: string
  name: string
}

export type WatermarkRule = {
  id: string
  socialAccountId: string | null
  type: WatermarkType
  imageFileAssetId: string | null
  text: string | null
  position: WatermarkPosition
  opacityPercent: number
  scalePercent: number
  textPreset: WatermarkTextPreset
  textColor: WatermarkTextColor
  textWeight: WatermarkTextWeight
  updatedAt: string
}

export type WatermarkDraft = Omit<WatermarkRule, "id" | "updatedAt">
