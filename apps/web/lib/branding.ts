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
  primaryColor: string
  favicon: string
  logoLight: string
  logoDark: string
  logoBrandLight: string
  logoBrandDark: string
}

export const DEFAULT_BRANDING: Branding = {
  siteName: DEFAULT_BRAND_NAME,
  primaryColor: "",
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
    primaryColor: branding.primaryColor ?? "",
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

function readableForeground(hex: string): string {
  const channel = (value: number) => {
    const ratio = value / 255
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  }
  const r = channel(Number.parseInt(hex.slice(1, 3), 16))
  const g = channel(Number.parseInt(hex.slice(3, 5), 16))
  const b = channel(Number.parseInt(hex.slice(5, 7), 16))
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.45 ? "#0a0a0a" : "#ffffff"
}

export function brandColorStyle(primaryColor: string): string | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) return null
  const foreground = readableForeground(primaryColor)
  return `:root:root{--primary:${primaryColor};--primary-foreground:${foreground};--ring:${primaryColor};--sidebar-primary:${primaryColor};--sidebar-primary-foreground:${foreground};--sidebar-ring:${primaryColor}}`
}
