import { SupportTicketDetailPage } from "@/features/support/components/support-ticket-detail-page"

type SupportTicketRoutePageProps = { params: Promise<{ ticketId: string }> }

export default async function SupportTicketRoutePage({
  params,
}: SupportTicketRoutePageProps) {
  const { ticketId } = await params
  return <SupportTicketDetailPage ticketId={ticketId} />
}
