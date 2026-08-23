import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AdminAreaLayout } from "@/components/admin-area-layout"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")
  return { title: t("admin") }
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminAreaLayout>{children}</AdminAreaLayout>
}
