import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

type LegacyAutomationLogsRoutePageProps = {
  searchParams: LegacySettingsSearchParams
}

export default function AutomationRoutePage({
  searchParams,
}: LegacyAutomationLogsRoutePageProps) {
  return redirectToPortalSettings(
    "/portal/settings/automation/logs",
    searchParams
  )
}
