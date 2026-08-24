import type { LucideIcon } from "lucide-react"

export type NavigationSourceLink<Key extends string = string> = {
  labelKey: Key
  href: string
  icon?: LucideIcon
  indicatorKey?: string
}

export type NavigationSourceDisclosure<Key extends string = string> = {
  labelKey: Key
  icon?: LucideIcon
  indicatorKey?: string
  children: readonly NavigationSourceLink<Key>[]
}

export type NavigationSourceItem<Key extends string = string> =
  NavigationSourceLink<Key> | NavigationSourceDisclosure<Key>

export type NavigationSourceGroup<Key extends string = string> = {
  labelKey: Key
  items: readonly NavigationSourceItem<Key>[]
}

export type DashboardNavigationLink = {
  label: string
  href: string
  icon?: LucideIcon
  indicatorKey?: string
  planLocked?: boolean
}

export type DashboardNavigationDisclosure = {
  label: string
  icon?: LucideIcon
  indicatorKey?: string
  planLocked?: boolean
  children: readonly DashboardNavigationLink[]
}

export type DashboardNavigationItem =
  DashboardNavigationLink | DashboardNavigationDisclosure

export type DashboardNavigationGroup = {
  label: string
  items: readonly DashboardNavigationItem[]
}
