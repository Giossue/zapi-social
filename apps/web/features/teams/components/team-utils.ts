import { ApiError } from "@workspace/api-client"
import type {
  PortalTeamActivityEventType,
  PortalTeamRole,
} from "@workspace/contracts"

export const roleMeta: Record<
  PortalTeamRole,
  { label: string; variant: "neutral" | "success" | "warning" }
> = {
  owner: { label: "Propietario", variant: "success" },
  admin: { label: "Administración", variant: "warning" },
  member: { label: "Miembro", variant: "neutral" },
}

export const activityLabels: Record<PortalTeamActivityEventType, string> = {
  "team.invitation_created": "Invitación creada",
  "team.invitation_resent": "Invitación reenviada",
  "team.invitation_revoked": "Invitación revocada",
  "team.invitation_expired": "Invitación vencida",
  "team.invitation_accepted": "Invitación aceptada",
  "team.member_role_updated": "Rol actualizado",
  "team.member_access_updated": "Acceso actualizado",
  "team.member_account_grants_replaced": "Cuentas asignadas",
  "team.member_revoked": "Miembro eliminado",
  "team.member_left": "Miembro salió del workspace",
  "team.ownership_transferred": "Propiedad transferida",
}

const errorMessages: Record<string, string> = {
  ACCOUNT_GRANT_NOT_ALLOWED:
    "No puedes asignar una o más de las cuentas seleccionadas.",
  AUTH_SESSION_EXPIRED: "Tu sesión terminó. Inicia sesión nuevamente.",
  INVITATION_ALREADY_PENDING:
    "Ya existe una invitación pendiente para ese correo.",
  INVITATION_RESEND_NOT_ALLOWED: "Esta invitación ya no se puede reenviar.",
  LAST_OWNER_PROTECTED:
    "Transfiere la propiedad antes de abandonar el workspace.",
  MEMBER_LIMIT_REACHED: "No quedan cupos disponibles en este workspace.",
  ROLE_CHANGE_NOT_ALLOWED: "Tu rol no permite completar este cambio.",
  TEAM_ACCESS_DENIED: "No tienes permiso para completar esta acción.",
  TEAM_MEMBER_ALREADY_EXISTS: "Ese correo ya pertenece al workspace.",
  VALIDATION_FAILED: "Revisa los datos e inténtalo nuevamente.",
}

export function teamErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return errorMessages[error.code] ?? "No se pudo completar la acción."
  }
  return "No se pudo completar la acción."
}

export function formatTeamDate(value: string | null) {
  if (!value) return "Aún no enviado"
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
}
