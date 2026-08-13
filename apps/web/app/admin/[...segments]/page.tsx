import { notFound } from "next/navigation"

type AdminRoutePageProps = { params: Promise<{ segments?: string[] }> }

export default async function AdminRoutePage({ params }: AdminRoutePageProps) {
  await params
  notFound()
}
