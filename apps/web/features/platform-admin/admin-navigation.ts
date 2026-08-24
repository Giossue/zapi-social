import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  CreditCard,
  FileQuestion,
  FileText,
  Globe2,
  HandCoins,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  PlugZap,
  Settings2,
  Users,
  Workflow,
} from "lucide-react"

import type {
  NavigationSourceGroup,
  NavigationSourceItem,
  NavigationSourceLink,
} from "@/components/dashboard-shell/navigation-types"
import type messages from "../../../../packages/contracts/src/messages/es.d.json"

type AdminNavigationKey = keyof (typeof messages)["navigation"]["admin"]

export type AdminNavigationLink = NavigationSourceLink<AdminNavigationKey>
export type AdminNavigationItem = NavigationSourceItem<AdminNavigationKey>
export type AdminNavigationGroup = NavigationSourceGroup<AdminNavigationKey>

export const adminNavigationGroups: readonly AdminNavigationGroup[] = [
  {
    labelKey: "general",
    items: [
      { labelKey: "overview", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    labelKey: "platform",
    items: [
      { labelKey: "integrations", href: "/admin/integrations", icon: PlugZap },
      {
        labelKey: "users",
        icon: Users,
        children: [
          { labelKey: "accounts", href: "/admin/users" },
          { labelKey: "teams", href: "/admin/teams" },
          { labelKey: "report", href: "/admin/user-report" },
          { labelKey: "roles", href: "/admin/user-roles" },
        ],
      },
      {
        labelKey: "billing",
        icon: CreditCard,
        children: [
          { labelKey: "plans", href: "/admin/plans" },
          { labelKey: "subscriptions", href: "/admin/subscriptions" },
          { labelKey: "payments", href: "/admin/payments" },
          { labelKey: "manualPayments", href: "/admin/manual-payments" },
          { labelKey: "paymentReport", href: "/admin/payment-report" },
          { labelKey: "coupons", href: "/admin/coupons" },
          { labelKey: "credits", href: "/admin/credits" },
        ],
      },
      { labelKey: "affiliate", href: "/admin/affiliate", icon: HandCoins },
    ],
  },
  {
    labelKey: "support",
    items: [
      { labelKey: "cases", href: "/admin/support", icon: LifeBuoy },
      {
        labelKey: "announcements",
        href: "/admin/notifications",
        icon: Megaphone,
      },
    ],
  },
  {
    labelKey: "content",
    items: [
      {
        labelKey: "blog",
        icon: FileText,
        children: [
          { labelKey: "blogPosts", href: "/admin/blogs" },
          { labelKey: "categories", href: "/admin/blog-categories" },
          { labelKey: "tags", href: "/admin/blog-tags" },
          { labelKey: "blogRss", href: "/admin/blog-rss" },
        ],
      },
      {
        labelKey: "faqs",
        href: "/admin/faqs",
        icon: FileQuestion,
      },
      { labelKey: "languages", href: "/admin/languages", icon: Languages },
    ],
  },
  {
    labelKey: "ai",
    items: [
      {
        labelKey: "aiConfiguration",
        href: "/admin/settings/ai",
        icon: BrainCircuit,
      },
      {
        labelKey: "aiTemplates",
        icon: Bot,
        children: [
          { labelKey: "templates", href: "/admin/ai-templates" },
          {
            labelKey: "aiTemplateCategories",
            href: "/admin/ai-template-categories",
          },
        ],
      },
      {
        labelKey: "aiObservability",
        icon: BarChart3,
        children: [
          { labelKey: "aiUsage", href: "/admin/ai-usage-logs" },
          { labelKey: "aiReport", href: "/admin/ai-report" },
        ],
      },
    ],
  },
  {
    labelKey: "system",
    items: [
      {
        labelKey: "settings",
        icon: Settings2,
        children: [
          { labelKey: "settingsGeneral", href: "/admin/settings/general" },
          { labelKey: "auth", href: "/admin/settings/auth" },
          { labelKey: "captcha", href: "/admin/settings/captcha" },
          { labelKey: "analytics", href: "/admin/settings/analytics" },
        ],
      },
      {
        labelKey: "emailTemplates",
        href: "/admin/email-templates",
        icon: Mail,
      },
      {
        labelKey: "staticPages",
        href: "/admin/settings/static-pages",
        icon: Globe2,
      },
      {
        labelKey: "operations",
        icon: Workflow,
        children: [
          { labelKey: "cache", href: "/admin/settings/cache" },
          { labelKey: "crons", href: "/admin/settings/crons" },
          {
            labelKey: "systemInformation",
            href: "/admin/settings/system-information",
          },
        ],
      },
      { labelKey: "audit", href: "/admin/audit", icon: Activity },
    ],
  },
]

function getDeepestAdminNavigationItem(pathname: string) {
  return adminNavigationGroups
    .flatMap((group) =>
      group.items.flatMap((item) =>
        "children" in item ? [item, ...item.children] : [item]
      )
    )
    .filter((item): item is AdminNavigationLink => "href" in item)
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((first, second) => second.href.length - first.href.length)[0]
}

export function isAdminNavigationItemActive(href: string, pathname: string) {
  return getDeepestAdminNavigationItem(pathname)?.href === href
}

export function getAdminNavigationItem(pathname: string) {
  return getDeepestAdminNavigationItem(pathname)
}
