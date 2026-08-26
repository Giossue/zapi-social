export type MarketingCtaKey = "dashboard" | "startFree" | "signIn"

export interface MarketingCta {
  href: string
  messageKey: MarketingCtaKey
}

export function marketingCta(
  signedIn: boolean,
  registrationEnabled: boolean
): MarketingCta {
  if (signedIn) return { href: "/portal/dashboard", messageKey: "dashboard" }
  if (registrationEnabled) return { href: "/register", messageKey: "startFree" }
  return { href: "/login", messageKey: "signIn" }
}
