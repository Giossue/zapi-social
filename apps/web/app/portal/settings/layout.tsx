import type { ReactNode } from "react"

import { PortalSettingsLayout } from "@/features/settings/components/portal-settings-layout"

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <PortalSettingsLayout>{children}</PortalSettingsLayout>
}
