import type { LucideIcon } from "lucide-react"

export type DashboardNavigationLink = {
  label: string
  href: string
  icon?: LucideIcon
}

export type DashboardNavigationDisclosure = {
  label: string
  icon?: LucideIcon
  children: readonly DashboardNavigationLink[]
}

export type DashboardNavigationItem =
  | DashboardNavigationLink
  | DashboardNavigationDisclosure

export type DashboardNavigationGroup = {
  label: string
  items: readonly DashboardNavigationItem[]
}
