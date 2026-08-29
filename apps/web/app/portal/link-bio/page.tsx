import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

type LegacyLinkBioRoutePageProps = {
  searchParams: LegacySettingsSearchParams
}

export default function LinkBioRoutePage({
  searchParams,
}: LegacyLinkBioRoutePageProps) {
  return redirectToPortalSettings("/portal/settings/link-bio", searchParams)
}
