"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Droplets,
  KeyRound,
  Link2,
  ScrollText,
  Share2,
  WandSparkles,
  Webhook,
} from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

const settingsItems = [
  {
    href: "/portal/settings/channels",
    icon: Share2,
    labelKey: "channels",
    value: "channels",
  },
  {
    href: "/portal/settings/ai-studio",
    icon: WandSparkles,
    labelKey: "aiSettings",
    value: "ai-studio",
  },
  {
    href: "/portal/settings/link-bio",
    icon: Link2,
    labelKey: "linkBio",
    value: "link-bio",
  },
  {
    href: "/portal/settings/watermarks",
    icon: Droplets,
    labelKey: "watermarks",
    value: "watermarks",
  },
  {
    href: "/portal/settings/automation",
    icon: KeyRound,
    labelKey: "automationKeys",
    value: "automation",
  },
  {
    href: "/portal/settings/automation/webhooks",
    icon: Webhook,
    labelKey: "automationWebhooks",
    value: "automation-webhooks",
  },
  {
    href: "/portal/settings/automation/logs",
    icon: ScrollText,
    labelKey: "automationLogs",
    value: "automation-logs",
  },
] as const

export function PortalSettingsSidebar() {
  const pathname = usePathname()
  const t = useTranslations("navigation.portal")
  const activeItem =
    settingsItems
      .filter((item) => pathname.startsWith(item.href))
      .sort((first, second) => second.href.length - first.href.length)[0] ??
    settingsItems[0]

  return (
    <aside className="shrink-0 border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:w-56 md:border-r md:border-b-0">
      <h1 className="px-4 py-4 text-lg font-semibold">{t("settings")}</h1>
      <SidebarGroup className="pt-0">
        <SidebarGroupContent>
          <SidebarMenu aria-label={t("settings")}>
            {settingsItems.map((item) => {
              const Icon = item.icon
              const isActive = item.value === activeItem.value

              return (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      href={item.href}
                    >
                      <Icon />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </aside>
  )
}
