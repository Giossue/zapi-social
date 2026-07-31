import type { AuthSession } from "@workspace/contracts"

export type ProductArea = "admin" | "portal"

export type AreaAuthSession = AuthSession & {
  area: ProductArea
}

export function getSessionArea(session: AuthSession): ProductArea | null {
  const area = (session as Partial<AreaAuthSession>).area
  return area === "admin" || area === "portal" ? area : null
}

export function getAreaDestination(area: ProductArea) {
  return area === "admin" ? "/admin" : "/portal/dashboard"
}
