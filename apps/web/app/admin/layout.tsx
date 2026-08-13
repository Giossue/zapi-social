import type { Metadata } from "next"

import { AdminAreaLayout } from "@/components/admin-area-layout"

export const metadata: Metadata = {
  title: "Admin | Zapi Social",
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminAreaLayout>{children}</AdminAreaLayout>
}
