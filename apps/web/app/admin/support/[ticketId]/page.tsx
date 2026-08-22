import { AdminSupportTicketPage } from "@/features/admin-support/components/admin-support-ticket-page"

type AdminSupportTicketRouteProps = {
  params: Promise<{ ticketId: string }>
}

export default async function AdminSupportTicketRoutePage({
  params,
}: AdminSupportTicketRouteProps) {
  const { ticketId } = await params
  return <AdminSupportTicketPage ticketId={ticketId} />
}
