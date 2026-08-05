export type SupportTicketStatus = "open" | "resolved" | "closed"

export type SupportCategory = {
  id: string
  name: string
  slug: string
  description: string
}

export type SupportComment = {
  id: string
  authorName: string
  authorRole: "requester" | "support"
  body: string
  createdAt: string
}

export type SupportTicket = {
  id: string
  category: SupportCategory
  subject: string
  description: string
  status: SupportTicketStatus
  commentCount: number
  updatedAt: string
  resolvedAt: string | null
  createdAt: string
}

export type SupportTicketDetail = SupportTicket & {
  comments: SupportComment[]
}
