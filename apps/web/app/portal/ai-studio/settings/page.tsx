import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

type LegacyAiStudioSettingsRoutePageProps = {
  searchParams: LegacySettingsSearchParams
}

export default function AISettingsRoutePage({
  searchParams,
}: LegacyAiStudioSettingsRoutePageProps) {
  return redirectToPortalSettings("/portal/settings/ai-studio", searchParams)
}
