import { BUNDLED_BRANDING } from "@/lib/branding"

import Icons from "./icons"

interface MarketingLogoProps {
  logo: string
  className?: string
}

const MarketingLogo = ({ logo, className }: MarketingLogoProps) => {
  if (!logo || logo === BUNDLED_BRANDING.logoDark) {
    return <Icons.icon className={className} />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo} alt="" aria-hidden="true" className={className} />
}

export default MarketingLogo
