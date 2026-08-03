import { AdminAreaLayout } from "@/components/admin-area-layout"

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminAreaLayout>{children}</AdminAreaLayout>
}
