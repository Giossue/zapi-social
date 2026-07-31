import { PortalAreaLayout } from "@/components/portal-area-layout"

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PortalAreaLayout>{children}</PortalAreaLayout>
}
