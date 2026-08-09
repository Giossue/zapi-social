import type {
  WatermarkAccount,
  WatermarkRule,
} from "@/features/watermarks/types/watermarks"

/** Datos sintéticos locales para las reglas; las imágenes vienen de Files. */
export const watermarkAccountsFixture: WatermarkAccount[] = [
  {
    id: "7fb068aa-82ef-4208-8da6-86e76cd2195c",
    displayName: "Zapi Social",
    providerKey: "instagram",
    capabilityKey: "instagram_profile",
  },
  {
    id: "4e1326b6-9e6c-466f-b502-d805dbcc7c28",
    displayName: "Zapi Studio",
    providerKey: "facebook",
    capabilityKey: "facebook_page",
  },
  {
    id: "943f6803-0bb0-4431-811c-e0f6e1b898bf",
    displayName: "Zapi Latam",
    providerKey: "linkedin",
    capabilityKey: "linkedin_page",
  },
]

export const watermarksFixture: WatermarkRule[] = [
  {
    id: "1b9f17cf-7ee5-4c0c-8b84-6a9f7c0db9a3",
    socialAccountId: null,
    type: "image",
    imageFileAssetId: null,
    text: null,
    position: "bottom-right",
    opacityPercent: 76,
    scalePercent: 24,
    textPreset: "glass",
    textColor: "brand-gradient",
    textWeight: "semibold",
    updatedAt: "2026-08-04T17:45:00.000Z",
  },
  {
    id: "7580e6ba-5c59-4ec3-97f7-64bfad3d3383",
    socialAccountId: watermarkAccountsFixture[0]!.id,
    type: "text",
    imageFileAssetId: null,
    text: "@zapisocial",
    position: "top-right",
    opacityPercent: 82,
    scalePercent: 18,
    textPreset: "glass",
    textColor: "white",
    textWeight: "bold",
    updatedAt: "2026-08-02T11:32:00.000Z",
  },
]
