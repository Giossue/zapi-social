import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

export default function SettingsAutomationLogsPage({
  searchParams,
}: {
  searchParams: LegacySettingsSearchParams
}) {
  return redirectToPortalSettings("/portal/settings/automation", searchParams, {
    tab: "logs",
  })
}
