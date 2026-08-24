import type { PortalTeamRole } from "@workspace/contracts"

export const roleVariants: Record<
  PortalTeamRole,
  "neutral" | "success" | "warning"
> = {
  owner: "success",
  admin: "warning",
  member: "neutral",
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
}
