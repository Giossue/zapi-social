import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

type LegacyWatermarksRoutePageProps = {
  searchParams: LegacySettingsSearchParams
}

export default function WatermarksRoutePage({
  searchParams,
}: LegacyWatermarksRoutePageProps) {
  return redirectToPortalSettings("/portal/settings/watermarks", searchParams)
}
