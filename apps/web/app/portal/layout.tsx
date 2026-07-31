import { AppShell } from "@/components/app-shell"

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>
}
