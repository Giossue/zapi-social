import {
  redirectToPortalSettings,
  type LegacySettingsSearchParams,
} from "@/features/settings/lib/legacy-settings-redirect"

type LegacyAutomationWebhooksRoutePageProps = {
  searchParams: LegacySettingsSearchParams
}

export default function AutomationRoutePage({
  searchParams,
}: LegacyAutomationWebhooksRoutePageProps) {
  return redirectToPortalSettings("/portal/settings/automation", searchParams, {
    tab: "webhooks",
  })
}
