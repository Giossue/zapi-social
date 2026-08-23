import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PortalAreaLayout } from "@/components/portal-area-layout"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")
  return { title: t("portal") }
}

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PortalAreaLayout>{children}</PortalAreaLayout>
}
