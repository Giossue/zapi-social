import type { Metadata } from "next"

import { PortalAreaLayout } from "@/components/portal-area-layout"

export const metadata: Metadata = {
  title: "Portal | Zapi Social",
}

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PortalAreaLayout>{children}</PortalAreaLayout>
}
