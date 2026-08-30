import {
  CalendarDays,
  FolderOpen,
  HandCoins,
  Image,
  KanbanSquare,
  LayoutDashboard,
  LifeBuoy,
  PenLine,
  Rss,
  Settings2,
  Users,
  WandSparkles,
} from "lucide-react"

import type {
  NavigationSourceGroup,
  NavigationSourceItem,
  NavigationSourceLink,
} from "@/components/dashboard-shell/navigation-types"
import type messages from "../../../../packages/contracts/src/messages/es.d.json"

type PortalNavigationKey = keyof (typeof messages)["navigation"]["portal"]

export type PortalNavigationLink = NavigationSourceLink<PortalNavigationKey>
export type PortalNavigationItem = NavigationSourceItem<PortalNavigationKey>
export type PortalNavigationGroup = NavigationSourceGroup<PortalNavigationKey>

export const portalNavigationGroups: readonly PortalNavigationGroup[] = [
  {
    labelKey: "general",
    items: [
      {
        labelKey: "overview",
        href: "/portal/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    labelKey: "workspace",
    items: [
      {
        labelKey: "publishing",
        href: "/portal/publishing",
        icon: CalendarDays,
      },
      { labelKey: "rssSchedules", href: "/portal/rss-schedules", icon: Rss },
    ],
  },
  {
    labelKey: "contentTools",
    items: [
      { labelKey: "teams", href: "/portal/teams", icon: Users },
      { labelKey: "captions", href: "/portal/captions", icon: PenLine },
      {
        labelKey: "aiStudio",
        icon: WandSparkles,
        children: [
          { labelKey: "aiChat", href: "/portal/ai-studio" },
          {
            labelKey: "aiAutomation",
            href: "/portal/ai-studio/automation",
          },
          { labelKey: "aiCredits", href: "/portal/ai-studio/credits" },
        ],
      },
      { labelKey: "tasks", href: "/portal/tasks", icon: KanbanSquare },
    ],
  },
  {
    labelKey: "library",
    items: [
      { labelKey: "files", href: "/portal/files", icon: FolderOpen },
      {
        labelKey: "onlineMedia",
        href: "/portal/files/search-online",
        icon: Image,
      },
    ],
  },
  {
    labelKey: "configuration",
    items: [
      { labelKey: "settings", href: "/portal/settings", icon: Settings2 },
    ],
  },
  {
    labelKey: "help",
    items: [{ labelKey: "support", href: "/portal/support", icon: LifeBuoy }],
  },
  {
    labelKey: "apps",
    items: [
      { labelKey: "affiliate", href: "/portal/affiliate", icon: HandCoins },
    ],
  },
]

function getDeepestPortalNavigationItem(pathname: string) {
  return portalNavigationGroups
    .flatMap((group) =>
      group.items.flatMap((item) =>
        "children" in item ? [item, ...item.children] : [item]
      )
    )
    .filter((item): item is PortalNavigationLink => "href" in item)
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((first, second) => second.href.length - first.href.length)[0]
}

export function isPortalNavigationItemActive(href: string, pathname: string) {
  return getDeepestPortalNavigationItem(pathname)?.href === href
}

export function getPortalNavigationItem(pathname: string) {
  return getDeepestPortalNavigationItem(pathname)
}
