export type TeamRole = "owner" | "admin" | "member"

export type TeamAccount = {
  id: string
  name: string
  detail: string
}

export type TeamMember = {
  id: string
  name: string
  email: string
  role: TeamRole
  joinedAt: string
  accountIds: string[]
}

export type TeamInvitation = {
  id: string
  email: string
  role: Exclude<TeamRole, "owner">
  expiresAt: string
}

export type TeamsData = {
  canManage: boolean
  accounts: TeamAccount[]
  currentUserId: string
  invitations: TeamInvitation[]
  members: TeamMember[]
}
