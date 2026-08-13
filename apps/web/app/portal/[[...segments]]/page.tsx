import { notFound } from "next/navigation"

type PortalRoutePageProps = {
  params: Promise<{ segments?: string[] }>
}

export default async function PortalRoutePage({
  params,
}: PortalRoutePageProps) {
  await params
  notFound()
}
