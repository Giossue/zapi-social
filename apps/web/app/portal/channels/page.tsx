import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

type LegacyChannelsRoutePageProps = {
  searchParams: LegacySettingsSearchParams
}

export default async function ChannelsRoutePage({
  searchParams,
}: LegacyChannelsRoutePageProps) {
  return redirectToPortalSettings("/portal/settings/channels", searchParams)
}
