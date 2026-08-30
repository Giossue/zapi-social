import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

export default function SettingsAutomationWebhooksPage({
  searchParams,
}: {
  searchParams: LegacySettingsSearchParams
}) {
  return redirectToPortalSettings("/portal/settings/automation", searchParams, {
    tab: "webhooks",
  })
}
