import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

type LegacyAutomationRoutePageProps = {
  searchParams: LegacySettingsSearchParams
}

export default function AutomationRoutePage({
  searchParams,
}: LegacyAutomationRoutePageProps) {
  return redirectToPortalSettings("/portal/settings/automation", searchParams)
}
