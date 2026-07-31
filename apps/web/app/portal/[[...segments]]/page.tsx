import { notFound } from "next/navigation"
import { getPortalNavigationItem } from "@/features/portal-shell/portal-navigation"

type PortalRoutePageProps = {
  params: Promise<{ segments?: string[] }>
}

export default async function PortalRoutePage({ params }: PortalRoutePageProps) {
  const { segments = [] } = await params
  const pathname = `/portal/${segments.join("/")}`
  const item = getPortalNavigationItem(pathname)

  if (!item) {
    notFound()
  }

  return (
    <section className="max-w-2xl space-y-3 py-4">
      <p className="text-sm font-medium text-primary">Portal · diseño en preparación</p>
      <h2 className="text-3xl font-semibold tracking-tight">{item.label}</h2>
      <p className="text-muted-foreground">
        Navegación equivalente a Laravel. Esta pantalla seguirá con fixtures sintéticos y mock de
        interacciones antes de definir API o backend.
      </p>
    </section>
  )
}
