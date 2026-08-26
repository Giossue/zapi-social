import { getBrandName } from "@/lib/branding"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PortalAreaLayout } from "@/components/portal-area-layout"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")
  const brand = await getBrandName()
  return { title: t("portal", { brand }) }
}

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PortalAreaLayout>{children}</PortalAreaLayout>
}
