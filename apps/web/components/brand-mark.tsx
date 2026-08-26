"use client"

import { useBranding } from "@/components/branding-provider"
import { BUNDLED_BRANDING } from "@/lib/branding"
import { ZapiLogo } from "@/components/zapi-logo"

export function BrandMark({ className }: { className?: string }) {
  const branding = useBranding()

  if (branding.logoDark === BUNDLED_BRANDING.logoDark) {
    return <ZapiLogo className={className} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={branding.logoDark}
      alt=""
      aria-hidden="true"
      className={className}
    />
  )
}

export function BrandName() {
  return <>{useBranding().siteName}</>
}
