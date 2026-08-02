import type { TeamsData } from "@/features/teams/types/teams"

/** Datos sintéticos para validar la experiencia de Teams antes del REST. */
export const teamsFixture: TeamsData = {
  canManage: true,
  currentUserId: "owner",
  accounts: [
    { id: "instagram", name: "Norte Studio", detail: "Perfil de Instagram" },
    { id: "facebook", name: "Norte Studio", detail: "Página de Facebook" },
    { id: "whatsapp", name: "Norte Studio", detail: "Historias de WhatsApp" },
  ],
  members: [
    {
      id: "owner",
      name: "Ana Morales",
      email: "ana@nortestudio.example",
      role: "owner",
      joinedAt: "15 jul 2026",
      accountIds: ["instagram", "facebook", "whatsapp"],
    },
    {
      id: "admin",
      name: "Luis García",
      email: "luis@nortestudio.example",
      role: "admin",
      joinedAt: "20 jul 2026",
      accountIds: ["instagram", "facebook", "whatsapp"],
    },
    {
      id: "member",
      name: "Sofía Díaz",
      email: "sofia@nortestudio.example",
      role: "member",
      joinedAt: "28 jul 2026",
      accountIds: ["instagram", "whatsapp"],
    },
  ],
  invitations: [
    {
      id: "invite-1",
      email: "equipo@nortestudio.example",
      role: "member",
      expiresAt: "5 ago 2026",
    },
  ],
}
