import {
  CalendarDays,
  Droplets,
  FileText,
  FolderOpen,
  HandCoins,
  Image,
  KanbanSquare,
  Layers3,
  Link2,
  LayoutDashboard,
  LifeBuoy,
  PenLine,
  Rss,
  Share2,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react"

import type {
  NavigationSourceGroup,
  NavigationSourceItem,
  NavigationSourceLink,
} from "@/components/dashboard-shell/navigation-types"
import type messages from "@/messages/es.d.json"

/** Solo se admite una clave existente en `navigation.portal`. */
type PortalNavigationKey = keyof (typeof messages)["navigation"]["portal"]

export type PortalNavigationLink = NavigationSourceLink<PortalNavigationKey>
export type PortalNavigationItem = NavigationSourceItem<PortalNavigationKey>
export type PortalNavigationGroup = NavigationSourceGroup<PortalNavigationKey>

/**
 * Equivalencia del registro de sidebar de Laravel. Visibilidad por plan/equipo
 * todavía es mock: se muestran todas las opciones para diseñar cada módulo.
 * El texto vive en `messages/` bajo `navigation.portal`.
 */
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
      { labelKey: "channels", href: "/portal/channels", icon: Share2 },
      {
        labelKey: "publishing",
        icon: CalendarDays,
        children: [
          { labelKey: "calendar", href: "/portal/publishing/calendar" },
          { labelKey: "queue", href: "/portal/publishing/queue" },
          { labelKey: "drafts", href: "/portal/publishing/drafts" },
        ],
      },
      { labelKey: "rssSchedules", href: "/portal/rss-schedules", icon: Rss },
      {
        labelKey: "bulkPosts",
        href: "/portal/bulk-posts",
        icon: FileText,
      },
      { labelKey: "automation", href: "/portal/automation", icon: Zap },
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
          { labelKey: "aiSettings", href: "/portal/ai-studio/settings" },
          { labelKey: "aiCredits", href: "/portal/ai-studio/credits" },
        ],
      },
      { labelKey: "linkBio", href: "/portal/link-bio", icon: Link2 },
      { labelKey: "groups", href: "/portal/groups", icon: Layers3 },
      {
        labelKey: "boards",
        icon: KanbanSquare,
        children: [
          { labelKey: "boardTasks", href: "/portal/boards/tasks" },
          { labelKey: "boardContent", href: "/portal/boards/content" },
        ],
      },
      { labelKey: "watermarks", href: "/portal/watermarks", icon: Droplets },
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
