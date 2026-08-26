import { publicBrandingApi } from "@workspace/api-client"
import type { PublicBranding } from "@workspace/contracts"

export const DEFAULT_BRAND_NAME = "Zapi Social"

export const BUNDLED_BRANDING = {
  favicon: "/brand/favicon.png",
  logoLight: "/brand/logo-light.png",
  logoDark: "/brand/logo-dark.png",
  logoBrandLight: "/brand/logo-brand-light.png",
  logoBrandDark: "/brand/logo-brand-dark.png",
} as const

export type BrandingAssetKey = keyof typeof BUNDLED_BRANDING

export interface Branding {
  siteName: string
  favicon: string
  logoLight: string
  logoDark: string
  logoBrandLight: string
  logoBrandDark: string
}

export const DEFAULT_BRANDING: Branding = {
  siteName: DEFAULT_BRAND_NAME,
  ...BUNDLED_BRANDING,
}

export function resolveBrandingUrl(value: string, fallback: string): string {
  if (!value) return fallback
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("/v1/")) return `/api${value}`
  return value
}

function normalize(branding: PublicBranding): Branding {
  return {
    siteName: branding.siteName?.trim() || DEFAULT_BRAND_NAME,
    favicon: resolveBrandingUrl(branding.favicon, BUNDLED_BRANDING.favicon),
    logoLight: resolveBrandingUrl(
      branding.logoLight,
      BUNDLED_BRANDING.logoLight
    ),
    logoDark: resolveBrandingUrl(branding.logoDark, BUNDLED_BRANDING.logoDark),
    logoBrandLight: resolveBrandingUrl(
      branding.logoBrandLight,
      BUNDLED_BRANDING.logoBrandLight
    ),
    logoBrandDark: resolveBrandingUrl(
      branding.logoBrandDark,
      BUNDLED_BRANDING.logoBrandDark
    ),
  }
}

export async function getBranding(): Promise<Branding> {
  try {
    return normalize(await publicBrandingApi.get())
  } catch {
    return DEFAULT_BRANDING
  }
}

export async function getBrandName(): Promise<string> {
  return (await getBranding()).siteName
}
