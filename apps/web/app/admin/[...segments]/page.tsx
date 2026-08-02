import { notFound } from "next/navigation"
import { getAdminNavigationItem } from "@/features/platform-admin/admin-navigation"

type AdminRoutePageProps = { params: Promise<{ segments?: string[] }> }

export default async function AdminRoutePage({ params }: AdminRoutePageProps) {
  const { segments = [] } = await params
  const item = getAdminNavigationItem(`/admin/${segments.join("/")}`)
  if (!item) notFound()

  return (
    <section className="max-w-2xl space-y-3 py-4">
      <p className="text-sm font-medium text-primary">
        Administración · diseño en preparación
      </p>
      <h2 className="text-3xl font-semibold tracking-tight">{item.label}</h2>
      <p className="text-muted-foreground">
        Referencia Laravel registrada. Esta superficie se diseñará con fixtures
        y estados UI antes de implementar API o backend.
      </p>
    </section>
  )
}
