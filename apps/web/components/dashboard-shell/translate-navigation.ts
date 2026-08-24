"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"

import type {
  DashboardNavigationGroup,
  DashboardNavigationItem,
  DashboardNavigationLink,
  NavigationSourceGroup,
  NavigationSourceLink,
} from "./navigation-types"

type NavigationTranslator = (key: string) => string

function translateLink(
  link: NavigationSourceLink,
  t: NavigationTranslator
): DashboardNavigationLink {
  return { href: link.href, icon: link.icon, label: t(link.labelKey) }
}

export function useTranslatedNavigation(
  groups: readonly NavigationSourceGroup[],
  namespace: "navigation.portal" | "navigation.admin"
): readonly DashboardNavigationGroup[] {
  const t = useTranslations(namespace)

  return useMemo(() => {
    const translate = t as unknown as NavigationTranslator

    return groups.map((group) => ({
      label: translate(group.labelKey),
      items: group.items.map((item): DashboardNavigationItem =>
        "children" in item
          ? {
              icon: item.icon,
              label: translate(item.labelKey),
              children: item.children.map((child) =>
                translateLink(child, translate)
              ),
            }
          : translateLink(item, translate)
      ),
    }))
  }, [groups, t])
}
